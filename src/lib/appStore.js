import { api, authStorage } from './api';

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

// Auth helpers
export const getUsers = () => read(USERS_KEY, []);
export const getSession = () => authStorage.getToken() || localStorage.getItem(SESSION_KEY);
export const getCurrentUser = () => {
  const user = authStorage.getUser();
  if (user) return user;
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  return getUsers().find((u) => u.id === session) || null;
};

export async function registerUser({ name, email, password }) {
  try {
    const res = await api.auth.register({ name, email, password });
    return res.user;
  } catch (err) {
    // If backend isn't reachable, fallback locally for offline preview
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
    authStorage.setUser(user);
    return user;
  }
}

export async function loginUser({ email, password }) {
  try {
    const res = await api.auth.login({ email, password });
    return res.user;
  } catch (err) {
    // Fallback locally
    const user = getUsers().find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user) throw new Error(err.message || 'Incorrect email or password.');
    localStorage.setItem(SESSION_KEY, user.id);
    authStorage.setUser(user);
    return user;
  }
}

export function logoutUser() {
  api.auth.logout();
  localStorage.removeItem(SESSION_KEY);
}

export async function updateUser(userId, changes) {
  try {
    const user = await api.auth.updateProfile(changes);
    return user;
  } catch (err) {
    const users = getUsers().map((u) => (u.id === userId ? { ...u, ...changes } : u));
    write(USERS_KEY, users);
    const updated = users.find((u) => u.id === userId);
    authStorage.setUser(updated);
    return updated;
  }
}

export async function resetPassword(email, newPassword) {
  try {
    await api.auth.resetPassword(email, newPassword);
    return true;
  } catch (err) {
    const users = getUsers();
    const idx = users.findIndex((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (idx < 0) throw new Error('No ReedShelf account was found with that email.');
    if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
    users[idx] = { ...users[idx], password: newPassword };
    write(USERS_KEY, users);
    return true;
  }
}

// Book operations
export const getBooks = () => read(BOOKS_KEY, []);
export const getUserBooks = (userId) => {
  const books = getBooks();
  if (!userId) return books;
  return books.filter((b) => b.uploadedBy === userId || !b.uploadedBy);
};

export async function fetchBooks() {
  try {
    const books = await api.books.list();
    write(BOOKS_KEY, books);
    return books;
  } catch (err) {
    console.warn('Could not fetch books from backend, using local store:', err.message);
    return getBooks();
  }
}

export async function uploadBookFile(file, metadata) {
  return await api.books.upload(file, metadata);
}
export const uploadBookFileToCloudflare = uploadBookFile;

export function addBook(book) {
  const item = { id: uid('book'), ...book, createdAt: new Date().toISOString() };
  write(BOOKS_KEY, [item, ...getBooks()]);
  return item;
}

export async function updateBook(id, changes) {
  try {
    await api.books.update(id, changes);
  } catch (err) {
    console.warn('Could not update book on backend:', err.message);
  }
  write(
    BOOKS_KEY,
    getBooks().map((b) => (b.id === id ? { ...b, ...changes } : b))
  );
}

export async function deleteBook(id) {
  try {
    await api.books.delete(id);
  } catch (err) {
    console.warn('Could not delete book from backend:', err.message);
  }

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

// Progress
export const getProgress = (userId, bookId) =>
  read(PROGRESS_KEY, {})[`${userId}:${bookId}`] || { page: 1, updatedAt: null };

export async function fetchProgress(bookId) {
  try {
    const res = await api.progress.get(bookId);
    const user = getCurrentUser();
    if (user) {
      const all = read(PROGRESS_KEY, {});
      all[`${user.id}:${bookId}`] = res;
      write(PROGRESS_KEY, all);
    }
    return res;
  } catch (err) {
    const user = getCurrentUser();
    return user ? getProgress(user.id, bookId) : { page: 1, updatedAt: null };
  }
}

export async function saveProgress(userId, bookId, page) {
  const all = read(PROGRESS_KEY, {});
  all[`${userId}:${bookId}`] = {
    page: Math.max(1, Number(page) || 1),
    updatedAt: new Date().toISOString(),
  };
  write(PROGRESS_KEY, all);

  try {
    await api.progress.save(bookId, page);
  } catch (err) {
    // Background sync error ignored
  }
}

// Reading Plans
export const getPlans = () => read(PLANS_KEY, []);
export const getUserPlans = (userId) => getPlans().filter((p) => p.userId === userId);

export async function fetchPlans() {
  try {
    const plans = await api.plans.list();
    write(PLANS_KEY, plans);
    return plans;
  } catch (err) {
    console.warn('Could not fetch plans from backend:', err.message);
    return getPlans();
  }
}

export async function addPlan(plan) {
  try {
    const created = await api.plans.create(plan);
    write(PLANS_KEY, [created, ...getPlans()]);
    return created;
  } catch (err) {
    const item = {
      id: uid('plan'),
      ...plan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    write(PLANS_KEY, [item, ...getPlans()]);
    return item;
  }
}

export async function deletePlan(id) {
  try {
    await api.plans.delete(id);
  } catch (err) {
    console.warn('Could not delete plan on backend:', err.message);
  }
  write(
    PLANS_KEY,
    getPlans().filter((p) => p.id !== id)
  );
}

// User Settings
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

export async function fetchSettings() {
  try {
    const s = await api.settings.get();
    const user = getCurrentUser();
    if (user) {
      const all = read(SETTINGS_KEY, {});
      all[user.id] = s;
      write(SETTINGS_KEY, all);
    }
    return s;
  } catch (err) {
    const user = getCurrentUser();
    return user ? getSettings(user.id) : defaultSettings;
  }
}

export async function saveSettings(userId, changes) {
  const all = read(SETTINGS_KEY, {});
  const merged = { ...getSettings(userId), ...changes };
  all[userId] = merged;
  write(SETTINGS_KEY, all);

  try {
    await api.settings.save(merged);
  } catch (err) {
    // Ignore offline error
  }
}

// Highlights
export const getHighlights = (userId, bookId) =>
  read(HIGHLIGHTS_KEY, {})[`${userId}:${bookId}`] || [];

export async function fetchHighlights(bookId) {
  try {
    const hls = await api.highlights.list(bookId);
    const user = getCurrentUser();
    if (user) {
      const all = read(HIGHLIGHTS_KEY, {});
      all[`${user.id}:${bookId}`] = hls;
      write(HIGHLIGHTS_KEY, all);
    }
    return hls;
  } catch (err) {
    const user = getCurrentUser();
    return user ? getHighlights(user.id, bookId) : [];
  }
}

export async function saveHighlight(userId, bookId, highlight) {
  const all = read(HIGHLIGHTS_KEY, {});
  const key = `${userId}:${bookId}`;
  const localItem = { id: uid('highlight'), ...highlight, createdAt: new Date().toISOString() };
  all[key] = [...(all[key] || []), localItem];
  write(HIGHLIGHTS_KEY, all);

  try {
    const saved = await api.highlights.create(bookId, highlight);
    return all[key].map((h) => (h.id === localItem.id ? saved : h));
  } catch (err) {
    return all[key];
  }
}

export async function deleteHighlight(userId, bookId, id) {
  const all = read(HIGHLIGHTS_KEY, {});
  const key = `${userId}:${bookId}`;
  all[key] = (all[key] || []).filter((h) => h.id !== id);
  write(HIGHLIGHTS_KEY, all);

  try {
    await api.highlights.delete(id);
  } catch (err) {
    // Ignore error
  }
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

  let dataToStore = file;
  if (file instanceof File || file instanceof Blob) {
    try {
      dataToStore = await file.arrayBuffer();
    } catch {
      dataToStore = file;
    }
  }

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

function cloneFileData(data) {
  if (data instanceof ArrayBuffer) return data.slice(0);
  if (ArrayBuffer.isView(data)) return data.slice();
  return data;
}

export async function getBookFile(bookId) {
  if (!bookId) return null;

  // 1. Try fetching directly from Backend / Cloudflare R2
  try {
    const arrayBuffer = await api.books.getFileData(bookId);
    if (arrayBuffer && arrayBuffer.byteLength > 0) {
      memoryFileCache.set(bookId, arrayBuffer);
      return cloneFileData(arrayBuffer);
    }
  } catch (err) {
    console.warn(`[Reader] Could not stream book ${bookId} from backend, checking local cache:`, err.message);
  }

  // 2. Check memory cache
  if (memoryFileCache.has(bookId)) {
    return cloneFileData(memoryFileCache.get(bookId));
  }

  // 3. Check IndexedDB
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

export { api, authStorage };
