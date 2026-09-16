import express from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export const plansRouter = express.Router();

const uid = (prefix = 'plan') => `${prefix}_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

// GET /api/plans/search-users - Search users by username or name to add to group plans
plansRouter.get('/search-users', authenticateToken, (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const rows = db.all('SELECT id, name, email, avatar FROM users LIMIT 100');
    const filtered = (rows || [])
      .filter((u) => {
        if (!q) return true;
        const nameMatch = (u.name || '').toLowerCase().includes(q);
        const emailMatch = (u.email || '').toLowerCase().includes(q);
        const usernameMatch = (u.name || '').toLowerCase().replace(/\s+/g, '').includes(q);
        return nameMatch || emailMatch || usernameMatch;
      })
      .map((u) => {
        const username = (u.name || '').toLowerCase().replace(/\s+/g, '') || u.email?.split('@')[0];
        return {
          id: u.id,
          name: u.name,
          username,
          email: u.email,
          avatar: u.avatar || null,
        };
      })
      .slice(0, 10);

    res.json(filtered);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ error: 'Failed to search users.' });
  }
});

// GET /api/plans - Get user's reading plans (including group plans where user is a member)
plansRouter.get('/', authenticateToken, (req, res) => {
  try {
    const user = req.user;
    const userName = (user?.name || '').toLowerCase();
    const userCleanName = userName.replace(/\s+/g, '');
    const userEmail = (user?.email || '').toLowerCase();

    const allPlans = db.all(
      'SELECT id, user_id, book_id, start_date, target_date, days, pages_per_day, total_pages, created_at, updated_at, plan_type, group_name, group_members FROM reading_plans ORDER BY created_at DESC'
    );

    const filtered = (allPlans || []).filter((p) => {
      // User is the creator
      if (p.user_id === user.id) return true;

      // User is listed in group_members
      if (p.plan_type === 'group' && p.group_members) {
        try {
          const members = typeof p.group_members === 'string' ? JSON.parse(p.group_members) : p.group_members;
          if (Array.isArray(members)) {
            return members.some((m) => {
              const memStr = (typeof m === 'string' ? m : (m.username || m.name || m.email || '')).toLowerCase();
              const memClean = memStr.replace(/[@\s]/g, '');
              return (
                memStr === userName ||
                memClean === userCleanName ||
                memStr === userEmail ||
                (m.id && m.id === user.id)
              );
            });
          }
        } catch {
          // ignore parsing error
        }
      }
      return false;
    });

    const formatted = filtered.map((p) => {
      let members = [];
      if (p.group_members) {
        try {
          members = typeof p.group_members === 'string' ? JSON.parse(p.group_members) : p.group_members;
        } catch {
          members = [];
        }
      }
      return {
        id: p.id,
        userId: p.user_id,
        bookId: p.book_id,
        startDate: p.start_date,
        targetDate: p.target_date,
        days: p.days,
        pagesPerDay: p.pages_per_day,
        totalPages: p.total_pages,
        planType: p.plan_type || 'individual',
        groupName: p.group_name || '',
        members: Array.isArray(members) ? members : [],
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching plans:', err);
    res.status(500).json({ error: 'Failed to retrieve reading plans.' });
  }
});

// POST /api/plans - Create a new reading plan (personal or group)
plansRouter.post('/', authenticateToken, (req, res) => {
  try {
    const {
      bookId,
      startDate,
      targetDate,
      days,
      pagesPerDay,
      totalPages,
      planType = 'individual',
      groupName = '',
      members = []
    } = req.body;

    if (!bookId) {
      return res.status(400).json({ error: 'Book ID is required.' });
    }

    const planId = uid('plan');
    const now = new Date().toISOString();
    const membersList = Array.isArray(members) ? members : [];
    const membersJson = JSON.stringify(membersList);

    db.run(
      `INSERT INTO reading_plans (
        id, user_id, book_id, start_date, target_date, days, pages_per_day, total_pages, created_at, updated_at, plan_type, group_name, group_members
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        planType,
        groupName || '',
        membersJson,
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
      planType,
      groupName: groupName || '',
      members: membersList,
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
