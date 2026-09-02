import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { booksRouter } from './routes/books.js';
import { progressRouter } from './routes/progress.js';
import { plansRouter } from './routes/plans.js';
import { highlightsRouter } from './routes/highlights.js';
import { settingsRouter } from './routes/settings.js';
import { healthRouter } from './routes/health.js';
import { adminRouter } from './routes/admin.js';
import { authenticateToken } from './middleware/auth.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/api/health')) {
      console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/progress', progressRouter);
app.use('/api/plans', plansRouter);
app.use('/api/highlights', highlightsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/health', healthRouter);
app.use('/api/admin', authenticateToken, adminRouter);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start Server (only if not imported as serverless function in Vercel)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log('====================================================');
    console.log(`🚀 ReedShelf Backend running at http://localhost:${config.port}`);
    console.log(`📡 Supabase Storage: ${config.isSupabaseConfigured() ? `ENABLED (Bucket: ${config.supabase.bucketName})` : 'DISABLED (Using local storage fallback until .env keys are added)'}`);
    console.log(`🛡️ Admin API: http://localhost:${config.port}/api/admin`);
    console.log(`🩺 Health check: http://localhost:${config.port}/api/health`);
    console.log('====================================================');
  });
}

export default app;
