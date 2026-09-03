export default async function handler(req, res) {
  const result = {
    status: 'diagnostic_ok',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseKey: Boolean(process.env.SUPABASE_KEY),
      hasSupabaseBucket: Boolean(process.env.SUPABASE_BUCKET_NAME),
      adminEmail: process.env.ADMIN_EMAIL || null,
      vercel: process.env.VERCEL || null,
      region: process.env.VERCEL_REGION || null
    }
  };

  try {
    const appModule = await import('../server/src/index.js');
    result.importServer = 'SUCCESS';
    result.appExportType = typeof appModule.default;
  } catch (err) {
    result.importServer = 'FAILED';
    result.importError = {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
  }

  res.status(200).json(result);
}
