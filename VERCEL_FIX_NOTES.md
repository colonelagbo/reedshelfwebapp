# Vercel deployment fix

This version includes the serverless deployment fixes applied for ReedShelf:

- Removed the native `better-sqlite3` dependency from the application manifests so Vercel does not need to compile/load a native SQLite module during function startup.
- The backend now uses the existing pure-JavaScript JSON adapter instead of native SQLite.
- Replaced the rewrite-based `/api/*` handler with a Vercel filesystem catch-all function at `api/[...path].js`.
- Simplified the Supabase client setup by removing the custom `ws` realtime transport override.
- Updated the SPA rewrite so API requests are not swallowed by the frontend `index.html` rewrite.

## Important

The current JSON database is suitable for getting the serverless function running, but `/tmp` storage on Vercel is ephemeral. For production persistence of users, books metadata, reading progress, plans, and admin data, the next step should be migrating the application database to Supabase Postgres (the project already contains a Supabase schema).

Do not commit a real `.env` file. Set the required environment variables in Vercel Project Settings instead.
