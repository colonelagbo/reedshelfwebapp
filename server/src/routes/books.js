import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../db.js';
import { supabaseStorage } from '../storage/supabase.js';
import { authenticateToken, optionalToken } from '../middleware/auth.js';

export const booksRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported.'));
    }
  },
});

const uid = (prefix = 'book') => `${prefix}_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

// GET /api/books - Get user's books
booksRouter.get('/', authenticateToken, (req, res) => {
  try {
    const books = db.all(
      'SELECT id, title, author, file_name, file_type, file_size, total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at FROM books WHERE uploaded_by = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    // Map database snake_case fields to frontend camelCase
    const formatted = books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      fileName: b.file_name,
      fileType: b.file_type,
      size: b.file_size,
      totalPages: b.total_pages,
      uploadedBy: b.uploaded_by,
      r2Key: b.r2_key,
      coverDataUrl: b.cover_data_url,
      coverUrl: b.cover_url,
      createdAt: b.created_at,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).json({ error: 'Failed to retrieve books.' });
  }
});

// GET /api/books/:id - Get a single book
booksRouter.get('/:id', authenticateToken, (req, res) => {
  try {
    const book = db.get('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    res.json({
      id: book.id,
      title: book.title,
      author: book.author,
      fileName: book.file_name,
      fileType: book.file_type,
      size: book.file_size,
      totalPages: book.total_pages,
      uploadedBy: book.uploaded_by,
      r2Key: book.r2_key,
      coverDataUrl: book.cover_data_url,
      coverUrl: book.cover_url,
      createdAt: book.created_at,
    });
  } catch (err) {
    console.error('Error fetching book:', err);
    res.status(500).json({ error: 'Failed to retrieve book.' });
  }
});

// POST /api/books/upload - Upload a PDF book to Supabase Storage
booksRouter.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No PDF file was provided.' });
    }

    const {
      title,
      author,
      totalPages,
      coverDataUrl,
    } = req.body;

    const bookId = uid('book');
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `books/${req.user.id}/${bookId}/${safeName}`;
    const createdAt = new Date().toISOString();

    console.log(`[Upload] Uploading book "${title || file.originalname}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) to Supabase Storage: ${storageKey}`);

    // Upload PDF to Supabase Storage
    const uploadResult = await supabaseStorage.upload(storageKey, file.buffer, 'application/pdf');

    const bookTitle = (title && title.trim()) || file.originalname.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Book';
    const bookAuthor = (author && author.trim()) || 'Unknown author';
    const pages = parseInt(totalPages || '0', 10) || 0;

    // Save to Database
    db.run(
      `INSERT INTO books (
        id, title, author, file_name, file_type, file_size,
        total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookId,
        bookTitle,
        bookAuthor,
        file.originalname,
        file.mimetype || 'application/pdf',
        file.size,
        pages,
        req.user.id,
        storageKey,
        coverDataUrl || null,
        uploadResult.url || null,
        createdAt,
      ]
    );

    const savedBook = {
      id: bookId,
      title: bookTitle,
      author: bookAuthor,
      fileName: file.originalname,
      fileType: file.mimetype || 'application/pdf',
      size: file.size,
      totalPages: pages,
      uploadedBy: req.user.id,
      r2Key: storageKey,
      coverDataUrl: coverDataUrl || null,
      coverUrl: uploadResult.url || null,
      storageType: uploadResult.storageType,
      createdAt,
    };

    res.status(201).json(savedBook);
  } catch (err) {
    console.error('Book upload error:', err);
    res.status(500).json({ error: `Upload failed: ${err.message}` });
  }
});

// GET /api/books/:id/file - Stream PDF file directly from Supabase Storage
booksRouter.get('/:id/file', optionalToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = db.get('SELECT * FROM books WHERE id = ?', [bookId]);

    if (!book) {
      return res.status(404).json({ error: 'Book file not found.' });
    }

    const range = req.headers.range;
    const { stream, contentLength, contentRange, contentType, statusCode } = await supabaseStorage.getStream(
      book.r2_key,
      range
    );

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(book.file_name)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }

    res.status(statusCode || 200);
    stream.pipe(res);
  } catch (err) {
    console.error(`Error streaming book file ${req.params.id}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Could not retrieve book file: ${err.message}` });
    }
  }
});

// PUT /api/books/:id - Update book metadata
booksRouter.put('/:id', authenticateToken, (req, res) => {
  try {
    const book = db.get('SELECT * FROM books WHERE id = ? AND uploaded_by = ?', [req.params.id, req.user.id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found or access denied.' });
    }

    const { title, author, totalPages, coverDataUrl } = req.body;
    const updates = [];
    const params = [];

    if (title) {
      updates.push('title = ?');
      params.push(title.trim());
    }
    if (author !== undefined) {
      updates.push('author = ?');
      params.push(author.trim());
    }
    if (totalPages) {
      updates.push('total_pages = ?');
      params.push(parseInt(totalPages, 10));
    }
    if (coverDataUrl !== undefined) {
      updates.push('cover_data_url = ?');
      params.push(coverDataUrl);
    }

    if (updates.length === 0) {
      return res.json(book);
    }

    params.push(req.params.id);
    db.run(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = db.get('SELECT * FROM books WHERE id = ?', [req.params.id]);
    res.json({
      id: updated.id,
      title: updated.title,
      author: updated.author,
      fileName: updated.file_name,
      fileType: updated.file_type,
      size: updated.file_size,
      totalPages: updated.total_pages,
      uploadedBy: updated.uploaded_by,
      r2Key: updated.r2_key,
      coverDataUrl: updated.cover_data_url,
      coverUrl: updated.cover_url,
      createdAt: updated.created_at,
    });
  } catch (err) {
    console.error('Error updating book:', err);
    res.status(500).json({ error: 'Failed to update book.' });
  }
});

// DELETE /api/books/:id - Delete book from database and Supabase Storage
booksRouter.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = db.get('SELECT * FROM books WHERE id = ? AND uploaded_by = ?', [bookId, req.user.id]);

    if (!book) {
      return res.status(404).json({ error: 'Book not found or permission denied.' });
    }

    // 1. Delete object from Supabase storage
    if (book.r2_key) {
      await supabaseStorage.delete(book.r2_key);
    }

    // 2. Cascade delete from database
    db.run('DELETE FROM reading_progress WHERE book_id = ?', [bookId]);
    db.run('DELETE FROM highlights WHERE book_id = ?', [bookId]);
    db.run('DELETE FROM reading_plans WHERE book_id = ?', [bookId]);
    db.run('DELETE FROM books WHERE id = ?', [bookId]);

    console.log(`[Delete] Successfully deleted book ${bookId} ("${book.title}") from database and Supabase Storage`);
    res.json({ message: 'Book and all associated data deleted successfully.' });
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});
