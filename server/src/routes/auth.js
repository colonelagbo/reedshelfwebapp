import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { authenticateToken } from '../middleware/auth.js';

export const authRouter = express.Router();

const uid = (prefix = 'user') => `${prefix}_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existing = db.get('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uid('user');
    const createdAt = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, name, email, password, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name.trim(), trimmedEmail, hashedPassword, null, createdAt]
    );

    // Create default settings
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
      createdAt,
    };

    const token = generateToken(user);
    res.status(201).json({ token, user });
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

    // Support both bcrypt hashes and plain text passwords (from migrated demo stores)
    let passwordValid = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      passwordValid = await bcrypt.compare(password, user.password);
    } else {
      passwordValid = user.password === password;
      // Upgrade plain password to bcrypt hash on successful login
      if (passwordValid) {
        const upgraded = await bcrypt.hash(password, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [upgraded, user.id]);
      }
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.created_at,
    };

    const token = generateToken(userProfile);
    res.json({ token, user: userProfile });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticateToken, (req, res) => {
  try {
    const user = req.user;
    const books = db.all('SELECT id FROM books WHERE uploaded_by = ?', [user.id]);
    const plans = db.all('SELECT id FROM reading_plans WHERE user_id = ?', [user.id]);
    const progress = db.all('SELECT id FROM reading_progress WHERE user_id = ? AND page > 1', [user.id]);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
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

// PUT /api/auth/profile
authRouter.put('/profile', authenticateToken, (req, res) => {
  try {
    const { name, avatar } = req.body;
    const updates = [];
    const params = [];

    if (name && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(avatar);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No profile updates provided.' });
    }

    params.push(req.user.id);
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = db.get('SELECT id, name, email, avatar, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        avatar: updated.avatar,
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
