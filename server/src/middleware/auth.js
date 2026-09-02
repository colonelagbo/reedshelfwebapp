import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

export function authenticateToken(req, res, next) {
  // Extract token from header or query param
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    
    // Ensure user still exists in DB
    const user = db.get('SELECT id, name, email, avatar, role, status, created_at FROM users WHERE id = ?', [payload.id]);
    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact an administrator.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired session token. Please sign in again.' });
  }
}

export function optionalToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = db.get('SELECT id, name, email, avatar, role, status, created_at FROM users WHERE id = ?', [payload.id]);
      if (user && user.status !== 'suspended') {
        req.user = user;
      }
    } catch {
      // Ignore invalid token for optional auth
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
