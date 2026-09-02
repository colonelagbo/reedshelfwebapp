import fs from 'fs';
import path from 'path';
import { config } from './config.js';

// Ensure data directory exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;
let useFallbackDb = false;

// Initialize database schema
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT DEFAULT 'application/pdf',
  file_size INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  cover_data_url TEXT,
  cover_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reading_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  page INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, book_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reading_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  target_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  pages_per_day INTEGER NOT NULL,
  total_pages INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  color TEXT DEFAULT '#ffd24c',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  dark_mode INTEGER DEFAULT 0,
  library_view TEXT DEFAULT 'grid',
  font_size INTEGER DEFAULT 18,
  line_height REAL DEFAULT 1.75,
  reader_width TEXT DEFAULT 'medium',
  auto_save INTEGER DEFAULT 1,
  show_page_numbers INTEGER DEFAULT 1,
  confirm_sign_out INTEGER DEFAULT 1,
  keyboard_shortcuts INTEGER DEFAULT 1,
  default_highlight_color TEXT DEFAULT '#ffd24c',
  reduced_motion INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_email TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  page INTEGER NOT NULL,
  action TEXT DEFAULT 'read',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_books_uploaded_by ON books(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_progress_user_book ON reading_progress(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_plans_user ON reading_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_book ON highlights(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_created ON reading_activity(created_at);
`;

// Fallback in-memory / JSON store if native better-sqlite3 is unavailable
class JsonStoreAdapter {
  constructor(filePath) {
    this.filePath = filePath.replace(/\.db$/, '.json');
    this.data = {
      users: [],
      books: [],
      reading_progress: [],
      reading_plans: [],
      highlights: [],
      user_settings: [],
      admin_settings: [],
      admin_audit_logs: [],
      reading_activity: []
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = { ...this.data, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Could not read JSON DB file, starting fresh:', e.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save JSON DB file:', e.message);
    }
  }
}

let jsonStore = null;

try {
  // Dynamically import better-sqlite3
  const Database = (await import('better-sqlite3')).default;
  dbInstance = new Database(config.databasePath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.exec(SCHEMA);

  // Safe migrations on existing table
  try {
    dbInstance.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  } catch {}
  try {
    dbInstance.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
  } catch {}

  // Create indexes on migrated columns
  try {
    dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)");
    dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)");
  } catch {}

  // Seed default admin settings
  const now = new Date().toISOString();
  try {
    dbInstance.prepare("INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES ('storage_limit_gb', '100', ?)").run(now);
    dbInstance.prepare("INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES ('allow_registrations', 'true', ?)").run(now);
    dbInstance.prepare("INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES ('max_upload_size_mb', '100', ?)").run(now);
  } catch {}

  // Auto-promote admin if ADMIN_EMAIL is configured
  if (process.env.ADMIN_EMAIL) {
    const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
    try {
      dbInstance.prepare("UPDATE users SET role = 'admin' WHERE LOWER(email) = ?").run(adminEmail);
    } catch {}
  }

  console.log(`[DB] SQLite database initialized at ${config.databasePath}`);
} catch (err) {
  console.warn('[DB] better-sqlite3 not available or failed to load. Using robust JSON database fallback:', err.message);
  useFallbackDb = true;
  jsonStore = new JsonStoreAdapter(config.databasePath);
}

export const db = {
  // Execute a query returning multiple rows
  all(sql, params = []) {
    if (!useFallbackDb && dbInstance) {
      const stmt = dbInstance.prepare(sql);
      return stmt.all(params);
    }
    return queryFallback(sql, params, 'all');
  },

  // Execute a query returning a single row
  get(sql, params = []) {
    if (!useFallbackDb && dbInstance) {
      const stmt = dbInstance.prepare(sql);
      return stmt.get(params);
    }
    return queryFallback(sql, params, 'get');
  },

  // Execute an INSERT/UPDATE/DELETE query
  run(sql, params = []) {
    if (!useFallbackDb && dbInstance) {
      const stmt = dbInstance.prepare(sql);
      return stmt.run(params);
    }
    return queryFallback(sql, params, 'run');
  },

  // Execute raw multi-statement SQL
  exec(sql) {
    if (!useFallbackDb && dbInstance) {
      return dbInstance.exec(sql);
    }
  }
};

function queryFallback(sql, params, mode) {
  const s = sql.trim();
  const lower = s.toLowerCase();

  if (lower.startsWith('select')) {
    let table = null;
    if (lower.includes('from users')) table = jsonStore.data.users;
    else if (lower.includes('from books')) table = jsonStore.data.books;
    else if (lower.includes('from reading_progress')) table = jsonStore.data.reading_progress;
    else if (lower.includes('from reading_plans')) table = jsonStore.data.reading_plans;
    else if (lower.includes('from highlights')) table = jsonStore.data.highlights;
    else if (lower.includes('from user_settings')) table = jsonStore.data.user_settings;
    else if (lower.includes('from admin_settings')) table = jsonStore.data.admin_settings;
    else if (lower.includes('from admin_audit_logs')) table = jsonStore.data.admin_audit_logs;
    else if (lower.includes('from reading_activity')) table = jsonStore.data.reading_activity;

    if (!table) return mode === 'get' ? null : [];

    let results = [...table];

    // Simple WHERE clause parsing for common queries
    if (lower.includes('where')) {
      if (lower.includes('email =') && params.length >= 1) {
        results = results.filter(u => u.email?.toLowerCase() === String(params[0]).toLowerCase());
      } else if (lower.includes('key =') && params.length >= 1) {
        results = results.filter(s => s.key === params[0]);
      } else if (lower.includes('user_id =') && lower.includes('book_id =') && params.length >= 2) {
        results = results.filter(r => r.user_id === params[0] && r.book_id === params[1]);
      } else if (lower.includes('uploaded_by =') && params.length >= 1) {
        results = results.filter(b => b.uploaded_by === params[0]);
      } else if (lower.includes('user_id =') && params.length >= 1) {
        results = results.filter(r => r.user_id === params[0]);
      } else if (lower.includes('book_id =') && params.length >= 1) {
        results = results.filter(r => r.book_id === params[0]);
      } else if (lower.includes('id =') && params.length >= 1) {
        results = results.filter(r => r.id === params[0]);
      }
    }

    if (lower.includes('order by created_at desc') || lower.includes('order by updated_at desc')) {
      results.sort((a, b) => (b.created_at || b.updated_at || '').localeCompare(a.created_at || a.updated_at || ''));
    }

    return mode === 'get' ? (results[0] || null) : results;
  }

  if (lower.startsWith('insert')) {
    let target = null;
    if (lower.includes('into users')) target = jsonStore.data.users;
    else if (lower.includes('into books')) target = jsonStore.data.books;
    else if (lower.includes('into reading_progress')) target = jsonStore.data.reading_progress;
    else if (lower.includes('into reading_plans')) target = jsonStore.data.reading_plans;
    else if (lower.includes('into highlights')) target = jsonStore.data.highlights;
    else if (lower.includes('into user_settings')) target = jsonStore.data.user_settings;
    else if (lower.includes('into admin_settings')) target = jsonStore.data.admin_settings;
    else if (lower.includes('into admin_audit_logs')) target = jsonStore.data.admin_audit_logs;
    else if (lower.includes('into reading_activity')) target = jsonStore.data.reading_activity;

    if (target) {
      if (lower.includes('into users')) {
        const [id, name, email, password, avatar, role, status, created_at] = params;
        target.push({ id, name, email, password, avatar, role: role || 'user', status: status || 'active', created_at });
      } else if (lower.includes('into books')) {
        const [id, title, author, file_name, file_type, file_size, total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at] = params;
        target.unshift({ id, title, author, file_name, file_type, file_size, total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at });
      } else if (lower.includes('into reading_plans')) {
        const [id, user_id, book_id, start_date, target_date, days, pages_per_day, total_pages, created_at, updated_at] = params;
        target.unshift({ id, user_id, book_id, start_date, target_date, days, pages_per_day, total_pages, created_at, updated_at });
      } else if (lower.includes('into highlights')) {
        const [id, user_id, book_id, page, text, color, created_at] = params;
        target.push({ id, user_id, book_id, page, text, color, created_at });
      } else if (lower.includes('into admin_settings')) {
        const [key, value, updated_at] = params;
        const existIdx = target.findIndex(s => s.key === key);
        if (existIdx >= 0) target[existIdx] = { key, value, updated_at };
        else target.push({ key, value, updated_at });
      } else if (lower.includes('into admin_audit_logs')) {
        const [id, admin_id, admin_email, action, target_type, target_id, target_email, details, created_at] = params;
        target.unshift({ id, admin_id, admin_email, action, target_type, target_id, target_email, details, created_at });
      } else if (lower.includes('into reading_activity')) {
        const [id, user_id, book_id, page, action, created_at] = params;
        target.unshift({ id, user_id, book_id, page, action: action || 'read', created_at });
      }
      jsonStore.save();
      return { changes: 1 };
    }
  }

  if (lower.startsWith('update')) {
    if (lower.includes('users') && lower.includes('set status =') && params.length >= 2) {
      const [status, id] = params;
      const u = jsonStore.data.users.find(x => x.id === id);
      if (u) { u.status = status; jsonStore.save(); return { changes: 1 }; }
    } else if (lower.includes('users') && lower.includes('set role =') && params.length >= 2) {
      const [role, id] = params;
      const u = jsonStore.data.users.find(x => x.id === id);
      if (u) { u.role = role; jsonStore.save(); return { changes: 1 }; }
    } else if (lower.includes('admin_settings') && lower.includes('set value =') && params.length >= 3) {
      const [value, updated_at, key] = params;
      const s = jsonStore.data.admin_settings.find(x => x.key === key);
      if (s) { s.value = value; s.updated_at = updated_at; }
      else { jsonStore.data.admin_settings.push({ key, value, updated_at }); }
      jsonStore.save();
      return { changes: 1 };
    }
  }

  if (lower.startsWith('delete')) {
    if (lower.includes('from users') && params.length >= 1) {
      const userId = params[0];
      jsonStore.data.users = jsonStore.data.users.filter(u => u.id !== userId);
      jsonStore.data.books = jsonStore.data.books.filter(b => b.uploaded_by !== userId);
      jsonStore.data.reading_progress = jsonStore.data.reading_progress.filter(p => p.user_id !== userId);
      jsonStore.data.reading_plans = jsonStore.data.reading_plans.filter(p => p.user_id !== userId);
      jsonStore.data.highlights = jsonStore.data.highlights.filter(h => h.user_id !== userId);
      jsonStore.data.user_settings = jsonStore.data.user_settings.filter(s => s.user_id !== userId);
      jsonStore.data.reading_activity = jsonStore.data.reading_activity.filter(a => a.user_id !== userId);
    } else if (lower.includes('from books') && params.length >= 1) {
      jsonStore.data.books = jsonStore.data.books.filter(b => b.id !== params[0]);
      jsonStore.data.reading_progress = jsonStore.data.reading_progress.filter(p => p.book_id !== params[0]);
      jsonStore.data.highlights = jsonStore.data.highlights.filter(h => h.book_id !== params[0]);
      jsonStore.data.reading_plans = jsonStore.data.reading_plans.filter(p => p.book_id !== params[0]);
      jsonStore.data.reading_activity = jsonStore.data.reading_activity.filter(a => a.book_id !== params[0]);
    } else if (lower.includes('from reading_plans') && params.length >= 1) {
      jsonStore.data.reading_plans = jsonStore.data.reading_plans.filter(p => p.id !== params[0]);
    } else if (lower.includes('from highlights') && params.length >= 1) {
      jsonStore.data.highlights = jsonStore.data.highlights.filter(h => h.id !== params[0]);
    }
    jsonStore.save();
    return { changes: 1 };
  }

  return { changes: 0 };
}
