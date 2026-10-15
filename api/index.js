import app from '../server/src/index.js';
import { syncUsersFromCloud, syncBooksFromCloud } from '../server/src/storage/cloudSync.js';

let coldStartSyncPromise = null;

function warmCloudCache() {
  if (!coldStartSyncPromise) {
    coldStartSyncPromise = Promise.allSettled([
      syncUsersFromCloud(true),
      syncBooksFromCloud(true),
    ]).catch((err) => {
      console.warn('[Vercel ColdStart Sync Notice]', err.message);
    });
  }
  return coldStartSyncPromise;
}

export default async function handler(req, res) {
  if (req.originalUrl) {
    req.url = req.originalUrl;
  }

  const path = req.url || '';
  // Ensure essential cloud data (users, books) are loaded into memory for critical routes
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/books') ||
    path.startsWith('/api/admin')
  ) {
    try {
      await Promise.race([
        warmCloudCache(),
        new Promise((resolve) => setTimeout(resolve, 2500))
      ]);
    } catch {}
  } else {
    warmCloudCache();
  }

  return app(req, res);
}
