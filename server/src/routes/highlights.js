import express from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export const highlightsRouter = express.Router();

const uid = (prefix = 'hl') => `${prefix}_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

// GET /api/highlights/:bookId - Get highlights for a book
highlightsRouter.get('/:bookId', authenticateToken, (req, res) => {
  try {
    const rows = db.all(
      'SELECT id, user_id, book_id, page, text, color, created_at FROM highlights WHERE user_id = ? AND book_id = ? ORDER BY page ASC, created_at ASC',
      [req.user.id, req.params.bookId]
    );

    const formatted = rows.map((h) => ({
      id: h.id,
      userId: h.user_id,
      bookId: h.book_id,
      page: h.page,
      text: h.text,
      color: h.color,
      createdAt: h.created_at,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching highlights:', err);
    res.status(500).json({ error: 'Failed to retrieve highlights.' });
  }
});

// POST /api/highlights/:bookId - Save a new highlight
highlightsRouter.post('/:bookId', authenticateToken, (req, res) => {
  try {
    const { text, page, color } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Highlight text cannot be empty.' });
    }

    const hlId = uid('highlight');
    const now = new Date().toISOString();
    const pageNum = Math.max(1, parseInt(page || '1', 10));

    db.run(
      'INSERT INTO highlights (id, user_id, book_id, page, text, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [hlId, req.user.id, req.params.bookId, pageNum, text.trim(), color || '#ffd24c', now]
    );

    res.status(201).json({
      id: hlId,
      userId: req.user.id,
      bookId: req.params.bookId,
      page: pageNum,
      text: text.trim(),
      color: color || '#ffd24c',
      createdAt: now,
    });
  } catch (err) {
    console.error('Error saving highlight:', err);
    res.status(500).json({ error: 'Failed to save highlight.' });
  }
});

// DELETE /api/highlights/:id - Delete a highlight
highlightsRouter.delete('/:id', authenticateToken, (req, res) => {
  try {
    db.run('DELETE FROM highlights WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Highlight deleted successfully.' });
  } catch (err) {
    console.error('Error deleting highlight:', err);
    res.status(500).json({ error: 'Failed to delete highlight.' });
  }
});
