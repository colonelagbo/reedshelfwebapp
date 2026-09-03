import app from '../server/src/index.js';

export default function handler(req, res) {
  if (req.originalUrl) {
    req.url = req.originalUrl;
  }
  return app(req, res);
}
