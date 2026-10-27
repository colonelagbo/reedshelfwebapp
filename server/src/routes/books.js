import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../db.js';
import { localStorageService } from '../storage/localStorage.js';
import { r2Storage } from '../storage/r2.js';
import { supabaseStorage, getSupabaseClient } from '../storage/supabase.js';
import { authenticateToken, optionalToken } from '../middleware/auth.js';
import { recordBook, removeBookFromCloud, syncBooksFromCloud } from '../storage/cloudSync.js';
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
  const coverUrl = b.cover_url || b.coverUrl || null;
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
    coverUrl,
    createdAt: b.created_at || b.createdAt,
    currentPage: Number(b.current_page || b.currentPage || 1),
    progressUpdatedAt: b.progress_updated_at || b.progressUpdatedAt || null,
  };
}

// GET /api/books/storage-usage - Get current account storage consumption
booksRouter.get('/storage-usage', authenticateToken, async (req, res) => {
  try {
    let usedBytes = 0;
    let totalBooks = 0;

    // 1. Local database usage strictly for authenticated user
    const usageRow = db.get(
      'SELECT COALESCE(SUM(file_size), 0) as totalBytes, COUNT(id) as totalBooks FROM books WHERE uploaded_by = ?',
      [req.user.id]
    );
    usedBytes = Number(usageRow?.totalBytes || 0);
    totalBooks = Number(usageRow?.totalBooks || 0);

    // 2. Cross-check Supabase PostgreSQL if configured
    if (config.isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('books')
            .select('file_size, uploaded_by')
            .eq('uploaded_by', req.user.id);
          if (!error && Array.isArray(data) && data.length > 0) {
            const sbUsedBytes = data.reduce((sum, b) => sum + Number(b.file_size || 0), 0);
            usedBytes = Math.max(usedBytes, sbUsedBytes);
            totalBooks = Math.max(totalBooks, data.length);
          }
        } catch (sbErr) {
          // Fallback to local database counts
        }
      }
    }

    // 3. Cross-check persistent bucket metadata
    try {
      const cloudMetadata = await supabaseStorage.getMetadata('books.json');
      if (Array.isArray(cloudMetadata)) {
        let metaUsed = 0;
        let metaCount = 0;
        for (const b of cloudMetadata) {
          const owner = b.uploadedBy || b.uploaded_by;
          if (owner === req.user.id) {
            metaUsed += Number(b.size || b.file_size || 0);
            metaCount++;
          }
        }
        usedBytes = Math.max(usedBytes, metaUsed);
        totalBooks = Math.max(totalBooks, metaCount);
      }
    } catch {}

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
      url: isConfigured ? config.supabase.url : '',
      key: isConfigured ? config.supabase.key : '',
      bucketName: config.supabase.bucketName || 'reedshelf-books',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve storage configuration.' });
  }
});

// Cache timestamp for cloud sync throttle per server instance
let lastCloudBooksSyncTime = 0;
const BOOKS_SYNC_INTERVAL = 15000; // 15 seconds throttle

// GET /api/books - Get user's personal books (strict user isolation + fast local response + background sync)
booksRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Helper to query books from local database with strict user isolation and reading progress
    const queryLocalBooks = () => {
      const rows = db.all(
        'SELECT id, title, author, file_name, file_type, file_size, total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at FROM books WHERE uploaded_by = ? ORDER BY created_at DESC',
        [userId]
      );
      return rows.map((b) => {
        const prog = db.get('SELECT page, updated_at FROM reading_progress WHERE user_id = ? AND book_id = ?', [userId, b.id]);
        return formatBookRow({
          ...b,
          currentPage: prog?.page || 1,
          progressUpdatedAt: prog?.updated_at || null,
        });
      });
    };

    let localBooks = queryLocalBooks();
    const now = Date.now();

    // Fast Path: If local database already has books and was synced recently, return immediately (<5ms)
    if (localBooks.length > 0 && now - lastCloudBooksSyncTime < BOOKS_SYNC_INTERVAL) {
      return res.json(localBooks);
    }

    // If local database has 0 books (cold start on serverless or new instance), sync synchronously
    if (localBooks.length === 0) {
      try {
        await Promise.race([
          syncBooksFromCloud(true),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 2500))
        ]);
        lastCloudBooksSyncTime = Date.now();
        localBooks = queryLocalBooks();
      } catch (syncErr) {
        console.warn('[SyncBooks Notice]:', syncErr.message);
      }
    } else {
      // Background non-blocking sync so user gets instant response
      lastCloudBooksSyncTime = now;
      syncBooksFromCloud().catch((err) => console.warn('[BgSyncBooks Warning]:', err.message));
    }

    res.json(localBooks);
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
    } else if (config.isSupabaseConfigured()) {
      // 2. Direct upload to Supabase Storage bucket
      storageKey = `books/${req.user.id}/${bookId}/${safeName}`;
      console.log(`[Upload] Uploading book "${bookTitle}" directly to Supabase Storage bucket "${config.supabase.bucketName}"...`);
      const sbResult = await supabaseStorage.upload(storageKey, file.buffer, file.mimetype || 'application/pdf');
      storageKey = sbResult.key;
      storageType = 'supabase';
      fileUrl = sbResult.publicUrl || sbResult.url || `/api/books/${bookId}/file`;
      console.log(`[Upload] Successfully stored book "${bookTitle}" in Supabase Storage: ${storageKey}`);
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

    // Persist book metadata to cloud storage bucket
    try {
      await recordBook(savedBook);
    } catch (e) {
      console.warn('[Cloud Metadata Record Error]:', e.message);
    }

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
    let finalCoverUrl = coverUrl;
    if (!finalCoverUrl || finalCoverUrl.endsWith('/file') || finalCoverUrl.toLowerCase().endsWith('.pdf')) {
      finalCoverUrl = `/api/books/${bookId}/cover`;
    }

    if (coverDataUrl && coverDataUrl.startsWith('data:image/') && (!coverUrl || !coverUrl.match(/\.(webp|jpe?g|png)($|\?)/i))) {
      try {
        const matches = coverDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const ext = contentType.includes('webp') ? 'webp' : 'jpg';
          const coverKey = `covers/${bookId}.${ext}`;
          const client = getSupabaseClient();
          if (client) {
            await client.storage.from(config.supabase.bucketName || 'reedshelf-books').upload(coverKey, buffer, { contentType, upsert: true });
            const { data: cData } = client.storage.from(config.supabase.bucketName || 'reedshelf-books').getPublicUrl(coverKey);
            if (cData?.publicUrl) finalCoverUrl = cData.publicUrl;
          }
        }
      } catch (cErr) {
        console.warn('Could not persist cover image to storage:', cErr.message);
      }
    }

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

    try {
      await recordBook(savedBook);
    } catch (e) {
      console.warn('[Cloud Metadata Record Error]:', e.message);
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
    if (config.isSupabaseConfigured() && storageKey) {
      const client = getSupabaseClient();
      if (client) {
        const { data } = client.storage.from(config.supabase.bucketName || 'reedshelf-books').getPublicUrl(storageKey);
        if (data?.publicUrl) {
          return res.redirect(302, data.publicUrl);
        }
      }
    }

    // 3. If book has direct coverUrl pointing to CDN, redirect
    if (book.cover_url && book.cover_url.startsWith('http') && !book.cover_url.match(/\.(jpe?g|png|webp|gif|svg)($|\?)/i)) {
      return res.redirect(302, book.cover_url);
    }

    return res.status(404).json({ error: 'Book file not found on storage. Please re-attach the PDF.' });
  } catch (err) {
    console.error(`Error streaming book file ${req.params.id}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: `Could not retrieve book file: ${err.message}` });
    }
  }
});

// GET /api/books/:id/cover - Stream or redirect to high-resolution original book cover image
booksRouter.get('/:id/cover', optionalToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    let book = db.get('SELECT * FROM books WHERE id = ?', [bookId]);

    if (!book) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('books').select('*').eq('id', bookId).single();
          if (data) book = data;
        } catch {}
      }
    }

    if (!book) {
      return res.status(404).json({ error: 'Book cover not found.' });
    }

    // 1. If book has a direct cover image URL (ends with .webp, .jpg, .png)
    if (book.cover_url && book.cover_url.match(/\.(webp|jpe?g|png|gif|svg)($|\?)/i)) {
      return res.redirect(302, book.cover_url);
    }

    // 2. Check Supabase Storage for covers/:id.webp
    const client = getSupabaseClient();
    if (client) {
      const { data: pubData } = client.storage.from(config.supabase.bucketName || 'reedshelf-books').getPublicUrl(`covers/${bookId}.webp`);
      if (pubData?.publicUrl) {
        return res.redirect(302, pubData.publicUrl);
      }
    }

    // 3. Fallback to cover_data_url if base64
    if (book.cover_data_url && book.cover_data_url.startsWith('data:image/')) {
      const matches = book.cover_data_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      }
    }

    return res.status(404).json({ error: 'Cover not available.' });
  } catch (err) {
    console.error('Error fetching cover:', err.message);
    res.status(500).json({ error: 'Failed to retrieve cover.' });
  }
});

// POST /api/books/:id/file - Upload / re-attach PDF file for an existing book
booksRouter.post('/:id/file', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const bookId = req.params.id;
    const isUserAdmin = req.user.role === 'admin';
    let book = isUserAdmin
      ? db.get('SELECT * FROM books WHERE id = ?', [bookId])
      : db.get('SELECT * FROM books WHERE id = ? AND uploaded_by = ?', [bookId, req.user.id]);

    if (!book) {
      return res.status(404).json({ error: 'Book not found or access denied.' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No PDF file provided.' });
    }

    const storageResult = await localStorageService.saveBookFile({
      userId: book.uploaded_by || req.user.id,
      bookId,
      fileName: file.originalname || book.file_name || 'book.pdf',
      buffer: file.buffer,
      mimetype: file.mimetype || 'application/pdf',
    });

    const fileUrl = `/api/books/${bookId}/file`;
    db.run(
      'UPDATE books SET r2_key = ?, file_name = ?, file_size = ?, cover_url = ? WHERE id = ?',
      [storageResult.storageKey, file.originalname || book.file_name, file.size, fileUrl, bookId]
    );

    const updated = db.get('SELECT * FROM books WHERE id = ?', [bookId]);
    console.log(`[Reattach] Successfully attached PDF for book "${book.title}" (${bookId}) to disk: ${storageResult.storageKey}`);
    res.json(formatBookRow(updated));
  } catch (err) {
    console.error('Error re-attaching book file:', err);
    res.status(500).json({ error: `Failed to save book file: ${err.message}` });
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

    // 4. Remove from cloud bucket metadata
    try {
      await removeBookFromCloud(bookId);
    } catch {}

    console.log(`[Delete] Successfully deleted book ${bookId} ("${book.title}") from local storage and database`);
    res.json({ message: 'Book and all associated data deleted successfully.' });
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});
