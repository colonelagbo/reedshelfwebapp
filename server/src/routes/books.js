import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../db.js';
import { localStorageService } from '../storage/localStorage.js';
import { r2Storage } from '../storage/r2.js';
import { supabaseStorage, getSupabaseClient } from '../storage/supabase.js';
import { authenticateToken, optionalToken } from '../middleware/auth.js';
import { recordBook, removeBookFromCloud } from '../storage/cloudSync.js';
import { config } from '../config.js';

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
    let usedBytes = 0;
    let totalBooks = 0;
    let fromSupabase = false;

    // 1. Fetch live storage usage from Supabase PostgreSQL if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let query = supabase.from('books').select('file_size, uploaded_by');
        if (!isUserAdmin) {
          query = query.or(`uploaded_by.eq.${req.user.id},uploaded_by.eq.demo_user`);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          usedBytes = data.reduce((sum, b) => sum + Number(b.file_size || 0), 0);
          totalBooks = data.length;
          fromSupabase = true;
        }
      } catch (sbErr) {
        // Fallback to local SQLite below
      }
    }

    // 2. Fallback to local SQLite
    if (!fromSupabase) {
      const usageRow = db.get(
        'SELECT COALESCE(SUM(file_size), 0) as totalBytes, COUNT(id) as totalBooks FROM books WHERE uploaded_by = ?',
        [req.user.id]
      );
      usedBytes = Number(usageRow?.totalBytes || 0);
      totalBooks = Number(usageRow?.totalBooks || 0);

      // If admin has not yet uploaded books under their specific ID, count managed library books
      if (isUserAdmin && totalBooks === 0) {
        const allRow = db.get('SELECT COALESCE(SUM(file_size), 0) as totalBytes, COUNT(id) as totalBooks FROM books');
        usedBytes = Number(allRow?.totalBytes || 0);
        totalBooks = Number(allRow?.totalBooks || 0);
      }
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

// GET /api/books/storage-config - Cloud storage configuration for direct client uploads
booksRouter.get('/storage-config', optionalToken, async (req, res) => {
  try {
    const isConfigured = config.isSupabaseConfigured();
    res.json({
      configured: isConfigured,
      url: config.supabase.url || 'https://xiiemdxbdrlzpvhaecmt.supabase.co',
      key: config.supabase.key || '',
      bucketName: config.supabase.bucketName || 'reedshelf-books',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve storage configuration.' });
  }
});

// GET /api/books - Get user's books (synchronized with Supabase PostgreSQL and cached locally)
booksRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const isUserAdmin = req.user.role === 'admin';
    const supabase = getSupabaseClient();

    // 1. Fetch live books from Supabase PostgreSQL if configured
    if (supabase) {
      try {
        let query = supabase.from('books').select('*').order('created_at', { ascending: false });
        if (!isUserAdmin) {
          query = query.or(`uploaded_by.eq.${req.user.id},uploaded_by.eq.demo_user`);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          // Sync into local SQLite database for fast offline fallback
          for (const b of data) {
            try {
              db.run(
                `INSERT INTO books (id, title, author, file_name, file_type, file_size, total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET title=excluded.title, author=excluded.author, file_size=excluded.file_size, total_pages=excluded.total_pages, r2_key=excluded.r2_key, cover_data_url=excluded.cover_data_url, cover_url=excluded.cover_url`,
                [b.id, b.title, b.author, b.file_name, b.file_type || 'application/pdf', b.file_size || 0, b.total_pages || 0, b.uploaded_by, b.r2_key, b.cover_data_url || null, b.cover_url || null, b.created_at]
              );
            } catch {}
          }
          return res.json(data.map(formatBookRow));
        }
      } catch (sbErr) {
        console.warn('[Supabase Books Fetch Notice]:', sbErr.message);
      }
    }

    // 2. Fallback to local SQLite database
    const localBooks = isUserAdmin
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
    res.status(500).json({ error: 'Failed to retrieve book.' });
  }
});

// POST /api/books/upload-url - Generate presigned upload URL for direct Cloudflare R2 upload
booksRouter.post('/upload-url', authenticateToken, async (req, res) => {
  try {
    const { fileName, fileSize, contentType } = req.body;
    const size = Number(fileSize || 0);

    // 1. Quota check (50 MB allotted per account)
    const usageRow = db.get(
      'SELECT COALESCE(SUM(file_size), 0) as totalBytes FROM books WHERE uploaded_by = ?',
      [req.user.id]
    );
    const currentUsedBytes = Number(usageRow?.totalBytes || 0);

    if (currentUsedBytes + size > ACCOUNT_STORAGE_LIMIT_BYTES) {
      const currentUsedMB = (currentUsedBytes / (1024 * 1024)).toFixed(1);
      const newFileSizeMB = (size / (1024 * 1024)).toFixed(1);
      const remainingMB = Math.max(0, (ACCOUNT_STORAGE_LIMIT_BYTES - currentUsedBytes) / (1024 * 1024)).toFixed(1);
      return res.status(400).json({
        error: `Account storage limit exceeded! Each account has 50 MB allotted. You have used ${currentUsedMB} MB (${remainingMB} MB remaining). This book is ${newFileSizeMB} MB. Please delete existing books to free up space.`
      });
    }

    const bookId = uid('book');
    const safeName = (fileName || 'book.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `books/${req.user.id}/${bookId}/${safeName}`;
    const mime = contentType || 'application/pdf';

    // 2. If Cloudflare R2 is configured, generate presigned PUT URL
    if (config.isR2Configured()) {
      const uploadUrl = await r2Storage.getPresignedUploadUrl(storageKey, mime, 3600);
      if (uploadUrl) {
        return res.json({
          bookId,
          storageKey,
          uploadUrl,
          storageType: 'r2',
          method: 'PUT',
          headers: { 'Content-Type': mime }
        });
      }
    }

    // 3. Fallback: Supabase Storage or Local server upload
    return res.json({
      bookId,
      storageKey,
      uploadUrl: null,
      storageType: config.isSupabaseConfigured() ? 'supabase' : 'local',
    });
  } catch (err) {
    console.error('Error generating upload URL:', err);
    res.status(500).json({ error: `Failed to prepare upload: ${err.message}` });
  }
});

// POST /api/books/upload - Upload a PDF book to Cloudflare R2 or Local Server Storage
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
    const createdAt = new Date().toISOString();

    const bookTitle = (title && title.trim()) || file.originalname.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Book';
    const bookAuthor = (author && author.trim()) || 'Unknown author';
    const pages = parseInt(totalPages || '0', 10) || 0;

    let storageKey;
    let fileUrl = `/api/books/${bookId}/file`;
    let storageType = 'local';

    // 1. If Cloudflare R2 is configured, save directly to R2 bucket
    if (config.isR2Configured()) {
      storageKey = `books/${req.user.id}/${bookId}/${safeName}`;
      await r2Storage.upload(storageKey, file.buffer, file.mimetype || 'application/pdf');
      storageType = 'r2';
      console.log(`[Upload] Successfully stored book "${bookTitle}" in Cloudflare R2: ${storageKey}`);
    } else {
      // Fallback to local server disk storage
      console.log(`[Upload] Saving book "${bookTitle}" to Local Server Storage...`);
      const storageResult = await localStorageService.saveBookFile({
        userId: req.user.id,
        bookId,
        fileName: file.originalname,
        buffer: file.buffer,
        mimetype: file.mimetype || 'application/pdf',
      });
      storageKey = storageResult.storageKey;
      storageType = 'local';
    }

    // 2. Persist to local database
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
        fileUrl,
        createdAt,
      ]
    );

    // 3. Sync with Supabase PostgreSQL
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('books').upsert({
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
          cover_url: fileUrl,
          created_at: createdAt,
        });
      } catch (sbErr) {
        console.warn('[Supabase PostgreSQL Sync Warning]:', sbErr.message);
      }
    }

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
      coverUrl: fileUrl,
      signedUrl: fileUrl,
      storageType,
      createdAt,
    };

    console.log(`[Upload] Successfully stored book "${bookTitle}" locally with ID ${bookId}`);
    res.status(201).json(savedBook);
  } catch (err) {
    console.error('Book upload error:', err);
    res.status(500).json({ error: `Upload failed: ${err.message}` });
  }
});

// POST /api/books/record - Record book metadata after direct cloud storage upload (bypasses Vercel 4.5MB payload limit)
booksRouter.post('/record', authenticateToken, async (req, res) => {
  try {
    const {
      id,
      title,
      author,
      fileName,
      fileType,
      size,
      totalPages,
      r2Key,
      storageKey,
      coverDataUrl,
      coverUrl,
    } = req.body;

    const bookId = id || uid('book');
    const finalStorageKey = r2Key || storageKey || `books/${req.user.id}/${bookId}/${(fileName || 'book.pdf').replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const fileSize = Number(size || 0);

    // Storage quota check: 50 MB allotted per account
    const usageRow = db.get(
      'SELECT COALESCE(SUM(file_size), 0) as totalBytes FROM books WHERE uploaded_by = ?',
      [req.user.id]
    );
    const currentUsedBytes = Number(usageRow?.totalBytes || 0);

    if (currentUsedBytes + fileSize > ACCOUNT_STORAGE_LIMIT_BYTES) {
      const currentUsedMB = (currentUsedBytes / (1024 * 1024)).toFixed(1);
      const newFileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      const remainingMB = Math.max(0, (ACCOUNT_STORAGE_LIMIT_BYTES - currentUsedBytes) / (1024 * 1024)).toFixed(1);
      return res.status(400).json({
        error: `Account storage limit exceeded! Each account has 50 MB allotted. You have used ${currentUsedMB} MB (${remainingMB} MB remaining). This book is ${newFileSizeMB} MB. Please delete existing books to free up space.`
      });
    }

    const createdAt = new Date().toISOString();
    const bookTitle = (title && title.trim()) || (fileName ? fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() : 'Untitled Book');
    const bookAuthor = (author && author.trim()) || 'Unknown author';
    const pages = parseInt(totalPages || '0', 10) || 0;
    const finalCoverUrl = coverUrl || `/api/books/${bookId}/file`;

    // 1. Persist to local database
    db.run(
      `INSERT INTO books (
        id, title, author, file_name, file_type, file_size,
        total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookId,
        bookTitle,
        bookAuthor,
        fileName || 'book.pdf',
        fileType || 'application/pdf',
        fileSize,
        pages,
        req.user.id,
        finalStorageKey,
        coverDataUrl || null,
        finalCoverUrl,
        createdAt,
      ]
    );

    // 2. Also register in cloud storage sync metadata
    const savedBook = {
      id: bookId,
      title: bookTitle,
      author: bookAuthor,
      fileName: fileName || 'book.pdf',
      fileType: fileType || 'application/pdf',
      size: fileSize,
      totalPages: pages,
      uploadedBy: req.user.id,
      r2Key: finalStorageKey,
      coverDataUrl: coverDataUrl || null,
      coverUrl: finalCoverUrl,
      signedUrl: finalCoverUrl,
      storageType: 'supabase',
      createdAt,
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('books').upsert({
          id: bookId,
          title: bookTitle,
          author: bookAuthor,
          file_name: fileName || 'book.pdf',
          file_type: fileType || 'application/pdf',
          file_size: fileSize,
          total_pages: pages,
          uploaded_by: req.user.id,
          r2_key: finalStorageKey,
          cover_data_url: coverDataUrl || null,
          cover_url: finalCoverUrl,
          created_at: createdAt,
        });
      } catch (sbErr) {
        console.warn('[Supabase Sync Warning] Could not sync to Supabase table:', sbErr.message);
      }
    }

    console.log(`[Record] Successfully recorded book "${bookTitle}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB) for user ${req.user.id}`);
    res.status(201).json(savedBook);
  } catch (err) {
    console.error('Book record error:', err);
    res.status(500).json({ error: `Failed to record book: ${err.message}` });
  }
});

// GET /api/books/:id/file - Stream PDF file directly from Local Storage or redirect to high-speed CDN
booksRouter.get('/:id/file', optionalToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    let book = db.get('SELECT * FROM books WHERE id = ?', [bookId]);

    if (!book) {
      return res.status(404).json({ error: 'Book file not found.' });
    }

    const range = req.headers.range;
    const storageKey = book.r2_key || book.r2Key;

    // 1. If Cloudflare R2 is configured, redirect to presigned R2 URL or stream
    if (config.isR2Configured() && storageKey) {
      try {
        const presigned = await r2Storage.getPresignedUrl(storageKey, 86400);
        if (presigned) {
          return res.redirect(302, presigned);
        }
      } catch (r2Err) {
        console.warn('[R2 Streaming Notice]:', r2Err.message);
      }
    }

    // 2. If file exists on local disk storage, stream directly with range support
    if (storageKey && localStorageService.fileExists(storageKey)) {
      const { stream, contentLength, contentRange, contentType, statusCode } = await localStorageService.getStream(
        storageKey,
        range
      );

      res.setHeader('Content-Type', contentType || 'application/pdf');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(book.file_name || book.fileName || 'book.pdf')}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      if (contentLength !== undefined) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);

      res.status(statusCode || 200);
      return stream.pipe(res);
    }

    // 2. Direct high-speed CDN redirect for Supabase Storage (zero serverless memory or latency)
    if (storageKey) {
      const client = getSupabaseClient();
      if (client) {
        const { data } = client.storage.from(config.supabase.bucketName).getPublicUrl(storageKey);
        if (data?.publicUrl) {
          return res.redirect(302, data.publicUrl);
        }
      }
    }

    // 3. If book has direct coverUrl pointing to CDN, redirect
    if (book.cover_url && book.cover_url.startsWith('http')) {
      return res.redirect(302, book.cover_url);
    }

    return res.status(404).json({ error: 'Book file not found on storage.' });
  } catch (err) {
    console.error(`Error streaming book file ${req.params.id}:`, err.message);
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

    // 1. Delete object from Cloudflare R2, Local Server Storage, and Supabase Storage
    if (storageKey) {
      if (config.isR2Configured()) {
        try {
          await r2Storage.delete(storageKey);
        } catch {}
      }
      await localStorageService.deleteBookFile(storageKey);
      try {
        await supabaseStorage.delete(storageKey);
      } catch {}
    }

    // 2. Cascade delete from local DB
    db.run('DELETE FROM reading_progress WHERE book_id = ?', [bookId]);
    db.run('DELETE FROM highlights WHERE book_id = ?', [bookId]);
    db.run('DELETE FROM reading_plans WHERE book_id = ?', [bookId]);
    db.run('DELETE FROM books WHERE id = ?', [bookId]);

    // 3. Cascade delete from Supabase PostgreSQL
    if (supabase) {
      try {
        await supabase.from('reading_progress').delete().eq('book_id', bookId);
        await supabase.from('highlights').delete().eq('book_id', bookId);
        await supabase.from('reading_plans').delete().eq('book_id', bookId);
        await supabase.from('books').delete().eq('id', bookId);
      } catch {}
    }

    console.log(`[Delete] Successfully deleted book ${bookId} ("${book.title}") from local storage and database`);
    res.json({ message: 'Book and all associated data deleted successfully.' });
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});
