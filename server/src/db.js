import fs from 'fs';
import path from 'path';
import { config } from './config.js';

// Ensure data directory exists (safe for read-only serverless filesystems)
try {
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (e) {
  // Ignored on read-only environments
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

// Fallback in-memory / JSON store if native better-sqlite3 is unavailable or on serverless
class JsonStoreAdapter {
  constructor(filePath) {
    const isVercel = Boolean(config.isVercel || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.filePath = isVercel ? '/tmp/reedshelf.json' : filePath.replace(/\.db$/, '.json');
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
    this.ensureDir();
    this.load();
    this.seedDefaults();
  }

  ensureDir() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.warn('[DB Fallback] Could not create directory for DB:', e.message);
    }
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = { ...this.data, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('[DB Fallback] Could not read JSON DB file, starting fresh:', e.message);
    }
  }

  seedDefaults() {
    const now = new Date().toISOString();
    if (!this.data.admin_settings.some(s => s.key === 'storage_limit_gb')) {
      this.data.admin_settings.push({ key: 'storage_limit_gb', value: '100', updated_at: now });
    }
    if (!this.data.admin_settings.some(s => s.key === 'allow_registrations')) {
      this.data.admin_settings.push({ key: 'allow_registrations', value: 'true', updated_at: now });
    }
    if (!this.data.admin_settings.some(s => s.key === 'max_upload_size_mb')) {
      this.data.admin_settings.push({ key: 'max_upload_size_mb', value: '100', updated_at: now });
    }

    // Always seed link4emmy@gmail.com as primary administrator
    const targetEmail = 'link4emmy@gmail.com';
    const existingAdmin = this.data.users.find(u => u.email?.toLowerCase() === targetEmail);
    if (existingAdmin) {
      existingAdmin.role = 'admin';
      existingAdmin.status = 'active';
    } else {
      this.data.users.push({
        id: 'admin_primary_' + Date.now(),
        name: 'Platform Admin',
        email: targetEmail,
        // Hashed 'ReedshelfAdmin2026!'
        password: '$2b$10$FqhDgY0zn2pMkTAlbTHcU.Y6KXBI9vXm8jRkuK5S9gj6cV51CKofy',
        avatar: null,
        role: 'admin',
        status: 'active',
        created_at: now
      });
    }
    this.save();
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[DB Fallback] Failed to save JSON DB file:', e.message);
    }
  }
}

let jsonStore = null;

// Use the pure-JavaScript adapter everywhere. It avoids native SQLite
// dependencies that can fail during serverless function initialization.
useFallbackDb = true;
jsonStore = new JsonStoreAdapter(config.databasePath);

export const db = {
  all(sql, params = []) {
    if (!useFallbackDb && dbInstance) {
      const stmt = dbInstance.prepare(sql);
      return stmt.all(params);
    }
    return queryFallback(sql, params, 'all');
  },

  get(sql, params = []) {
    if (!useFallbackDb && dbInstance) {
      const stmt = dbInstance.prepare(sql);
      return stmt.get(params);
    }
    return queryFallback(sql, params, 'get');
  },

  run(sql, params = []) {
    if (!useFallbackDb && dbInstance) {
      const stmt = dbInstance.prepare(sql);
      return stmt.run(params);
    }
    return queryFallback(sql, params, 'run');
  },

  exec(sql) {
    if (!useFallbackDb && dbInstance) {
      return dbInstance.exec(sql);
    }
  }
};

function queryFallback(sql, params, mode) {
  const s = sql.trim();
  const lower = s.toLowerCase();

  // 1. SELECT QUERIES
  if (lower.startsWith('select')) {
    // A. Complex join: Top storage users or users list
    if (lower.includes('from users u') && lower.includes('left join books b')) {
      let userList = jsonStore.data.users.map(u => {
        const userBooks = jsonStore.data.books.filter(b => b.uploaded_by === u.id);
        const storageBytes = userBooks.reduce((acc, b) => acc + (Number(b.file_size) || 0), 0);
        const lastReading = jsonStore.data.reading_progress
          .filter(p => p.user_id === u.id)
          .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          role: u.role || 'user',
          status: u.status || 'active',
          created_at: u.created_at,
          books_count: userBooks.length,
          storage_bytes: storageBytes,
          last_reading_at: lastReading?.updated_at || null
        };
      });

      // Filters
      if (params.length > 0 && lower.includes('like ?')) {
        const term = String(params[0]).replace(/%/g, '').toLowerCase();
        userList = userList.filter(u => u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term));
      }
      if (lower.includes('u.role = ?')) {
        const roleParam = params.find(p => p === 'admin' || p === 'user');
        if (roleParam) userList = userList.filter(u => u.role === roleParam);
      }
      if (lower.includes('u.status = ?')) {
        const statusParam = params.find(p => p === 'active' || p === 'suspended');
        if (statusParam) userList = userList.filter(u => u.status === statusParam);
      }

      // Sort
      if (lower.includes('order by storage_bytes asc')) userList.sort((a, b) => a.storage_bytes - b.storage_bytes);
      else if (lower.includes('order by storage_bytes desc')) userList.sort((a, b) => b.storage_bytes - a.storage_bytes);
      else if (lower.includes('order by books_count asc')) userList.sort((a, b) => a.books_count - b.books_count);
      else if (lower.includes('order by books_count desc')) userList.sort((a, b) => b.books_count - a.books_count);
      else if (lower.includes('order by u.name asc')) userList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      else if (lower.includes('order by u.name desc')) userList.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      else if (lower.includes('order by u.created_at asc')) userList.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      else userList.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

      // Limit
      if (lower.includes('limit 5')) userList = userList.slice(0, 5);

      return mode === 'get' ? (userList[0] || null) : userList;
    }

    // B. Complex join: Books with owner info
    if (lower.includes('from books b') && lower.includes('left join users u')) {
      let bookList = jsonStore.data.books.map(b => {
        const owner = jsonStore.data.users.find(u => u.id === b.uploaded_by);
        return {
          ...b,
          owner_name: owner?.name || 'Unknown',
          owner_email: owner?.email || 'Unknown',
          owner_status: owner?.status || 'active'
        };
      });

      if (params.length > 0 && lower.includes('like ?')) {
        const term = String(params[0]).replace(/%/g, '').toLowerCase();
        bookList = bookList.filter(b => 
          b.title?.toLowerCase().includes(term) ||
          b.author?.toLowerCase().includes(term) ||
          b.owner_email?.toLowerCase().includes(term)
        );
      }

      if (lower.includes('order by b.file_size asc')) bookList.sort((a, b) => (a.file_size || 0) - (b.file_size || 0));
      else if (lower.includes('order by b.file_size desc')) bookList.sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
      else if (lower.includes('order by b.title asc')) bookList.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      else if (lower.includes('order by b.title desc')) bookList.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      else if (lower.includes('order by b.total_pages asc')) bookList.sort((a, b) => (a.total_pages || 0) - (b.total_pages || 0));
      else if (lower.includes('order by b.total_pages desc')) bookList.sort((a, b) => (b.total_pages || 0) - (a.total_pages || 0));
      else bookList.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

      return mode === 'get' ? (bookList[0] || null) : bookList;
    }

    // C. Complex join: Reading progress sessions
    if (lower.includes('from reading_progress p') && lower.includes('join users u') && lower.includes('join books b')) {
      const sessions = jsonStore.data.reading_progress.map(p => {
        const u = jsonStore.data.users.find(x => x.id === p.user_id);
        const b = jsonStore.data.books.find(x => x.id === p.book_id);
        return {
          id: p.id,
          page: p.page,
          updated_at: p.updated_at,
          user_name: u?.name || 'Unknown',
          user_email: u?.email || 'Unknown',
          book_title: b?.title || 'Unknown Book',
          total_pages: b?.total_pages || 0
        };
      }).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

      return mode === 'get' ? (sessions[0] || null) : sessions.slice(0, 25);
    }

    // D. Aggregation queries: COUNT(*), SUM(file_size), etc.
    if (lower.includes('count(*) as count, coalesce(sum(file_size), 0) as size from books')) {
      const size = jsonStore.data.books.reduce((acc, b) => acc + (Number(b.file_size) || 0), 0);
      const row = { count: jsonStore.data.books.length, size };
      return mode === 'get' ? row : [row];
    }

    if (lower.includes('count(distinct user_id) as count from reading_progress where page > 1')) {
      const distinct = new Set(jsonStore.data.reading_progress.filter(p => p.page > 1).map(p => p.user_id));
      const row = { count: distinct.size };
      return mode === 'get' ? row : [row];
    }

    if (lower.includes('count(distinct book_id) as count from reading_progress where page > 1')) {
      const distinct = new Set(jsonStore.data.reading_progress.filter(p => p.page > 1).map(p => p.book_id));
      const row = { count: distinct.size };
      return mode === 'get' ? row : [row];
    }

    if (lower.includes('count(*) as count from users where created_at >= ?') && params.length >= 1) {
      const threshold = params[0];
      const count = jsonStore.data.users.filter(u => u.created_at >= threshold).length;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (lower.includes('count(*) as count from users where role = \'admin\' and status = \'active\'')) {
      const count = jsonStore.data.users.filter(u => u.role === 'admin' && u.status === 'active').length;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (lower.includes('count(*) as count from users where role = \'admin\'')) {
      const count = jsonStore.data.users.filter(u => u.role === 'admin').length;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (lower.includes('count(*) as count from users')) {
      const count = jsonStore.data.users.length;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (lower.includes('count(*) as count from reading_plans')) {
      const count = jsonStore.data.reading_plans.length;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (lower.includes('count(*) as count from reading_progress')) {
      const count = jsonStore.data.reading_progress.length;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (lower.includes('count(*) as count from highlights') && params.length >= 1) {
      const count = jsonStore.data.highlights.filter(h => h.user_id === params[0]).length;
      return mode === 'get' ? { count } : [{ count }];
    }

    // E. General table queries
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

    // Filter clauses
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

    if (lower.includes('limit') && !lower.includes('limit 5')) {
      const limitMatch = lower.match(/limit\s+(\d+)/);
      if (limitMatch) {
        const lim = parseInt(limitMatch[1], 10);
        results = results.slice(0, lim);
      }
    }

    return mode === 'get' ? (results[0] || null) : results;
  }

  // 2. INSERT QUERIES
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

  // 3. UPDATE QUERIES
  if (lower.startsWith('update')) {
    if (lower.includes('users') && lower.includes('set status =') && params.length >= 2) {
      const [status, id] = params;
      const u = jsonStore.data.users.find(x => x.id === id);
      if (u) { u.status = status; jsonStore.save(); return { changes: 1 }; }
    } else if (lower.includes('users') && lower.includes('set role =') && params.length >= 2) {
      const [role, id] = params;
      const u = jsonStore.data.users.find(x => x.id === id);
      if (u) { u.role = role; jsonStore.save(); return { changes: 1 }; }
    } else if (lower.includes('users') && lower.includes('set password =') && params.length >= 2) {
      const [password, id] = params;
      const u = jsonStore.data.users.find(x => x.id === id);
      if (u) { u.password = password; jsonStore.save(); return { changes: 1 }; }
    } else if (lower.includes('admin_settings') && lower.includes('set value =') && params.length >= 3) {
      const [value, updated_at, key] = params;
      const s = jsonStore.data.admin_settings.find(x => x.key === key);
      if (s) { s.value = value; s.updated_at = updated_at; }
      else { jsonStore.data.admin_settings.push({ key, value, updated_at }); }
      jsonStore.save();
      return { changes: 1 };
    }
  }

  // 4. DELETE QUERIES
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
