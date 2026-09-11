import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local fallback directory if Supabase credentials are not configured yet
const localUploadsDir = config.isVercel
  ? '/tmp/uploads'
  : path.resolve(__dirname, '../../uploads');

try {
  if (!fs.existsSync(localUploadsDir)) {
    fs.mkdirSync(localUploadsDir, { recursive: true });
  }
} catch (e) {
  // Safe on read-only serverless filesystems
}

let supabaseClient = null;
let bucketChecked = false;

function getSupabaseClient() {
  if (!supabaseClient && config.isSupabaseConfigured()) {
    supabaseClient = createClient(config.supabase.url, config.supabase.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        transport: WebSocket,
      },
    });
    console.log(`[Supabase] Client initialized for ${config.supabase.url} (bucket: ${config.supabase.bucketName})`);
  }
  return supabaseClient;
}

async function ensureBucket() {
  if (bucketChecked) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data: buckets, error } = await client.storage.listBuckets();
    if (!error && buckets) {
      const exists = buckets.some((b) => b.name === config.supabase.bucketName);
      if (!exists) {
        console.log(`[Supabase] Creating storage bucket "${config.supabase.bucketName}"...`);
        await client.storage.createBucket(config.supabase.bucketName, {
          public: true,
          fileSizeLimit: 104857600, // 100MB limit
        });
      }
    }
    bucketChecked = true;
  } catch (err) {
    console.warn('[Supabase Warning] Could not verify/create bucket:', err.message);
  }
}

export const supabaseStorage = {
  /**
   * Upload a file buffer to Supabase Storage
   * @param {string} key - File storage path (e.g. "books/user_123/book_456.pdf")
   * @param {Buffer|Uint8Array} body - File contents
   * @param {string} contentType - Content type (e.g. "application/pdf")
   * @returns {Promise<{ key: string, url: string, storageType: 'supabase' | 'local' }>}
   */
  async upload(key, body, contentType = 'application/pdf') {
    const client = getSupabaseClient();

    if (client) {
      await ensureBucket();
      try {
        const { error } = await client.storage
          .from(config.supabase.bucketName)
          .upload(key, body, {
            contentType,
            upsert: true,
          });

        if (error) {
          throw new Error(error.message);
        }

        const { data: publicUrlData } = client.storage
          .from(config.supabase.bucketName)
          .getPublicUrl(key);

        console.log(`[Supabase] Successfully uploaded ${key} to bucket "${config.supabase.bucketName}"`);

        return {
          key,
          url: publicUrlData?.publicUrl || `/api/books/file/${encodeURIComponent(key)}`,
          storageType: 'supabase',
        };
      } catch (err) {
        console.error(`[Supabase Error] Failed to upload ${key}:`, err.message);
        throw err;
      }
    }

    // Fallback to local disk storage
    console.warn(`[Storage Fallback] Supabase is not configured. Saving ${key} to local disk.`);
    const localPath = path.join(localUploadsDir, key.replace(/\//g, '_'));
    fs.writeFileSync(localPath, body);

    return {
      key,
      url: `/api/books/file/${encodeURIComponent(key)}`,
      storageType: 'local',
    };
  },

  /**
   * Get an object stream from Supabase Storage (or local fallback), supporting HTTP Range headers
   * @param {string} key - e.g. "books/user_123/book_456.pdf"
   * @param {string} [rangeHeader] - e.g. "bytes=0-1024"
   */
  async getStream(key, rangeHeader) {
    const client = getSupabaseClient();

    if (client) {
      try {
        const { data: blob, error } = await client.storage
          .from(config.supabase.bucketName)
          .download(key);

        if (error || !blob) {
          throw new Error(error ? error.message : 'File not found in Supabase Storage');
        }

        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const totalSize = buffer.length;

        if (rangeHeader) {
          const parts = rangeHeader.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
          const chunkSize = end - start + 1;
          const sliced = buffer.slice(start, end + 1);

          return {
            stream: Readable.from(sliced),
            contentLength: chunkSize,
            contentRange: `bytes ${start}-${end}/${totalSize}`,
            contentType: blob.type || 'application/pdf',
            statusCode: 206,
          };
        }

        return {
          stream: Readable.from(buffer),
          contentLength: totalSize,
          contentType: blob.type || 'application/pdf',
          statusCode: 200,
        };
      } catch (err) {
        console.error(`[Supabase Error] Failed to get stream for ${key}:`, err.message);
        throw err;
      }
    }

    // Local fallback stream
    const localPath = path.join(localUploadsDir, key.replace(/\//g, '_'));
    if (!fs.existsSync(localPath)) {
      throw new Error(`File not found: ${key}`);
    }

    const stat = fs.statSync(localPath);
    const totalSize = stat.size;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(localPath, { start, end });

      return {
        stream: fileStream,
        contentLength: chunkSize,
        contentRange: `bytes ${start}-${end}/${totalSize}`,
        contentType: 'application/pdf',
        statusCode: 206,
      };
    }

    return {
      stream: fs.createReadStream(localPath),
      contentLength: totalSize,
      contentType: 'application/pdf',
      statusCode: 200,
    };
  },

  /**
   * Delete a file from Supabase Storage
   * @param {string} key
   */
  async delete(key) {
    const client = getSupabaseClient();

    if (client) {
      try {
        const { error } = await client.storage
          .from(config.supabase.bucketName)
          .remove([key]);
        if (error) throw error;
        console.log(`[Supabase] Deleted ${key} from storage`);
      } catch (err) {
        console.warn(`[Supabase Warning] Could not delete ${key}:`, err.message);
      }
    }

    // Also remove local file if present
    const localPath = path.join(localUploadsDir, key.replace(/\//g, '_'));
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch (err) {
        console.warn(`[Storage Warning] Could not delete local fallback file:`, err.message);
      }
    }
  },

  /**
   * Test connection to Supabase Storage with caching and timeout
   */
  async testConnection(forceRefresh = false) {
    if (!config.isSupabaseConfigured()) {
      return {
        connected: false,
        message: 'Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_KEY in your .env file.',
        configured: false,
      };
    }

    // Return cached status if recent (within 60s)
    const now = Date.now();
    if (!forceRefresh && global.__supabaseConnectionCache && (now - (global.__supabaseLastCheck || 0) < 60000)) {
      return global.__supabaseConnectionCache;
    }

    try {
      const client = getSupabaseClient();
      // Timeout after 2.5 seconds so admin pages and health check never block the web app
      const fetchPromise = client.storage.listBuckets();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out after 2.5s')), 2500)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
      if (error) throw error;

      global.__supabaseConnectionCache = {
        connected: true,
        message: `Successfully connected to Supabase Storage (URL: ${config.supabase.url})`,
        configured: true,
        bucket: config.supabase.bucketName,
        availableBuckets: (data || []).map((b) => b.name),
      };
      global.__supabaseLastCheck = now;
      return global.__supabaseConnectionCache;
    } catch (err) {
      const fallback = {
        connected: global.__supabaseConnectionCache ? global.__supabaseConnectionCache.connected : true,
        message: global.__supabaseConnectionCache ? global.__supabaseConnectionCache.message : `Supabase configured (status check: ${err.message})`,
        configured: true,
        bucket: config.supabase.bucketName,
        error: err.name || 'ConnectionNotice',
      };
      return fallback;
    }
  },
};
