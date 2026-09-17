import express from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getSupabaseClient } from '../storage/supabase.js';

export const highlightsRouter = express.Router();

const uid = (prefix = 'hl') => `${prefix}_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

// GET /api/highlights/:bookId - Get highlights for a book
highlightsRouter.get('/:bookId', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('highlights')
          .select('id, user_id, book_id, page, text, color, created_at')
          .eq('user_id', req.user.id)
          .eq('book_id', req.params.bookId)
          .order('page', { ascending: true })
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data)) {
          return res.json(data.map((h) => ({
            id: h.id,
            userId: h.user_id,
            bookId: h.book_id,
            page: h.page,
            text: h.text,
            color: h.color,
            createdAt: h.created_at,
          })));
        }
      } catch (sbErr) {
        // Fallback to local DB
      }
    }

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
highlightsRouter.post('/:bookId', authenticateToken, async (req, res) => {
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

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('highlights').upsert({
          id: hlId,
          user_id: req.user.id,
          book_id: req.params.bookId,
          page: pageNum,
          text: text.trim(),
          color: color || '#ffd24c',
          created_at: now,
        });
      } catch (sbErr) {
        console.warn('[Supabase Highlight Sync Notice]:', sbErr.message);
      }
    }

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
highlightsRouter.delete('/:id', authenticateToken, async (req, res) => {
  try {
    db.run('DELETE FROM highlights WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('highlights').delete().eq('id', req.params.id).eq('user_id', req.user.id);
      } catch {}
    }

    res.json({ message: 'Highlight deleted successfully.' });
  } catch (err) {
    console.error('Error deleting highlight:', err);
    res.status(500).json({ error: 'Failed to delete highlight.' });
  }
});
