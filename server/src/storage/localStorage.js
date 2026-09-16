import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root uploads directory on local server disk
const uploadsDir = config.isVercel
  ? '/tmp/uploads'
  : path.resolve(__dirname, '../../uploads');

// Ensure base uploads directory exists
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('[LocalStorage] Could not initialize base uploads directory:', err.message);
}

/**
 * High-performance Local Server Disk Storage for ReedShelf PDF books.
 * Delivers zero-latency file writes, instant range-based PDF streaming,
 * and reliable offline/LAN reading without external cloud timeouts.
 */
export const localStorageService = {
  getUploadsDir() {
    return uploadsDir;
  },

  /**
   * Resolve an absolute filesystem path from a storage key or relative path
   */
  resolvePath(storageKey) {
    if (!storageKey) return null;
    if (path.isAbsolute(storageKey)) return storageKey;
    // Strip leading "uploads/" if present to prevent double nesting
    const cleanKey = storageKey.replace(/^uploads[/\\]/, '');
    return path.join(uploadsDir, cleanKey);
  },

  /**
   * Save a book file buffer to local disk
   */
  async saveBookFile({ userId, bookId, fileName, buffer, mimetype = 'application/pdf' }) {
    const safeUser = String(userId || 'default_user').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeBook = String(bookId || 'book').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = String(fileName || 'book.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');

    const userDir = path.join(uploadsDir, 'books', safeUser);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const storedFileName = `${safeBook}_${safeName}`;
    const destinationPath = path.join(userDir, storedFileName);
    const storageKey = `uploads/books/${safeUser}/${storedFileName}`;

    await fs.promises.writeFile(destinationPath, buffer);
    console.log(`[LocalStorage] Successfully saved book file to disk (${(buffer.length / (1024 * 1024)).toFixed(2)} MB): ${destinationPath}`);

    return {
      storageKey,
      filePath: destinationPath,
      size: buffer.length,
      fileName,
      fileType: mimetype,
      storageType: 'local',
    };
  },

  /**
   * Get file stream with HTTP 206 Range support for fast PDF page rendering
   */
  async getStream(storageKey, rangeHeader) {
    const filePath = this.resolvePath(storageKey);
    let resolved = filePath;

    if (!resolved || !fs.existsSync(resolved)) {
      // Check if it exists as flat file in uploads dir
      const flatName = path.basename(storageKey || '');
      const altPath = path.join(uploadsDir, flatName);
      if (fs.existsSync(altPath)) {
        resolved = altPath;
      } else {
        // Also check if stored with underscores
        const underscorePath = path.join(uploadsDir, (storageKey || '').replace(/\//g, '_'));
        if (fs.existsSync(underscorePath)) {
          resolved = underscorePath;
        } else {
          throw new Error(`Book file not found on server disk: ${storageKey}`);
        }
      }
    }

    const stat = await fs.promises.stat(resolved);
    const totalSize = stat.size;

    // Handle partial range request for PDF page streaming
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        return {
          stream: Readable.from(Buffer.alloc(0)),
          contentLength: 0,
          contentRange: `bytes */${totalSize}`,
          contentType: 'application/pdf',
          statusCode: 416, // Range Not Satisfiable
        };
      }

      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(resolved, { start, end });

      return {
        stream,
        contentLength: chunkSize,
        contentRange: `bytes ${start}-${end}/${totalSize}`,
        contentType: 'application/pdf',
        statusCode: 206,
      };
    }

    // Full file stream
    const stream = fs.createReadStream(resolved);
    return {
      stream,
      contentLength: totalSize,
      contentType: 'application/pdf',
      statusCode: 200,
    };
  },

  /**
   * Delete a book file from local disk
   */
  async deleteBookFile(storageKey) {
    try {
      const filePath = this.resolvePath(storageKey);
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`[LocalStorage] Deleted book file from disk: ${filePath}`);
        return true;
      }
    } catch (err) {
      console.warn('[LocalStorage] Error deleting file:', err.message);
    }
    return false;
  },

  /**
   * Check if file exists on disk
   */
  fileExists(storageKey) {
    const filePath = this.resolvePath(storageKey);
    return Boolean(filePath && fs.existsSync(filePath));
  }
};
