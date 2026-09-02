import express from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export const plansRouter = express.Router();

const uid = (prefix = 'plan') => `${prefix}_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

// GET /api/plans - Get user's reading plans
plansRouter.get('/', authenticateToken, (req, res) => {
  try {
    const rows = db.all(
      'SELECT id, user_id, book_id, start_date, target_date, days, pages_per_day, total_pages, created_at, updated_at FROM reading_plans WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    const formatted = rows.map((p) => ({
      id: p.id,
      userId: p.user_id,
      bookId: p.book_id,
      startDate: p.start_date,
      targetDate: p.target_date,
      days: p.days,
      pagesPerDay: p.pages_per_day,
      totalPages: p.total_pages,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching plans:', err);
    res.status(500).json({ error: 'Failed to retrieve reading plans.' });
  }
});

// POST /api/plans - Create a new reading plan
plansRouter.post('/', authenticateToken, (req, res) => {
  try {
    const { bookId, startDate, targetDate, days, pagesPerDay, totalPages } = req.body;

    if (!bookId) {
      return res.status(400).json({ error: 'Book ID is required.' });
    }

    const planId = uid('plan');
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO reading_plans (
        id, user_id, book_id, start_date, target_date, days, pages_per_day, total_pages, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planId,
        req.user.id,
        bookId,
        startDate || now.slice(0, 10),
        targetDate || now.slice(0, 10),
        parseInt(days || '14', 10),
        parseInt(pagesPerDay || '10', 10),
        parseInt(totalPages || '100', 10),
        now,
        now,
      ]
    );

    res.status(201).json({
      id: planId,
      userId: req.user.id,
      bookId,
      startDate: startDate || now.slice(0, 10),
      targetDate: targetDate || now.slice(0, 10),
      days: parseInt(days || '14', 10),
      pagesPerDay: parseInt(pagesPerDay || '10', 10),
      totalPages: parseInt(totalPages || '100', 10),
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    console.error('Error creating plan:', err);
    res.status(500).json({ error: 'Failed to create reading plan.' });
  }
});

// DELETE /api/plans/:id - Delete a reading plan
plansRouter.delete('/:id', authenticateToken, (req, res) => {
  try {
    db.run('DELETE FROM reading_plans WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Reading plan deleted successfully.' });
  } catch (err) {
    console.error('Error deleting plan:', err);
    res.status(500).json({ error: 'Failed to delete reading plan.' });
  }
});
