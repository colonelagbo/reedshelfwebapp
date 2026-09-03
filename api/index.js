import app from '../server/src/index.js';

export default function handler(req, res) {
  // If Vercel rewrote /api/(.*) to /api/index.js, restore the original URL path so Express routers match properly
  if (req.url === '/api/index.js' || req.url === '/api' || req.url === '/' || req.url === '') {
    if (req.originalUrl) {
      req.url = req.originalUrl;
    }
  }
  return app(req, res);
}
