import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: WebSocket,
  },
});

async function testConnection() {
  console.log('Testing Supabase connection...\n');

  // 1. Check the bucket exists (or create it)
  const bucketName = process.env.SUPABASE_BUCKET_NAME;
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('❌ Failed to connect to Supabase Storage:', listError.message);
    return;
  }

  console.log('✅ Connected to Supabase Storage');

  let bucketExists = buckets.some(b => b.name === bucketName);

  if (!bucketExists) {
    console.log(`Bucket "${bucketName}" not found — creating it...`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: false
    });
    if (createError) {
      console.error('❌ Failed to create bucket:', createError.message);
      return;
    }
    console.log(`✅ Bucket "${bucketName}" created`);
  } else {
    console.log(`✅ Bucket "${bucketName}" already exists`);
  }

  // 2. Try uploading a small test file
  const testContent = Buffer.from('This is a test file from Reedshelf setup.');
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload('test-file.txt', testContent, { upsert: true });

  if (uploadError) {
    console.error('❌ Failed to upload test file:', uploadError.message);
    return;
  }
  console.log('✅ Successfully uploaded a test file');

  // 3. Try downloading it back
  const { data: downloadData, error: downloadError } = await supabase.storage
    .from(bucketName)
    .download('test-file.txt');

  if (downloadError) {
    console.error('❌ Failed to download test file:', downloadError.message);
    return;
  }
  console.log('✅ Successfully downloaded the test file back');


  
  // 4. Clean up
  const { error: deleteError } = await supabase.storage
    .from(bucketName)
    .remove(['test-file.txt']);

  if (deleteError) {
    console.warn('⚠️ Could not delete test file (not critical):', deleteError.message);
  } else {
    console.log('✅ Cleaned up test file');
  }

  console.log('\n🎉 All checks passed — your Supabase storage config is working!');
}

testConnection();