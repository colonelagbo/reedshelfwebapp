import { db } from '../db.js';
import { supabaseStorage, getSupabaseClient } from './supabase.js';

let lastUsersSync = 0;
let lastBooksSync = 0;
const SYNC_INTERVAL_MS = 5000; // Synchronize at most every 5 seconds per instance

/**
 * Synchronize all users between SQLite and Supabase Storage persistent metadata
 */
export async function syncUsersFromCloud(force = false) {
  const now = Date.now();
  if (!force && now - lastUsersSync < SYNC_INTERVAL_MS) {
    return db.all('SELECT * FROM users ORDER BY created_at DESC');
  }
  lastUsersSync = now;

  try {
    const cloudUsers = await supabaseStorage.getMetadata('users.json');
    const localUsers = db.all('SELECT * FROM users');
    const localUserMap = new Map(localUsers.map((u) => [u.id, u]));
    const cloudUserMap = new Map(Array.isArray(cloudUsers) ? cloudUsers.map((u) => [u.id, u]) : []);

    let needsCloudUpdate = false;

    // 1. Ingest cloud users into local database
    if (Array.isArray(cloudUsers)) {
      for (const u of cloudUsers) {
        if (!localUserMap.has(u.id)) {
          try {
            db.run(
              `INSERT INTO users (
                id, name, email, password, avatar, role, status,
                created_at, two_factor_enabled, two_factor_secret, google_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                u.id,
                u.name,
                u.email,
                u.password || '',
                u.avatar || null,
                u.role || 'user',
                u.status || 'active',
                u.created_at || new Date().toISOString(),
                u.two_factor_enabled ? 1 : 0,
                u.two_factor_secret || null,
                u.google_id || null,
              ]
            );
            localUserMap.set(u.id, u);
          } catch {
            // Ignore collision
          }
        }
      }
    }

    // 2. Export any local users to cloud map
    for (const u of localUsers) {
      if (!cloudUserMap.has(u.id)) {
        cloudUserMap.set(u.id, {
          id: u.id,
          name: u.name,
          email: u.email,
          password: u.password,
          avatar: u.avatar,
          role: u.role,
          status: u.status,
          created_at: u.created_at,
          two_factor_enabled: Boolean(u.two_factor_enabled),
          two_factor_secret: u.two_factor_secret,
          google_id: u.google_id,
        });
        needsCloudUpdate = true;
      }
    }

    // 3. Save merged list back to Supabase Storage if any new local users were found
    if (needsCloudUpdate || (Array.isArray(cloudUsers) && cloudUsers.length < cloudUserMap.size)) {
      const merged = Array.from(cloudUserMap.values());
      await supabaseStorage.saveMetadata('users.json', merged);
    }

    // 4. Try syncing with Supabase PostgreSQL public.users if table exists
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const usersToUpsert = Array.from(cloudUserMap.values()).map((u) => ({
          id: u.id,
          name: u.name || 'Reader',
          email: u.email,
          avatar: u.avatar || null,
          role: u.role || 'user',
          status: u.status || 'active',
          created_at: u.created_at || new Date().toISOString(),
        }));
        if (usersToUpsert.length > 0) {
          await supabase.from('users').upsert(usersToUpsert, { onConflict: 'id' });
        }
      } catch {
        // Table may not exist yet
      }
    }
  } catch (err) {
    console.warn('[CloudSync] User sync notice:', err.message);
  }

  return db.all('SELECT * FROM users ORDER BY created_at DESC');
}

/**
 * Record a newly registered or updated user
 */
export async function recordUser(user) {
  try {
    const cloudUsers = (await supabaseStorage.getMetadata('users.json')) || [];
    const filtered = cloudUsers.filter((u) => u.id !== user.id && u.email.toLowerCase() !== user.email.toLowerCase());
    filtered.push(user);
    await supabaseStorage.saveMetadata('users.json', filtered);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('users').upsert({
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar || null,
          role: user.role || 'user',
          status: user.status || 'active',
          created_at: user.created_at,
        }, { onConflict: 'id' });
      } catch {
        // Safe if table not yet migrated
      }
    }
  } catch (err) {
    console.warn('[CloudSync] recordUser notice:', err.message);
  }
}

/**
 * Synchronize all books between SQLite and Supabase Storage persistent metadata
 */
export async function syncBooksFromCloud(force = false) {
  const now = Date.now();
  if (!force && now - lastBooksSync < SYNC_INTERVAL_MS) {
    return db.all('SELECT * FROM books ORDER BY created_at DESC');
  }
  lastBooksSync = now;

  try {
    const cloudBooks = await supabaseStorage.getMetadata('books.json');
    const localBooks = db.all('SELECT * FROM books');
    const localBookMap = new Map(localBooks.map((b) => [b.id, b]));
    const cloudBookMap = new Map(Array.isArray(cloudBooks) ? cloudBooks.map((b) => [b.id, b]) : []);

    let needsCloudUpdate = false;

    // 1. Ingest cloud books into local SQLite database
    if (Array.isArray(cloudBooks)) {
      for (const b of cloudBooks) {
        if (!localBookMap.has(b.id)) {
          try {
            db.run(
              `INSERT INTO books (
                id, title, author, file_name, file_type, file_size,
                total_pages, uploaded_by, r2_key, cover_data_url, cover_url, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                b.id,
                b.title,
                b.author,
                b.file_name || b.fileName || '',
                b.file_type || b.fileType || 'application/pdf',
                b.file_size || b.size || 0,
                b.total_pages || b.totalPages || 0,
                b.uploaded_by || b.uploadedBy || 'demo_user',
                b.r2_key || b.r2Key || null,
                b.cover_data_url || b.coverDataUrl || null,
                b.cover_url || b.coverUrl || null,
                b.created_at || b.createdAt || new Date().toISOString(),
              ]
            );
            localBookMap.set(b.id, b);
          } catch {
            // Ignore collision
          }
        }
      }
    }

    // 2. Export local books to cloud map
    for (const b of localBooks) {
      if (!cloudBookMap.has(b.id)) {
        cloudBookMap.set(b.id, {
          id: b.id,
          title: b.title,
          author: b.author,
          file_name: b.file_name,
          file_type: b.file_type,
          file_size: b.file_size,
          total_pages: b.total_pages,
          uploaded_by: b.uploaded_by,
          r2_key: b.r2_key,
          cover_data_url: b.cover_data_url,
          cover_url: b.cover_url,
          created_at: b.created_at,
        });
        needsCloudUpdate = true;
      }
    }

    // 3. Save merged list back to Supabase Storage
    if (needsCloudUpdate || (Array.isArray(cloudBooks) && cloudBooks.length < cloudBookMap.size)) {
      const merged = Array.from(cloudBookMap.values());
      await supabaseStorage.saveMetadata('books.json', merged);
    }
  } catch (err) {
    console.warn('[CloudSync] Book sync notice:', err.message);
  }

  return db.all('SELECT * FROM books ORDER BY created_at DESC');
}

/**
 * Record a newly uploaded book across all persistent storage targets
 */
export async function recordBook(book) {
  try {
    const cloudBooks = (await supabaseStorage.getMetadata('books.json')) || [];
    const filtered = cloudBooks.filter((b) => b.id !== book.id);
    filtered.unshift({
      id: book.id,
      title: book.title,
      author: book.author,
      file_name: book.file_name || book.fileName,
      file_type: book.file_type || book.fileType || 'application/pdf',
      file_size: book.file_size || book.size || 0,
      total_pages: book.total_pages || book.totalPages || 0,
      uploaded_by: book.uploaded_by || book.uploadedBy,
      r2_key: book.r2_key || book.r2Key,
      cover_data_url: book.cover_data_url || book.coverDataUrl || null,
      cover_url: book.cover_url || book.coverUrl || null,
      created_at: book.created_at || book.createdAt || new Date().toISOString(),
    });
    await supabaseStorage.saveMetadata('books.json', filtered);
  } catch (err) {
    console.warn('[CloudSync] recordBook notice:', err.message);
  }
}

/**
 * Remove a book from cloud metadata
 */
export async function removeBookFromCloud(bookId) {
  try {
    const cloudBooks = (await supabaseStorage.getMetadata('books.json')) || [];
    const filtered = cloudBooks.filter((b) => b.id !== bookId);
    await supabaseStorage.saveMetadata('books.json', filtered);
  } catch (err) {
    console.warn('[CloudSync] removeBook notice:', err.message);
  }
}
