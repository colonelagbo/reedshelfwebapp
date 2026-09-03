import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local fallback directory if Cloudflare R2 keys are not configured
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

let s3Client = null;

function getS3Client() {
  if (!s3Client && config.isR2Configured()) {
    const endpoint = `https://${config.cloudflare.accountId}.r2.cloudflarestorage.com`;
    s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.cloudflare.accessKeyId,
        secretAccessKey: config.cloudflare.secretAccessKey,
      },
    });
    console.log(`[R2] Cloudflare R2 Client initialized for account ${config.cloudflare.accountId} (bucket: ${config.cloudflare.bucketName})`);
  }
  return s3Client;
}

export const r2Storage = {
  /**
   * Upload a file buffer or stream to Cloudflare R2
   * @param {string} key - e.g. "books/user_123/book_456.pdf"
   * @param {Buffer|Uint8Array} body - File contents
   * @param {string} contentType - e.g. "application/pdf"
   * @returns {Promise<{ key: string, url: string, storageType: 'r2' | 'local' }>}
   */
  async upload(key, body, contentType = 'application/pdf') {
    const client = getS3Client();

    if (client) {
      try {
        const command = new PutObjectCommand({
          Bucket: config.cloudflare.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
        });

        await client.send(command);
        console.log(`[R2] Successfully uploaded ${key} to Cloudflare R2 bucket "${config.cloudflare.bucketName}"`);

        const publicUrl = config.cloudflare.publicUrl
          ? `${config.cloudflare.publicUrl.replace(/\/$/, '')}/${key}`
          : `/api/books/file/${encodeURIComponent(key)}`;

        return { key, url: publicUrl, storageType: 'r2' };
      } catch (err) {
        console.error(`[R2 Error] Failed to upload ${key} to Cloudflare R2:`, err.message);
        throw err;
      }
    }

    // Fallback to local storage if R2 is not configured
    console.warn(`[Storage Fallback] Cloudflare R2 is not configured. Saving ${key} to local disk.`);
    const localPath = path.join(localUploadsDir, key.replace(/\//g, '_'));
    fs.writeFileSync(localPath, body);

    return {
      key,
      url: `/api/books/file/${encodeURIComponent(key)}`,
      storageType: 'local',
    };
  },

  /**
   * Get an object stream from Cloudflare R2 (or local fallback), supporting HTTP Range headers
   * @param {string} key - e.g. "books/user_123/book_456.pdf"
   * @param {string} [rangeHeader] - e.g. "bytes=0-1024"
   * @returns {Promise<{ stream: NodeJS.ReadableStream, contentLength?: number, contentRange?: string, contentType: string }>}
   */
  async getStream(key, rangeHeader) {
    const client = getS3Client();

    if (client) {
      try {
        const getParams = {
          Bucket: config.cloudflare.bucketName,
          Key: key,
        };

        if (rangeHeader) {
          getParams.Range = rangeHeader;
        }

        const command = new GetObjectCommand(getParams);
        const response = await client.send(command);

        return {
          stream: response.Body,
          contentLength: response.ContentLength,
          contentRange: response.ContentRange,
          contentType: response.ContentType || 'application/pdf',
          statusCode: rangeHeader && response.ContentRange ? 206 : 200,
        };
      } catch (err) {
        console.error(`[R2 Error] Failed to get stream for ${key}:`, err.message);
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
   * Delete an object from Cloudflare R2 (and local fallback)
   * @param {string} key
   */
  async delete(key) {
    const client = getS3Client();

    if (client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: config.cloudflare.bucketName,
          Key: key,
        });
        await client.send(command);
        console.log(`[R2] Deleted ${key} from Cloudflare R2 bucket`);
      } catch (err) {
        console.warn(`[R2 Warning] Could not delete ${key} from Cloudflare R2:`, err.message);
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
   * Generate a signed temporary download URL for direct browser streaming
   */
  async getPresignedUrl(key, expiresInSeconds = 3600) {
    const client = getS3Client();
    if (!client) return null;

    try {
      const command = new GetObjectCommand({
        Bucket: config.cloudflare.bucketName,
        Key: key,
      });
      return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    } catch (err) {
      console.warn(`[R2 Warning] Failed to generate presigned URL for ${key}:`, err.message);
      return null;
    }
  },

  /**
   * Verify Cloudflare R2 connectivity
   */
  async testConnection() {
    if (!config.isR2Configured()) {
      return {
        connected: false,
        message: 'Cloudflare R2 credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, and CLOUDFLARE_R2_BUCKET_NAME in your .env file.',
        configured: false,
      };
    }

    try {
      const client = getS3Client();
      const command = new ListObjectsV2Command({
        Bucket: config.cloudflare.bucketName,
        MaxKeys: 1,
      });
      await client.send(command);
      return {
        connected: true,
        message: `Successfully connected to Cloudflare R2 bucket "${config.cloudflare.bucketName}"`,
        configured: true,
        bucket: config.cloudflare.bucketName,
        accountId: config.cloudflare.accountId,
      };
    } catch (err) {
      return {
        connected: false,
        message: `Cloudflare R2 connection error: ${err.message}`,
        configured: true,
        error: err.name,
      };
    }
  },
};
