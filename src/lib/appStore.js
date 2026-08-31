const USERS_KEY = 'reedshelf_users_v1';
const SESSION_KEY = 'reedshelf_session_v1';
const BOOKS_KEY = 'reedshelf_books_v1';
const PROGRESS_KEY = 'reedshelf_progress_v1';
const PLANS_KEY = 'reedshelf_plans_v1';
const SETTINGS_KEY = 'reedshelf_settings_v1';
const HIGHLIGHTS_KEY = 'reedshelf_highlights_v1';

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = (prefix = 'id') =>
  `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}_${Date.now()}`;

export const getUsers = () => read(USERS_KEY, []);
export const getSession = () => localStorage.getItem(SESSION_KEY);
export const getCurrentUser = () => getUsers().find((u) => u.id === getSession()) || null;

export function registerUser({ name, email, password }) {
  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }
  const user = {
    id: uid('user'),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    createdAt: new Date().toISOString(),
    avatar: null,
  };
  write(USERS_KEY, [...users, user]);
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function loginUser({ email, password }) {
  const user = getUsers().find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!user) throw new Error('Incorrect email or password.');
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function updateUser(userId, changes) {
  const users = getUsers().map((u) => (u.id === userId ? { ...u, ...changes } : u));
  write(USERS_KEY, users);
  return users.find((u) => u.id === userId);
}

export function resetPassword(email, newPassword) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (idx < 0) throw new Error('No ReedShelf account was found with that email.');
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
  users[idx] = { ...users[idx], password: newPassword };
  write(USERS_KEY, users);
  return true;
}

export const getBooks = () => read(BOOKS_KEY, []);
export const getUserBooks = (userId) => {
  const books = getBooks();
  if (!userId) return books;
  return books.filter((b) => b.uploadedBy === userId || !b.uploadedBy);
};

export function addBook(book) {
  const item = { id: uid('book'), ...book, createdAt: new Date().toISOString() };
  write(BOOKS_KEY, [item, ...getBooks()]);
  return item;
}

export function updateBook(id, changes) {
  write(
    BOOKS_KEY,
    getBooks().map((b) => (b.id === id ? { ...b, ...changes } : b))
  );
}

// Removes a book plus all data tied to it: reading progress, saved
// highlights (across any user, keyed `${userId}:${bookId}`), and the stored
// PDF file itself (IndexedDB / memory cache). Call this rather than the
// individual pieces so a deleted book never leaves orphaned data behind.
export async function deleteBook(id) {
  write(
    BOOKS_KEY,
    getBooks().filter((b) => b.id !== id)
  );

  const progress = read(PROGRESS_KEY, {});
  Object.keys(progress)
    .filter((key) => key.endsWith(`:${id}`))
    .forEach((key) => delete progress[key]);
  write(PROGRESS_KEY, progress);

  const highlights = read(HIGHLIGHTS_KEY, {});
  Object.keys(highlights)
    .filter((key) => key.endsWith(`:${id}`))
    .forEach((key) => delete highlights[key]);
  write(HIGHLIGHTS_KEY, highlights);

  await deleteBookFile(id);
}

export const getProgress = (userId, bookId) =>
  read(PROGRESS_KEY, {})[`${userId}:${bookId}`] || { page: 1, updatedAt: null };

export function saveProgress(userId, bookId, page) {
  const all = read(PROGRESS_KEY, {});
  all[`${userId}:${bookId}`] = {
    page: Math.max(1, Number(page) || 1),
    updatedAt: new Date().toISOString(),
  };
  write(PROGRESS_KEY, all);
}

export const getPlans = () => read(PLANS_KEY, []);
export const getUserPlans = (userId) => getPlans().filter((p) => p.userId === userId);

export function addPlan(plan) {
  const item = {
    id: uid('plan'),
    ...plan,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  write(PLANS_KEY, [item, ...getPlans()]);
  return item;
}

export function updatePlan(id, changes) {
  write(
    PLANS_KEY,
    getPlans().map((p) => (p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p))
  );
}

export function deletePlan(id) {
  write(
    PLANS_KEY,
    getPlans().filter((p) => p.id !== id)
  );
}

const defaultSettings = {
  darkMode: false,
  libraryView: 'grid',
  fontSize: 18,
  lineHeight: 1.75,
  readerWidth: 'medium',
  autoSave: true,
  showPageNumbers: true,
  confirmSignOut: true,
  keyboardShortcuts: true,
  defaultHighlightColor: '#ffd24c',
  reducedMotion: false,
};

export const getSettings = (userId) => ({
  ...defaultSettings,
  ...(read(SETTINGS_KEY, {})[userId] || {}),
});

export function saveSettings(userId, changes) {
  const all = read(SETTINGS_KEY, {});
  all[userId] = { ...getSettings(userId), ...changes };
  write(SETTINGS_KEY, all);
}

export const getHighlights = (userId, bookId) =>
  read(HIGHLIGHTS_KEY, {})[`${userId}:${bookId}`] || [];

export function saveHighlight(userId, bookId, highlight) {
  const all = read(HIGHLIGHTS_KEY, {});
  const key = `${userId}:${bookId}`;
  all[key] = [
    ...(all[key] || []),
    { id: uid('highlight'), ...highlight, createdAt: new Date().toISOString() },
  ];
  write(HIGHLIGHTS_KEY, all);
  return all[key];
}

export function deleteHighlight(userId, bookId, id) {
  const all = read(HIGHLIGHTS_KEY, {});
  const key = `${userId}:${bookId}`;
  all[key] = (all[key] || []).filter((h) => h.id !== id);
  write(HIGHLIGHTS_KEY, all);
}

// In-memory memory fallback store for environments where IndexedDB is restricted
const memoryFileCache = new Map();

const DB_NAME = 'reedshelf_files_v1';
let dbInstance = null;

function openDb() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in this environment'));
    }

    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files');
      }
    };

    req.onsuccess = () => {
      dbInstance = req.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    req.onerror = () => {
      reject(req.error || new Error('Failed to open IndexedDB'));
    };

    req.onblocked = () => {
      console.warn('IndexedDB database open is blocked');
    };
  });
}

export async function saveBookFile(bookId, file) {
  if (!bookId || !file) return;

  // Convert File to ArrayBuffer or Blob for universal IndexedDB serialization safety
  let dataToStore = file;
  if (file instanceof File || file instanceof Blob) {
    try {
      dataToStore = await file.arrayBuffer();
    } catch {
      dataToStore = file;
    }
  }

  // Cache in memory for instant session access
  memoryFileCache.set(bookId, dataToStore);

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      store.put(dataToStore, bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save file to IndexedDB, fallback to memory cache:', err);
  }
}

// pdf.js takes ownership of ArrayBuffers passed to getDocument() and transfers
// them to its worker, which detaches (empties) the original buffer. Since we
// keep a long-lived reference to the file in memoryFileCache, we must hand
// callers a fresh copy each time instead of the cached buffer itself -
// otherwise the 2nd+ attempt to open the same book gets a dead, empty buffer.
function cloneFileData(data) {
  if (data instanceof ArrayBuffer) return data.slice(0);
  if (ArrayBuffer.isView(data)) return data.slice();
  return data; // Blob/File/string are safely re-readable as-is
}

export async function getBookFile(bookId) {
  if (!bookId) return null;

  // Check memory cache first
  if (memoryFileCache.has(bookId)) {
    return cloneFileData(memoryFileCache.get(bookId));
  }

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').get(bookId);
      req.onsuccess = () => {
        const result = req.result || null;
        if (result) {
          memoryFileCache.set(bookId, result);
        }
        resolve(result ? cloneFileData(result) : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error reading file from IndexedDB:', err);
    const cached = memoryFileCache.get(bookId);
    return cached ? cloneFileData(cached) : null;
  }
}

export async function deleteBookFile(bookId) {
  memoryFileCache.delete(bookId);
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error deleting book file:', err);
  }
}
