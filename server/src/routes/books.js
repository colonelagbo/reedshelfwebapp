import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../db.js';
import { supabaseStorage, getSupabaseClient } from '../storage/supabase.js';
import { authenticateToken, optionalToken } from '../middleware/auth.js';
import { syncBooksFromCloud, recordBook, removeBookFromCloud } from '../storage/cloudSync.js';

export const booksRouter = express.Router();

export const ACCOUNT_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024; // 50MB (52,428,800 bytes)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ACCOUNT_STORAGE_LIMIT_BYTES, // 50MB max upload per file
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

function formatBookRow(b) {
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    fileName: b.file_name || b.fileName,
    fileType: b.file_type || b.fileType || 'application/pdf',
    size: Number(b.file_size || b.size || 0),
    totalPages: Number(b.total_pages || b.totalPages || 0),
    uploadedBy: b.uploaded_by || b.uploadedBy,
    r2Key: b.r2_key || b.r2Key,
    coverDataUrl: b.cover_data_url || b.coverDataUrl || null,
    coverUrl: b.cover_url || b.coverUrl || null,
    createdAt: b.created_at || b.createdAt,
  };
}

// GET /api/books/storage-usage - Get current account storage consumption
booksRouter.get('/storage-usage', authenticateToken, async (req, res) => {
  try {
    const isUserAdmin = req.user.role === 'admin';
    const usageRow = db.get(
      'SELECT COALESCE(SUM(file_size), 0) as totalBytes, COUNT(id) as totalBooks FROM books WHERE uploaded_by = ?',
      [req.user.id]
    );
    let usedBytes = Number(usageRow?.totalBytes || 0);
    let totalBooks = Number(usageRow?.totalBooks || 0);

    // If admin has not yet uploaded books under their specific ID, count managed library books
    if (isUserAdmin && totalBooks === 0) {
      const allRow = db.get('SELECT COALESCE(SUM(file_size), 0) as totalBytes, COUNT(id) as totalBooks FROM books');
      usedBytes = Number(allRow?.totalBytes || 0);
      totalBooks = Number(allRow?.totalBooks || 0);
    }

    const maxBytes = ACCOUNT_STORAGE_LIMIT_BYTES;
    const remainingBytes = Math.max(0, maxBytes - usedBytes);
    const usedMB = Number((usedBytes / (1024 * 1024)).toFixed(2));
    const maxMB = 50;
    const remainingMB = Number((remainingBytes / (1024 * 1024)).toFixed(2));
    const percentUsed = Math.min(100, Number(((usedBytes / maxBytes) * 100).toFixed(1)));

    res.json({
      usedBytes,
      maxBytes,
      remainingBytes,
      usedMB,
      maxMB,
      remainingMB,
      percentUsed,
      totalBooks,
    });
  } catch (err) {
    console.error('Error fetching storage usage:', err);
    res.status(500).json({ error: 'Failed to retrieve storage usage.' });
  }
});

// GET /api/books - Get user's books
booksRouter.get('/', authenticateToken, async (req, res) => {
  try {
    await syncBooksFromCloud();
    const supabase = getSupabaseClient();
    let supabaseBooks = null;

    if (supabase) {
      try {
        let query = supabase.from('books').select('*');
        if (req.user.role !== 'admin') {
          query = query.eq('uploaded_by', req.user.id);
        }
        const { data, error } = await query.order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          supabaseBooks = data.map(formatBookRow);
          // Sync with local DB store
          for (const sb of data) {
            const existing = db.get('SELECT id FROM books WHERE id = ?', [sb.id]);
            if (!existing) {
              try {
                db.run(
                  `INSERT INTO books (id, title, author, file_name, file_type, file_size, total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [sb.id, sb.title, sb.author, sb.file_name, sb.file_type, sb.file_size, sb.total_pages, sb.uploaded_by, sb.r2_key, sb.cover_data_url, sb.cover_url, sb.created_at]
                );
              } catch {
                // Ignore sync collisions
              }
            }
          }
        }
      } catch (sbErr) {
        console.warn('[Supabase Database Warning] Could not fetch books from Supabase DB:', sbErr.message);
      }
    }

    if (supabaseBooks && supabaseBooks.length > 0) {
      return res.json(supabaseBooks);
    }

    // Fallback to local DB store
    const localBooks = (req.user.role === 'admin')
      ? db.all('SELECT id, title, author, file_name, file_type, file_size, total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at FROM books ORDER BY created_at DESC')
      : db.all(
          'SELECT id, title, author, file_name, file_type, file_size, total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at FROM books WHERE uploaded_by = ? OR uploaded_by = "demo_user" OR uploaded_by IS NULL ORDER BY created_at DESC',
          [req.user.id]
        );

    const formatted = localBooks.map(formatBookRow);
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).json({ error: 'Failed to retrieve books.' });
  }
});

// GET /api/books/:id - Get a single book
booksRouter.get('/:id', authenticateToken, async (req, res) => {
  try {
    let book = db.get('SELECT * FROM books WHERE id = ?', [req.params.id]);

    if (!book) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('books').select('*').eq('id', req.params.id).single();
          if (data) book = data;
        } catch {
          // Ignore
        }
      }
    }

    if (!book) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    // Generate fresh signed URL if needed
    const storageKey = book.r2_key || book.r2Key;
    let freshSignedUrl = null;
    if (storageKey) {
      freshSignedUrl = await supabaseStorage.getSignedUrl(storageKey, 86400);
    }

    const formatted = formatBookRow(book);
    if (freshSignedUrl) {
      formatted.signedUrl = freshSignedUrl;
      formatted.coverUrl = freshSignedUrl;
    }

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching book:', err);
    res.status(500).json({ error: 'Failed to retrieve book.' });
  }
});

// POST /api/books/upload - Upload a PDF book to Supabase Storage and Database
booksRouter.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No PDF file was provided.' });
    }

    // Storage quota check: 50 MB allotted per account
    const usageRow = db.get(
      'SELECT COALESCE(SUM(file_size), 0) as totalBytes FROM books WHERE uploaded_by = ?',
      [req.user.id]
    );
    const currentUsedBytes = Number(usageRow?.totalBytes || 0);
    const newFileSize = file.size;

    if (currentUsedBytes + newFileSize > ACCOUNT_STORAGE_LIMIT_BYTES) {
      const currentUsedMB = (currentUsedBytes / (1024 * 1024)).toFixed(1);
      const newFileSizeMB = (newFileSize / (1024 * 1024)).toFixed(1);
      const remainingMB = Math.max(0, (ACCOUNT_STORAGE_LIMIT_BYTES - currentUsedBytes) / (1024 * 1024)).toFixed(1);
      return res.status(400).json({
        error: `Account storage limit exceeded! Each account has 50 MB allotted. You have used ${currentUsedMB} MB (${remainingMB} MB remaining). This book is ${newFileSizeMB} MB. Please delete existing books to free up space.`
      });
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

    // 1. Upload PDF to Supabase Storage
    const uploadResult = await supabaseStorage.upload(storageKey, file.buffer, 'application/pdf');

    const bookTitle = (title && title.trim()) || file.originalname.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Book';
    const bookAuthor = (author && author.trim()) || 'Unknown author';
    const pages = parseInt(totalPages || '0', 10) || 0;
    const finalCoverUrl = uploadResult.url || uploadResult.signedUrl || null;

    // 2. Persist to Supabase PostgreSQL Database if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // Ensure user row exists in public.users to satisfy foreign key (uploaded_by REFERENCES users(id))
        await supabase.from('users').upsert({
          id: req.user.id,
          name: req.user.name || 'Reader',
          email: req.user.email,
          avatar: req.user.avatar || null,
          role: req.user.role || 'user',
          status: req.user.status || 'active',
          created_at: req.user.created_at || createdAt,
        }, { onConflict: 'id' });

        const { error: insertErr } = await supabase.from('books').insert({
          id: bookId,
          title: bookTitle,
          author: bookAuthor,
          file_name: file.originalname,
          file_type: file.mimetype || 'application/pdf',
          file_size: file.size,
          total_pages: pages,
          uploaded_by: req.user.id,
          r2_key: storageKey,
          cover_data_url: coverDataUrl || null,
          cover_url: finalCoverUrl,
          created_at: createdAt,
        });

        if (insertErr) {
          console.warn('[Supabase Database Warning] Note: books table insert returned:', insertErr.message);
        } else {
          console.log(`[Supabase Database] Successfully created book record in public.books: ${bookId}`);
        }
      } catch (dbErr) {
        console.warn('[Supabase Database Warning] Could not insert to Supabase DB:', dbErr.message);
      }
    }

    // 3. Save to local DB store for instantaneous sync
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
        finalCoverUrl,
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
      coverUrl: finalCoverUrl,
      signedUrl: uploadResult.signedUrl || null,
      storageType: uploadResult.storageType,
      createdAt,
    };

    await recordBook(savedBook);

    console.log(`[Upload] Successfully stored book "${bookTitle}" with ID ${bookId}`);
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
    let book = db.get('SELECT * FROM books WHERE id = ?', [bookId]);

    if (!book) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('books').select('*').eq('id', bookId).single();
          if (data) book = data;
        } catch {
          // Ignore
        }
      }
    }

    if (!book) {
      return res.status(404).json({ error: 'Book file not found.' });
    }

    const range = req.headers.range;
    const storageKey = book.r2_key || book.r2Key;
    const { stream, contentLength, contentRange, contentType, statusCode } = await supabaseStorage.getStream(
      storageKey,
      range
    );

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(book.file_name || book.fileName || 'book.pdf')}"`);
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
booksRouter.put('/:id', authenticateToken, async (req, res) => {
  try {
    const isUserAdmin = req.user.role === 'admin';
    let book = isUserAdmin
      ? db.get('SELECT * FROM books WHERE id = ?', [req.params.id])
      : db.get('SELECT * FROM books WHERE id = ? AND uploaded_by = ?', [req.params.id, req.user.id]);
    const supabase = getSupabaseClient();

    if (!book && supabase) {
      try {
        let q = supabase.from('books').select('*').eq('id', req.params.id);
        if (!isUserAdmin) {
          q = q.eq('uploaded_by', req.user.id);
        }
        const { data } = await q.single();
        if (data) book = data;
      } catch {
        // Ignore
      }
    }

    if (!book) {
      return res.status(404).json({ error: 'Book not found or access denied.' });
    }

    const { title, author, totalPages, coverDataUrl } = req.body;
    const updates = [];
    const params = [];
    const sbUpdates = {};

    if (title) {
      updates.push('title = ?');
      params.push(title.trim());
      sbUpdates.title = title.trim();
    }
    if (author !== undefined) {
      updates.push('author = ?');
      params.push(author.trim());
      sbUpdates.author = author.trim();
    }
    if (totalPages) {
      const p = parseInt(totalPages, 10);
      updates.push('total_pages = ?');
      params.push(p);
      sbUpdates.total_pages = p;
    }
    if (coverDataUrl !== undefined) {
      updates.push('cover_data_url = ?');
      params.push(coverDataUrl);
      sbUpdates.cover_data_url = coverDataUrl;
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      db.run(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`, params);

      if (supabase && Object.keys(sbUpdates).length > 0) {
        try {
          await supabase.from('books').update(sbUpdates).eq('id', req.params.id);
        } catch {
          // Supabase table update optional
        }
      }
    }

    const updated = db.get('SELECT * FROM books WHERE id = ?', [req.params.id]) || book;
    const formattedUpdated = formatBookRow(updated);
    await recordBook(formattedUpdated);
    res.json(formattedUpdated);
  } catch (err) {
    console.error('Error updating book:', err);
    res.status(500).json({ error: 'Failed to update book.' });
  }
});

// DELETE /api/books/:id - Delete book from database and Supabase Storage
booksRouter.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const isUserAdmin = req.user.role === 'admin';
    let book = isUserAdmin
      ? db.get('SELECT * FROM books WHERE id = ?', [bookId])
      : db.get('SELECT * FROM books WHERE id = ? AND uploaded_by = ?', [bookId, req.user.id]);
    const supabase = getSupabaseClient();

    if (!book && supabase) {
      try {
        let q = supabase.from('books').select('*').eq('id', bookId);
        if (!isUserAdmin) {
          q = q.eq('uploaded_by', req.user.id);
        }
        const { data } = await q.single();
        if (data) book = data;
      } catch {
        // Ignore
      }
    }

    if (!book) {
      return res.status(404).json({ error: 'Book not found or permission denied.' });
    }

    const storageKey = book.r2_key || book.r2Key;

    // 1. Delete object from Supabase storage
    if (storageKey) {
      await supabaseStorage.delete(storageKey);
    }

    // 2. Remove from cloud sync metadata
    await removeBookFromCloud(bookId);

    // 3. Cascade delete from Supabase Database if table exists
    if (supabase) {
      try {
        await supabase.from('reading_progress').delete().eq('book_id', bookId);
        await supabase.from('highlights').delete().eq('book_id', bookId);
        await supabase.from('reading_plans').delete().eq('book_id', bookId);
        await supabase.from('books').delete().eq('id', bookId);
      } catch (sbErr) {
        console.warn('[Supabase Database Warning] Could not delete from Supabase DB:', sbErr.message);
      }
    }

    // 3. Cascade delete from local DB
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
