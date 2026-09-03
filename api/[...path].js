import app from '../server/src/index.js';

// Vercel catch-all serverless function for every /api/* request.
// Keeping the Express app behind a filesystem-routed function avoids
// rewrite/path mutation issues during serverless invocation.
export default app;
