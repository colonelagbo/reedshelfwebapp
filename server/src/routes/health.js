import express from 'express';
import { supabaseStorage } from '../storage/supabase.js';
import { config } from '../config.js';
import { db } from '../db.js';

export const healthRouter = express.Router();

// GET /api/health
healthRouter.get('/', async (req, res) => {
  try {
    const supabaseStatus = await supabaseStorage.testConnection();
    let dbStatus = 'ok';
    try {
      db.get('SELECT 1');
    } catch (e) {
      dbStatus = `error: ${e.message}`;
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      supabaseStorage: {
        configured: config.isSupabaseConfigured(),
        connected: supabaseStatus.connected,
        bucket: config.supabase.bucketName,
        url: config.supabase.url || null,
        message: supabaseStatus.message,
      },
      version: '1.0.0',
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
    });
  }
});
