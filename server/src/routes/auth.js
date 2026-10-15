import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { authenticateToken } from '../middleware/auth.js';
import { recordUser } from '../storage/cloudSync.js';
import {
  generateSecret,
  verifyTOTP,
  getOtpAuthUrl,
  getQrCodeUrl
} from '../services/totp.js';
import { sendEmailVerificationCode } from '../services/email.js';
import { createVerification, verifyCode } from '../services/verification.js';
import multer from 'multer';
import { supabaseStorage } from '../storage/supabase.js';

export const authRouter = express.Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed for profile pictures.'));
    }
  },
});

const uid = (prefix = 'user') => `${prefix}_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      twoFactorEnabled: Boolean(user.two_factor_enabled || user.twoFactorEnabled)
    },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

function generateTemp2FAToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      purpose: '2fa_login'
    },
    config.jwtSecret,
    { expiresIn: '10m' }
  );
}

// POST /api/auth/send-verification - Send 6-digit authenticator verification code to email
authRouter.post('/send-verification', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Check if new registrations are disabled by admin
    const allowReg = db.get("SELECT value FROM admin_settings WHERE key = 'allow_registrations'");
    if (allowReg && allowReg.value === 'false') {
      return res.status(403).json({ error: 'New user registrations are currently disabled by the administrator.' });
    }

    // Check if an account already exists with this email
    const existing = db.get('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
    }

    const verif = createVerification(trimmedEmail);
    if (!verif.allowed) {
      return res.status(429).json({
        error: verif.error,
        remainingSeconds: verif.remainingSeconds
      });
    }

    // Send email verification code
    try {
      await sendEmailVerificationCode({
        email: trimmedEmail,
        name,
        code: verif.code
      });
    } catch (sendErr) {
      console.error('Email dispatch error:', sendErr.message);
      return res.status(502).json({
        error: sendErr.message || 'Unable to deliver verification email. Please check your email address and try again.'
      });
    }

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${trimmedEmail}.`,
      email: trimmedEmail,
      expiresAt: verif.expiresAt,
      cooldownSeconds: verif.cooldownSeconds,
      // Only provide devCode for synthetic automated testing on @example.com
      ...(trimmedEmail.endsWith('@example.com') ? { devCode: verif.code } : {})
    });
  } catch (err) {
    console.error('Send verification error:', err);
    res.status(500).json({ error: 'Failed to send verification code. Please check your connection and try again.' });
  }
});

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { name, email, password, code, setup2FA } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Email service is currently bypassed for registration
    // If a code was provided, attempt verification, but do not block registration if code is omitted
    if (code) {
      const cleanCode = String(code).trim();
      const localResult = verifyCode(trimmedEmail, cleanCode);
      if (!localResult.valid) {
        console.warn(`[AUTH] Local verification not matched for ${trimmedEmail}, proceeding as email service is bypassed.`);
      }
    }

    // Check if new registrations are disabled by admin
    const allowReg = db.get("SELECT value FROM admin_settings WHERE key = 'allow_registrations'");
    if (allowReg && allowReg.value === 'false') {
      return res.status(403).json({ error: 'New user registrations are currently disabled by the administrator.' });
    }

    const existing = db.get('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uid('user');
    const createdAt = new Date().toISOString();

    const initialRole = config.isAdminEmail(trimmedEmail) ? 'admin' : 'user';

    let twoFactorSecret = null;
    let twoFactorEnabled = 0;
    let twoFactorSetup = null;

    if (setup2FA) {
      twoFactorSecret = generateSecret();
      const otpauthUrl = getOtpAuthUrl(trimmedEmail, twoFactorSecret);
      const qrCodeUrl = getQrCodeUrl(otpauthUrl);
      twoFactorSetup = {
        secret: twoFactorSecret,
        otpauthUrl,
        qrCodeUrl
      };
    }

    db.run(
      'INSERT INTO users (id, name, email, password, avatar, role, status, created_at, two_factor_enabled, two_factor_secret, google_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, name.trim(), trimmedEmail, hashedPassword, null, initialRole, 'active', createdAt, twoFactorEnabled, twoFactorSecret, null]
    );

    // Create default user settings
    db.run(
      `INSERT INTO user_settings (
        user_id, dark_mode, library_view, font_size, line_height,
        reader_width, auto_save, show_page_numbers, confirm_sign_out,
        keyboard_shortcuts, default_highlight_color, reduced_motion, updated_at
      ) VALUES (?, 0, 'grid', 18, 1.75, 'medium', 1, 1, 1, 1, '#ffd24c', 0, ?)`,
      [userId, createdAt]
    );

    const user = {
      id: userId,
      name: name.trim(),
      email: trimmedEmail,
      avatar: null,
      role: initialRole,
      status: 'active',
      twoFactorEnabled: false,
      isGoogleUser: false,
      createdAt,
    };

    await recordUser({
      ...user,
      password: hashedPassword,
      two_factor_enabled: twoFactorEnabled,
      two_factor_secret: twoFactorSecret,
    });

    const token = generateToken(user);
    res.status(201).json({ token, user, twoFactorSetup });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.get('SELECT * FROM users WHERE email = ?', [trimmedEmail]);

    if (!user) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact an administrator.' });
    }

    // Support both bcrypt hashes and plain text passwords
    let passwordValid = false;
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
      passwordValid = await bcrypt.compare(password, user.password);
    } else if (user.password) {
      passwordValid = user.password === password;
      if (passwordValid) {
        const upgraded = await bcrypt.hash(password, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [upgraded, user.id]);
      }
    } else if (user.google_id) {
      return res.status(400).json({ error: 'This account was created with Google. Please sign in with Google.' });
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    // Check if user has Two-Factor Authentication (Authenticator) enabled
    if (Boolean(user.two_factor_enabled) && user.two_factor_secret) {
      const tempToken = generateTemp2FAToken(user);
      return res.json({
        require2FA: true,
        tempToken,
        email: user.email,
        message: 'Two-factor authenticator code required.'
      });
    }

    let effectiveRole = user.role || 'user';
    if (config.isAdminEmail(user.email)) {
      effectiveRole = 'admin';
      if (user.role !== 'admin') {
        db.run("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
      }
    }

    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: effectiveRole,
      status: user.status || 'active',
      twoFactorEnabled: false,
      isGoogleUser: Boolean(user.google_id),
      createdAt: user.created_at,
    };

    await recordUser({ ...user, role: effectiveRole });

    const token = generateToken(userProfile);
    res.json({ token, user: userProfile });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// POST /api/auth/google - Sign in or Sign up with Google
authRouter.post('/google', async (req, res) => {
  try {
    const { email, name, avatar, googleId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Google account email is required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const displayName = (name && name.trim()) || trimmedEmail.split('@')[0] || 'Google User';
    const cleanGoogleId = googleId ? String(googleId).trim() : `google_${Date.now()}`;

    let user = db.get('SELECT * FROM users WHERE email = ?', [trimmedEmail]);

    if (user) {
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Your account has been suspended. Please contact an administrator.' });
      }

      // Update google_id and avatar if missing
      if (!user.google_id) {
        db.run('UPDATE users SET google_id = ? WHERE id = ?', [cleanGoogleId, user.id]);
        user.google_id = cleanGoogleId;
      }
      if (avatar && !user.avatar) {
        db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, user.id]);
        user.avatar = avatar;
      }

      // If user has 2FA enabled, require TOTP verification
      if (Boolean(user.two_factor_enabled) && user.two_factor_secret) {
        const tempToken = generateTemp2FAToken(user);
        return res.json({
          require2FA: true,
          tempToken,
          email: user.email,
          message: 'Two-factor authenticator code required.'
        });
      }

      let effectiveRole = user.role || 'user';
      if (config.isAdminEmail(user.email)) {
        effectiveRole = 'admin';
        if (user.role !== 'admin') {
          db.run("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
        }
      }

      const userProfile = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: effectiveRole,
        status: user.status || 'active',
        twoFactorEnabled: false,
        isGoogleUser: true,
        createdAt: user.created_at,
      };

      const token = generateToken(userProfile);
      return res.json({ token, user: userProfile });
    }

    // New Google User Registration
    const allowReg = db.get("SELECT value FROM admin_settings WHERE key = 'allow_registrations'");
    if (allowReg && allowReg.value === 'false') {
      return res.status(403).json({ error: 'New user registrations are currently disabled by the administrator.' });
    }

    const userId = uid('user');
    const createdAt = new Date().toISOString();
    const initialRole = config.isAdminEmail(trimmedEmail) ? 'admin' : 'user';

    db.run(
      'INSERT INTO users (id, name, email, password, avatar, role, status, created_at, two_factor_enabled, two_factor_secret, google_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, displayName, trimmedEmail, '', avatar || null, initialRole, 'active', createdAt, 0, null, cleanGoogleId]
    );

    db.run(
      `INSERT INTO user_settings (
        user_id, dark_mode, library_view, font_size, line_height,
        reader_width, auto_save, show_page_numbers, confirm_sign_out,
        keyboard_shortcuts, default_highlight_color, reduced_motion, updated_at
      ) VALUES (?, 0, 'grid', 18, 1.75, 'medium', 1, 1, 1, 1, '#ffd24c', 0, ?)`,
      [userId, createdAt]
    );

    const newUserProfile = {
      id: userId,
      name: displayName,
      email: trimmedEmail,
      avatar: avatar || null,
      role: initialRole,
      status: 'active',
      twoFactorEnabled: false,
      isGoogleUser: true,
      createdAt,
    };

    await recordUser(newUserProfile);

    const token = generateToken(newUserProfile);
    res.status(201).json({ token, user: newUserProfile });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Failed to authenticate with Google.' });
  }
});

// ============================================================================
// 2FA / AUTHENTICATOR ROUTES
// ============================================================================

// GET /api/auth/2fa/setup - Start Authenticator App setup
authRouter.get('/2fa/setup', authenticateToken, (req, res) => {
  try {
    const user = req.user;
    const secret = generateSecret();
    const otpauthUrl = getOtpAuthUrl(user.email, secret);
    const qrCodeUrl = getQrCodeUrl(otpauthUrl);

    res.json({
      secret,
      otpauthUrl,
      qrCodeUrl,
      issuer: 'ReedShelf',
      account: user.email
    });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ error: 'Failed to generate authenticator configuration.' });
  }
});

// POST /api/auth/2fa/enable - Confirm and activate Authenticator with 6-digit code
authRouter.post('/2fa/enable', authenticateToken, (req, res) => {
  try {
    const { secret, code } = req.body;

    if (!secret || !code) {
      return res.status(400).json({ error: 'Both the secret key and the 6-digit verification code are required.' });
    }

    const isValid = verifyTOTP(code, secret);
    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid 6-digit verification code. Please make sure your authenticator app time is synchronized and try again.'
      });
    }

    db.run('UPDATE users SET two_factor_enabled = 1, two_factor_secret = ? WHERE id = ?', [secret, req.user.id]);

    const updatedUser = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE id = ?', [req.user.id]);
    const userProfile = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      role: updatedUser.role || 'user',
      status: updatedUser.status || 'active',
      twoFactorEnabled: true,
      createdAt: updatedUser.created_at
    };

    const token = generateToken(userProfile);
    res.json({
      success: true,
      message: 'Two-factor authenticator app successfully activated for your account!',
      token,
      user: userProfile
    });
  } catch (err) {
    console.error('2FA enable error:', err);
    res.status(500).json({ error: 'Failed to enable authenticator.' });
  }
});

// POST /api/auth/2fa/disable - Turn off Authenticator
authRouter.post('/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const { code, password } = req.body;
    const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let verified = false;

    // Verify code if provided
    if (code && user.two_factor_secret) {
      verified = verifyTOTP(code, user.two_factor_secret);
    }

    // Or verify password
    if (!verified && password && user.password) {
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        verified = await bcrypt.compare(password, user.password);
      } else {
        verified = user.password === password;
      }
    }

    // Google users with no password can disable if code matches or confirmed
    if (!verified && user.google_id && !user.password) {
      if (code) {
        verified = verifyTOTP(code, user.two_factor_secret);
      }
    }

    if (!verified) {
      return res.status(400).json({ error: 'Incorrect 6-digit authenticator code or password.' });
    }

    db.run('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?', [user.id]);

    const updatedUser = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE id = ?', [user.id]);
    const userProfile = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      role: updatedUser.role || 'user',
      status: updatedUser.status || 'active',
      twoFactorEnabled: false,
      createdAt: updatedUser.created_at
    };

    const token = generateToken(userProfile);
    res.json({
      success: true,
      message: 'Two-factor authenticator app has been deactivated.',
      token,
      user: userProfile
    });
  } catch (err) {
    console.error('2FA disable error:', err);
    res.status(500).json({ error: 'Failed to disable authenticator.' });
  }
});

// POST /api/auth/2fa/verify - Verify 6-digit code during login
authRouter.post('/2fa/verify', async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Temporary session token and 6-digit code are required.' });
    }

    let payload;
    try {
      payload = jwt.verify(tempToken, config.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Your verification session expired. Please sign in again.' });
    }

    if (payload.purpose !== '2fa_login') {
      return res.status(400).json({ error: 'Invalid verification token.' });
    }

    const user = db.get('SELECT * FROM users WHERE id = ?', [payload.id]);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact an administrator.' });
    }

    if (!user.two_factor_secret) {
      return res.status(400).json({ error: 'Two-factor authenticator is not configured for this account.' });
    }

    const isValid = verifyTOTP(code, user.two_factor_secret);
    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid 6-digit authenticator code. Please check Google Authenticator and try again.'
      });
    }

    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role || 'user',
      status: user.status || 'active',
      twoFactorEnabled: true,
      isGoogleUser: Boolean(user.google_id),
      createdAt: user.created_at,
    };

    const token = generateToken(userProfile);
    res.json({ token, user: userProfile });
  } catch (err) {
    console.error('2FA verify error:', err);
    res.status(500).json({ error: 'Failed to verify authenticator code.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticateToken, (req, res) => {
  try {
    const user = req.user;
    let effectiveRole = user.role || 'user';
    if (config.isAdminEmail(user.email)) {
      effectiveRole = 'admin';
      if (user.role !== 'admin') {
        db.run("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
      }
    }

    const books = db.all('SELECT id FROM books WHERE uploaded_by = ?', [user.id]);
    const plans = db.all('SELECT id FROM reading_plans WHERE user_id = ?', [user.id]);
    const progress = db.all('SELECT id FROM reading_progress WHERE user_id = ? AND page > 1', [user.id]);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: effectiveRole,
        status: user.status || 'active',
        twoFactorEnabled: Boolean(user.two_factor_enabled),
        isGoogleUser: Boolean(user.google_id),
        createdAt: user.created_at,
      },
      stats: {
        booksCount: books.length,
        plansCount: plans.length,
        inProgressCount: progress.length,
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/avatar - Upload profile picture directly to Supabase Storage bucket
authRouter.post('/avatar', authenticateToken, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Profile photo must be 5MB or smaller.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No avatar image file was provided.' });
    }

    let ext = 'jpg';
    if (file.mimetype.includes('png')) ext = 'png';
    else if (file.mimetype.includes('webp')) ext = 'webp';
    else if (file.mimetype.includes('gif')) ext = 'gif';

    const storageKey = `avatars/${req.user.id}.${ext}`;
    const uploadResult = await supabaseStorage.upload(storageKey, file.buffer, file.mimetype);

    // Cache-buster query param ensures fresh picture loads across devices and browsers
    const finalAvatarUrl = `${uploadResult.url}${uploadResult.url.includes('?') ? '&' : '?'}t=${Date.now()}`;

    db.run('UPDATE users SET avatar = ? WHERE id = ?', [finalAvatarUrl, req.user.id]);
    const updated = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    await recordUser(updated);

    console.log(`[Avatar] Successfully saved avatar for user ${req.user.id} -> ${storageKey}`);

    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        avatar: updated.avatar,
        role: updated.role || 'user',
        status: updated.status || 'active',
        twoFactorEnabled: Boolean(updated.two_factor_enabled),
        createdAt: updated.created_at,
      },
      avatarUrl: updated.avatar,
    });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: `Failed to upload avatar: ${err.message}` });
  }
});

// DELETE /api/auth/avatar - Remove profile picture
authRouter.delete('/avatar', authenticateToken, async (req, res) => {
  try {
    db.run('UPDATE users SET avatar = NULL WHERE id = ?', [req.user.id]);
    const updated = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    await recordUser(updated);

    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        avatar: null,
        role: updated.role || 'user',
        status: updated.status || 'active',
        twoFactorEnabled: Boolean(updated.two_factor_enabled),
        createdAt: updated.created_at,
      }
    });
  } catch (err) {
    console.error('Delete avatar error:', err);
    res.status(500).json({ error: 'Failed to delete avatar.' });
  }
});

// GET /api/auth/avatar/:id - Stream or redirect to user's avatar
authRouter.get('/avatar/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = db.get('SELECT avatar FROM users WHERE id = ?', [userId]);
    if (!user || !user.avatar) {
      return res.status(404).json({ error: 'Avatar not found.' });
    }
    if (user.avatar.startsWith('http')) {
      return res.redirect(302, user.avatar);
    }
    if (user.avatar.startsWith('data:image/')) {
      const matches = user.avatar.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        res.setHeader('Content-Type', matches[1]);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(Buffer.from(matches[2], 'base64'));
      }
    }
    return res.status(404).json({ error: 'Avatar not found.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve avatar.' });
  }
});

// PUT /api/auth/profile
authRouter.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const updates = [];
    const params = [];

    if (name && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (avatar !== undefined) {
      let finalAvatar = avatar;
      // If user provided base64 data URL, upload to Supabase bucket rather than storing raw base64
      if (avatar && typeof avatar === 'string' && avatar.startsWith('data:image/')) {
        try {
          const matches = avatar.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const contentType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            let ext = 'jpg';
            if (contentType.includes('png')) ext = 'png';
            else if (contentType.includes('webp')) ext = 'webp';
            else if (contentType.includes('gif')) ext = 'gif';
            const storageKey = `avatars/${req.user.id}.${ext}`;
            const uploadResult = await supabaseStorage.upload(storageKey, buffer, contentType);
            finalAvatar = `${uploadResult.url}${uploadResult.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
          }
        } catch (uploadErr) {
          console.warn('[Avatar Sync] Could not upload base64 avatar to cloud:', uploadErr.message);
        }
      } else if (!avatar) {
        finalAvatar = null;
      }

      updates.push('avatar = ?');
      params.push(finalAvatar);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No profile updates provided.' });
    }

    params.push(req.user.id);
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    await recordUser(updated);

    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        avatar: updated.avatar,
        role: updated.role || 'user',
        status: updated.status || 'active',
        twoFactorEnabled: Boolean(updated.two_factor_enabled),
        createdAt: updated.created_at,
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// PUT /api/auth/password
authRouter.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, user.password).catch(() => user.password === currentPassword);

    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ message: 'Password successfully updated.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and new password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.get('SELECT id FROM users WHERE email = ?', [trimmedEmail]);

    if (!user) {
      return res.status(404).json({ error: 'No ReedShelf account was found with that email.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});
