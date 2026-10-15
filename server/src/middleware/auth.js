import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';
import { getSupabaseClient } from '../storage/supabase.js';
import { syncUsersFromCloud } from '../storage/cloudSync.js';

export async function authenticateToken(req, res, next) {
  // Extract token from header or query param
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  // 1. Verify cryptographically signed local JWT first (instantaneous 0ms execution)
  try {
    const payload = jwt.verify(token, config.jwtSecret);

    // Find user by ID or by email in current database
    let user = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE id = ?', [payload.id]);
    if (!user && payload.email) {
      user = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE LOWER(email) = ?', [payload.email.toLowerCase()]);
    }

    // In serverless cold starts or multi-instance environments, fetch latest users from cloud
    if (!user) {
      await syncUsersFromCloud().catch(() => {});
      user = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE id = ?', [payload.id]);
      if (!user && payload.email) {
        user = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE LOWER(email) = ?', [payload.email.toLowerCase()]);
      }
    }

    // In serverless environments, if a new container started up and doesn't have the user cached yet,
    // restore the user record from the cryptographically verified JWT payload.
    if (!user && payload.email) {
      const isAdmin = payload.role === 'admin' || config.isAdminEmail(payload.email);
      user = {
        id: payload.id || (isAdmin ? 'admin_usr_link4emmy' : ('user_' + payload.email.replace(/[^a-zA-Z0-9]/g, '_'))),
        name: payload.name || (isAdmin ? 'Platform Admin' : 'User'),
        email: payload.email,
        avatar: null,
        role: isAdmin ? 'admin' : 'user',
        status: 'active',
        created_at: new Date().toISOString()
      };
      try {
        db.run(
          'INSERT INTO users (id, name, email, password, avatar, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [user.id, user.name, user.email, '', user.avatar, user.role, user.status, user.created_at]
        );
      } catch {
        // User may already exist in local db cache
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact an administrator.' });
    }

    req.user = user;
    return next();
  } catch (jwtErr) {
    // Local JWT signature invalid or expired. Check if this is an external Supabase session token
  }

  // 2. Fallback to Supabase Auth (for external Supabase session tokens)
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: { user: sbUser } = {}, error: sbError } = await supabase.auth.getUser(token);
      if (!sbError && sbUser && sbUser.email) {
        const isAdmin = config.isAdminEmail(sbUser.email) || sbUser.user_metadata?.role === 'admin';

        let user = db.get(
          'SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE id = ? OR LOWER(email) = ?',
          [sbUser.id, sbUser.email.toLowerCase()]
        );

        if (!user) {
          user = {
            id: sbUser.id,
            name: sbUser.user_metadata?.name || sbUser.email.split('@')[0] || 'User',
            email: sbUser.email,
            avatar: sbUser.user_metadata?.avatar || null,
            role: isAdmin ? 'admin' : (sbUser.user_metadata?.role || 'user'),
            status: 'active',
            created_at: sbUser.created_at || new Date().toISOString()
          };
          try {
            db.run(
              'INSERT INTO users (id, name, email, password, avatar, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [user.id, user.name, user.email, '', user.avatar, user.role, user.status, user.created_at]
            );
          } catch {}
        }

        if (user.status === 'suspended') {
          return res.status(403).json({ error: 'Your account has been suspended. Please contact an administrator.' });
        }

        req.user = user;
        return next();
      }
    } catch (sbEx) {
      // Supabase verification error
    }
  }

  return res.status(403).json({ error: 'Invalid or expired session token. Please sign in again.' });
}

export async function optionalToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    // 1. Check local JWT first
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      let user = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE id = ?', [payload.id]);
      if (!user && payload.email) {
        user = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE LOWER(email) = ?', [payload.email.toLowerCase()]);
      }
      if (!user) {
        await syncUsersFromCloud().catch(() => {});
        user = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE id = ?', [payload.id]);
        if (!user && payload.email) {
          user = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE LOWER(email) = ?', [payload.email.toLowerCase()]);
        }
      }
      if (user && user.status !== 'suspended') {
        req.user = user;
        return next();
      }
    } catch {
      // Fall through to Supabase
    }

    // 2. Fallback to Supabase Auth
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(token);
        if (!sbError && sbUser && sbUser.email) {
          let user = db.get('SELECT id, name, email, avatar, role, status, two_factor_enabled, created_at FROM users WHERE id = ? OR LOWER(email) = ?', [sbUser.id, sbUser.email.toLowerCase()]);
          if (user && user.status !== 'suspended') {
            req.user = user;
            return next();
          }
        }
      } catch {}
    }
  }

  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  if (req.user.status === 'suspended') {
    return res.status(403).json({ error: 'Your account has been suspended. Please contact an administrator.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }

  next();
}
