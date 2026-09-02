import express from 'express';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export const settingsRouter = express.Router();

const defaultSettings = {
  darkMode: false,
  libraryView: 'grid',
  fontSize: 18,
  lineHeight: 1.75,
  readerWidth: 'medium',
  autoSave: true,
  showPageNumbers: true,
  confirmSignOut: true,
  keyboardShortcuts: true,
  defaultHighlightColor: '#ffd24c',
  reducedMotion: false,
};

// GET /api/settings - Get user settings
settingsRouter.get('/', authenticateToken, (req, res) => {
  try {
    const row = db.get('SELECT * FROM user_settings WHERE user_id = ?', [req.user.id]);

    if (!row) {
      return res.json(defaultSettings);
    }

    res.json({
      darkMode: Boolean(row.dark_mode),
      libraryView: row.library_view || 'grid',
      fontSize: row.font_size || 18,
      lineHeight: row.line_height || 1.75,
      readerWidth: row.reader_width || 'medium',
      autoSave: Boolean(row.auto_save),
      showPageNumbers: Boolean(row.show_page_numbers),
      confirmSignOut: Boolean(row.confirm_sign_out),
      keyboardShortcuts: Boolean(row.keyboard_shortcuts),
      defaultHighlightColor: row.default_highlight_color || '#ffd24c',
      reducedMotion: Boolean(row.reduced_motion),
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to retrieve user settings.' });
  }
});

// PUT /api/settings - Update user settings
settingsRouter.put('/', authenticateToken, (req, res) => {
  try {
    const body = req.body || {};
    const now = new Date().toISOString();
    const existing = db.get('SELECT user_id FROM user_settings WHERE user_id = ?', [req.user.id]);

    const s = {
      darkMode: body.darkMode !== undefined ? (body.darkMode ? 1 : 0) : 0,
      libraryView: body.libraryView || 'grid',
      fontSize: body.fontSize ? parseInt(body.fontSize, 10) : 18,
      lineHeight: body.lineHeight ? parseFloat(body.lineHeight) : 1.75,
      readerWidth: body.readerWidth || 'medium',
      autoSave: body.autoSave !== undefined ? (body.autoSave ? 1 : 0) : 1,
      showPageNumbers: body.showPageNumbers !== undefined ? (body.showPageNumbers ? 1 : 0) : 1,
      confirmSignOut: body.confirmSignOut !== undefined ? (body.confirmSignOut ? 1 : 0) : 1,
      keyboardShortcuts: body.keyboardShortcuts !== undefined ? (body.keyboardShortcuts ? 1 : 0) : 1,
      defaultHighlightColor: body.defaultHighlightColor || '#ffd24c',
      reducedMotion: body.reducedMotion !== undefined ? (body.reducedMotion ? 1 : 0) : 0,
    };

    if (existing) {
      db.run(
        `UPDATE user_settings SET
          dark_mode = ?, library_view = ?, font_size = ?, line_height = ?,
          reader_width = ?, auto_save = ?, show_page_numbers = ?, confirm_sign_out = ?,
          keyboard_shortcuts = ?, default_highlight_color = ?, reduced_motion = ?, updated_at = ?
        WHERE user_id = ?`,
        [
          s.darkMode, s.libraryView, s.fontSize, s.lineHeight,
          s.readerWidth, s.autoSave, s.showPageNumbers, s.confirmSignOut,
          s.keyboardShortcuts, s.defaultHighlightColor, s.reducedMotion, now,
          req.user.id,
        ]
      );
    } else {
      db.run(
        `INSERT INTO user_settings (
          user_id, dark_mode, library_view, font_size, line_height,
          reader_width, auto_save, show_page_numbers, confirm_sign_out,
          keyboard_shortcuts, default_highlight_color, reduced_motion, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id, s.darkMode, s.libraryView, s.fontSize, s.lineHeight,
          s.readerWidth, s.autoSave, s.showPageNumbers, s.confirmSignOut,
          s.keyboardShortcuts, s.defaultHighlightColor, s.reducedMotion, now,
        ]
      );
    }

    res.json({
      darkMode: Boolean(s.darkMode),
      libraryView: s.libraryView,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      readerWidth: s.readerWidth,
      autoSave: Boolean(s.autoSave),
      showPageNumbers: Boolean(s.showPageNumbers),
      confirmSignOut: Boolean(s.confirmSignOut),
      keyboardShortcuts: Boolean(s.keyboardShortcuts),
      defaultHighlightColor: s.defaultHighlightColor,
      reducedMotion: Boolean(s.reducedMotion),
    });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ error: 'Failed to update user settings.' });
  }
});
