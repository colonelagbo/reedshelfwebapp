import express from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export const progressRouter = express.Router();

const uid = (prefix = 'prog') => `${prefix}_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

// GET /api/progress/:bookId - Get user's reading progress for a book
progressRouter.get('/:bookId', authenticateToken, (req, res) => {
  try {
    const row = db.get(
      'SELECT page, updated_at FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user.id, req.params.bookId]
    );

    if (row) {
      res.json({ page: row.page, updatedAt: row.updated_at });
    } else {
      res.json({ page: 1, updatedAt: null });
    }
  } catch (err) {
    console.error('Error fetching progress:', err);
    res.status(500).json({ error: 'Failed to retrieve progress.' });
  }
});

// PUT /api/progress/:bookId - Save user's reading progress
progressRouter.put('/:bookId', authenticateToken, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.body.page || '1', 10));
    const now = new Date().toISOString();
    const existing = db.get(
      'SELECT id FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user.id, req.params.bookId]
    );

    if (existing) {
      db.run(
        'UPDATE reading_progress SET page = ?, updated_at = ? WHERE id = ?',
        [page, now, existing.id]
      );
    } else {
      db.run(
        'INSERT INTO reading_progress (id, user_id, book_id, page, updated_at) VALUES (?, ?, ?, ?, ?)',
        [uid(), req.user.id, req.params.bookId, page, now]
      );
    }

    // Also record real-time reading activity event
    try {
      db.run(
        'INSERT INTO reading_activity (id, user_id, book_id, page, action, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uid('act'), req.user.id, req.params.bookId, page, 'read', now]
      );
    } catch (e) {
      // Activity logging is non-blocking
    }

    res.json({ page, updatedAt: now });
  } catch (err) {
    console.error('Error saving progress:', err);
    res.status(500).json({ error: 'Failed to save progress.' });
  }
});
