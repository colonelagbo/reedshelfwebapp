import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root or server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const config = {
  isVercel,
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'reedshelf_jwt_secret_dev_key_2026_change_in_production',
  databasePath: process.env.DATABASE_PATH || (isVercel ? '/tmp/reedshelf.db' : path.resolve(__dirname, '../data/reedshelf.db')),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    bucketName: process.env.SUPABASE_BUCKET_NAME || 'reedshelf-books',
  },

  isSupabaseConfigured() {
    return Boolean(this.supabase.url && this.supabase.key);
  }
};
