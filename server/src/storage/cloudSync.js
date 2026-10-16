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

    // 1. Ingest cloud users from metadata/users.json into local database
    if (Array.isArray(cloudUsers)) {
      for (const u of cloudUsers) {
        if (!u || !u.id || !u.email) continue;
        const normalizedEmail = (u.email || '').trim().toLowerCase();
        const existingLocal = localUserMap.get(u.id) || localUsers.find(lu => (lu.email || '').toLowerCase() === normalizedEmail);

        if (!existingLocal) {
          try {
            db.run(
              `INSERT INTO users (
                id, name, email, password, avatar, role, status,
                created_at, two_factor_enabled, two_factor_secret, google_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                u.id,
                u.name || 'Reader',
                normalizedEmail,
                u.password || '',
                u.avatar || null,
                u.role || 'user',
                u.status || 'active',
                u.created_at || u.createdAt || new Date().toISOString(),
                u.two_factor_enabled ? 1 : 0,
                u.two_factor_secret || null,
                u.google_id || null,
              ]
            );
            localUserMap.set(u.id, u);
          } catch {
            // Ignore collision
          }
        } else {
          // If cloud has an updated avatar, name, or password, sync to local SQLite
          if (u.avatar !== undefined && u.avatar !== existingLocal.avatar) {
            db.run('UPDATE users SET avatar = ? WHERE id = ?', [u.avatar || null, existingLocal.id]);
            existingLocal.avatar = u.avatar;
          }
          if (u.name && u.name !== existingLocal.name) {
            db.run('UPDATE users SET name = ? WHERE id = ?', [u.name, existingLocal.id]);
            existingLocal.name = u.name;
          }
          if (u.password && u.password !== existingLocal.password) {
            db.run('UPDATE users SET password = ? WHERE id = ?', [u.password, existingLocal.id]);
            existingLocal.password = u.password;
          }
        }
      }
    }

    // 2. Also check Supabase PostgreSQL public.users table to catch any users stored there
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: sbUsers, error: sbErr } = await supabase.from('users').select('*');
        if (!sbErr && Array.isArray(sbUsers)) {
          for (const sbu of sbUsers) {
            if (!sbu || !sbu.id || !sbu.email) continue;
            const sbEmail = (sbu.email || '').trim().toLowerCase();
            const existingInCloud = cloudUserMap.get(sbu.id) || Array.from(cloudUserMap.values()).find(x => (x.email || '').toLowerCase() === sbEmail);

            if (!existingInCloud) {
              const uObj = {
                id: sbu.id,
                name: sbu.name || 'Reader',
                email: sbEmail,
                password: sbu.password || '',
                avatar: sbu.avatar || null,
                role: sbu.role || 'user',
                status: sbu.status || 'active',
                created_at: sbu.created_at || new Date().toISOString(),
                createdAt: sbu.created_at || new Date().toISOString(),
                two_factor_enabled: false,
                two_factor_secret: null,
                google_id: null,
              };
              cloudUserMap.set(sbu.id, uObj);
              needsCloudUpdate = true;
            }

            const existingLocal = localUserMap.get(sbu.id) || localUsers.find(lu => (lu.email || '').toLowerCase() === sbEmail);
            if (!existingLocal) {
              try {
                db.run(
                  `INSERT INTO users (
                    id, name, email, password, avatar, role, status,
                    created_at, two_factor_enabled, two_factor_secret, google_id
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    sbu.id,
                    sbu.name || 'Reader',
                    sbEmail,
                    sbu.password || (existingInCloud?.password || ''),
                    sbu.avatar || null,
                    sbu.role || 'user',
                    sbu.status || 'active',
                    sbu.created_at || new Date().toISOString(),
                    0,
                    null,
                    null,
                  ]
                );
                localUserMap.set(sbu.id, sbu);
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn('[CloudSync] Postgres users fetch notice:', err.message);
      }
    }

    // 3. Export any local users to cloud map if not already present
    for (const u of localUsers) {
      if (!u || !u.id || !u.email) continue;
      const uEmail = (u.email || '').trim().toLowerCase();
      const existingInCloud = cloudUserMap.get(u.id) || Array.from(cloudUserMap.values()).find(x => (x.email || '').toLowerCase() === uEmail);
      if (!existingInCloud) {
        cloudUserMap.set(u.id, {
          id: u.id,
          name: u.name,
          email: uEmail,
          password: u.password,
          avatar: u.avatar,
          role: u.role,
          status: u.status,
          created_at: u.created_at || new Date().toISOString(),
          createdAt: u.created_at || new Date().toISOString(),
          two_factor_enabled: Boolean(u.two_factor_enabled),
          two_factor_secret: u.two_factor_secret,
          google_id: u.google_id,
        });
        needsCloudUpdate = true;
      }
    }

    // 4. Save merged list back to Supabase Storage users.json
    if (needsCloudUpdate || (Array.isArray(cloudUsers) && cloudUsers.length < cloudUserMap.size)) {
      const merged = Array.from(cloudUserMap.values());
      await supabaseStorage.saveMetadata('users.json', merged);
    }

    // 5. Upsert to Supabase PostgreSQL public.users with password and conflict resolution
    if (supabase) {
      try {
        const usersToUpsert = Array.from(cloudUserMap.values()).map((u) => ({
          id: u.id,
          name: u.name || 'Reader',
          email: (u.email || '').trim().toLowerCase(),
          password: u.password || null,
          avatar: u.avatar || null,
          role: u.role || 'user',
          status: u.status || 'active',
          created_at: u.created_at || u.createdAt || new Date().toISOString(),
        }));
        if (usersToUpsert.length > 0) {
          await supabase.from('users').upsert(usersToUpsert, { onConflict: 'email' });
        }
      } catch {
        // Table or constraint may vary
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
    const userEmail = (user.email || '').trim().toLowerCase();
    const normalized = {
      id: user.id,
      name: (user.name || 'Reader').trim(),
      email: userEmail,
      password: user.password || '',
      avatar: user.avatar || null,
      role: user.role || 'user',
      status: user.status || 'active',
      two_factor_enabled: Boolean(user.two_factor_enabled || user.twoFactorEnabled),
      two_factor_secret: user.two_factor_secret || null,
      google_id: user.google_id || null,
      created_at: user.created_at || user.createdAt || new Date().toISOString(),
      createdAt: user.createdAt || user.created_at || new Date().toISOString(),
    };

    // 1. Save directly into Supabase Storage persistent metadata/users.json
    const cloudUsers = (await supabaseStorage.getMetadata('users.json')) || [];
    const filtered = cloudUsers.filter(
      (u) => u && u.id !== normalized.id && (u.email || '').trim().toLowerCase() !== userEmail
    );
    filtered.unshift(normalized);
    await supabaseStorage.saveMetadata('users.json', filtered);
    console.log(`[CloudSync] Successfully saved user ${userEmail} (${normalized.id}) to users.json`);

    // 2. Also save to Supabase PostgreSQL public.users table with hashed password
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error: upsertErr } = await supabase.from('users').upsert({
          id: normalized.id,
          name: normalized.name,
          email: normalized.email,
          password: normalized.password || null,
          avatar: normalized.avatar || null,
          role: normalized.role || 'user',
          status: normalized.status || 'active',
          created_at: normalized.created_at,
        }, { onConflict: 'email' });
        if (upsertErr) {
          console.warn('[CloudSync] Supabase DB upsert notice:', upsertErr.message);
        }
      } catch (dbErr) {
        console.warn('[CloudSync] Supabase DB exception:', dbErr.message);
      }
    }

    // 3. Ensure user is in local database cache
    try {
      db.run(
        `INSERT INTO users (
          id, name, email, password, avatar, role, status,
          created_at, two_factor_enabled, two_factor_secret, google_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized.id,
          normalized.name,
          normalized.email,
          normalized.password,
          normalized.avatar,
          normalized.role,
          normalized.status,
          normalized.created_at,
          normalized.two_factor_enabled ? 1 : 0,
          normalized.two_factor_secret,
          normalized.google_id,
        ]
      );
    } catch {
      try {
        db.run(
          'UPDATE users SET name = ?, email = ?, password = ?, avatar = ?, role = ?, status = ? WHERE id = ?',
          [normalized.name, normalized.email, normalized.password, normalized.avatar, normalized.role, normalized.status, normalized.id]
        );
      } catch {}
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
                b.uploaded_by || b.uploadedBy || null,
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
 * Remove a book from cloud metadata and Supabase PostgreSQL
 */
export async function removeBookFromCloud(bookId) {
  try {
    const cloudBooks = (await supabaseStorage.getMetadata('books.json')) || [];
    const filtered = cloudBooks.filter((b) => b && b.id !== bookId);
    await supabaseStorage.saveMetadata('books.json', filtered);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('reading_progress').delete().eq('book_id', bookId);
        await supabase.from('highlights').delete().eq('book_id', bookId);
        await supabase.from('reading_plans').delete().eq('book_id', bookId);
        await supabase.from('books').delete().eq('id', bookId);
      } catch (sbErr) {
        console.warn('[CloudSync] removeBook Supabase DB cleanup notice:', sbErr.message);
      }
    }
  } catch (err) {
    console.warn('[CloudSync] removeBook notice:', err.message);
  }
}

/**
 * Remove a user and all their books from cloud storage metadata and Supabase PostgreSQL
 */
export async function removeUserFromCloud(userId) {
  try {
    // 1. Remove user from users.json
    const cloudUsers = (await supabaseStorage.getMetadata('users.json')) || [];
    const filteredUsers = cloudUsers.filter((u) => u && u.id !== userId);
    await supabaseStorage.saveMetadata('users.json', filteredUsers);

    // 2. Remove all user's books from books.json
    const cloudBooks = (await supabaseStorage.getMetadata('books.json')) || [];
    const filteredBooks = cloudBooks.filter((b) => {
      const owner = b && (b.uploaded_by || b.uploadedBy);
      return owner !== userId;
    });
    await supabaseStorage.saveMetadata('books.json', filteredBooks);

    // 3. Remove all user's reading plans from plans.json
    const cloudPlans = (await supabaseStorage.getMetadata('plans.json')) || [];
    const filteredPlans = cloudPlans.filter((p) => {
      const owner = p && (p.user_id || p.userId);
      return owner !== userId;
    });
    await supabaseStorage.saveMetadata('plans.json', filteredPlans);

    // 4. Clean up Supabase PostgreSQL tables
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('reading_progress').delete().eq('user_id', userId);
        await supabase.from('highlights').delete().eq('user_id', userId);
        await supabase.from('reading_plans').delete().eq('user_id', userId);
        await supabase.from('books').delete().eq('uploaded_by', userId);
        await supabase.from('users').delete().eq('id', userId);
      } catch (sbErr) {
        console.warn('[CloudSync] removeUser Supabase DB cleanup notice:', sbErr.message);
      }
    }
  } catch (err) {
    console.warn('[CloudSync] removeUser notice:', err.message);
  }
}

let lastPlansSync = 0;

/**
 * Synchronize all reading plans between SQLite and Supabase Storage metadata
 */
export async function syncPlansFromCloud(force = false) {
  const now = Date.now();
  if (!force && now - lastPlansSync < SYNC_INTERVAL_MS) {
    return db.all('SELECT * FROM reading_plans ORDER BY created_at DESC');
  }
  lastPlansSync = now;

  try {
    const cloudPlans = await supabaseStorage.getMetadata('plans.json');
    const localPlans = db.all('SELECT * FROM reading_plans');
    const localPlanMap = new Map(localPlans.map((p) => [p.id, p]));
    const cloudPlanMap = new Map(Array.isArray(cloudPlans) ? cloudPlans.map((p) => [p.id, p]) : []);

    let needsCloudUpdate = false;

    // 1. Ingest cloud plans into local database
    if (Array.isArray(cloudPlans)) {
      for (const p of cloudPlans) {
        if (!localPlanMap.has(p.id)) {
          try {
            db.run(
              `INSERT INTO reading_plans (
                id, user_id, book_id, start_date, target_date, days,
                pages_per_day, total_pages, created_at, updated_at,
                plan_type, group_name, group_members
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                p.id,
                p.user_id || p.userId,
                p.book_id || p.bookId,
                p.start_date || p.startDate,
                p.target_date || p.targetDate,
                p.days,
                p.pages_per_day || p.pagesPerDay,
                p.total_pages || p.totalPages,
                p.created_at || p.createdAt || new Date().toISOString(),
                p.updated_at || p.updatedAt || new Date().toISOString(),
                p.plan_type || p.planType || 'individual',
                p.group_name || p.groupName || '',
                typeof p.group_members === 'string' ? p.group_members : JSON.stringify(p.members || p.group_members || []),
              ]
            );
            localPlanMap.set(p.id, p);
          } catch {
            // Ignore collision
          }
        }
      }
    }

    // 2. Export local plans to cloud map
    for (const p of localPlans) {
      if (!cloudPlanMap.has(p.id)) {
        cloudPlanMap.set(p.id, {
          id: p.id,
          user_id: p.user_id,
          book_id: p.book_id,
          start_date: p.start_date,
          target_date: p.target_date,
          days: p.days,
          pages_per_day: p.pages_per_day,
          total_pages: p.total_pages,
          created_at: p.created_at,
          updated_at: p.updated_at,
          plan_type: p.plan_type,
          group_name: p.group_name,
          group_members: p.group_members,
        });
        needsCloudUpdate = true;
      }
    }

    // 3. Save merged list back to Supabase Storage
    if (needsCloudUpdate || (Array.isArray(cloudPlans) && cloudPlans.length < cloudPlanMap.size)) {
      const merged = Array.from(cloudPlanMap.values());
      await supabaseStorage.saveMetadata('plans.json', merged);
    }
  } catch (err) {
    console.warn('[CloudSync] Plan sync notice:', err.message);
  }

  return db.all('SELECT * FROM reading_plans ORDER BY created_at DESC');
}

/**
 * Record a new or updated reading plan in cloud metadata
 */
export async function recordPlanInCloud(plan) {
  try {
    const cloudPlans = (await supabaseStorage.getMetadata('plans.json')) || [];
    const targetUserId = plan.userId || plan.user_id;
    const targetBookId = plan.bookId || plan.book_id;
    const filtered = cloudPlans.filter((p) => p && p.id !== plan.id && !(p.user_id === targetUserId && p.book_id === targetBookId));
    filtered.unshift({
      id: plan.id,
      user_id: plan.userId || plan.user_id,
      book_id: plan.bookId || plan.book_id,
      start_date: plan.startDate || plan.start_date,
      target_date: plan.targetDate || plan.target_date,
      days: plan.days,
      pages_per_day: plan.pagesPerDay || plan.pages_per_day,
      total_pages: plan.totalPages || plan.total_pages,
      plan_type: plan.planType || plan.plan_type || 'individual',
      group_name: plan.groupName || plan.group_name || '',
      group_members: typeof plan.group_members === 'string' ? plan.group_members : JSON.stringify(plan.members || []),
      created_at: plan.createdAt || plan.created_at || new Date().toISOString(),
      updated_at: plan.updatedAt || plan.updated_at || new Date().toISOString(),
    });
    await supabaseStorage.saveMetadata('plans.json', filtered);
  } catch (err) {
    console.warn('[CloudSync] recordPlan notice:', err.message);
  }
}

/**
 * Remove a plan from cloud metadata
 */
export async function removePlanFromCloud(planId) {
  try {
    const cloudPlans = (await supabaseStorage.getMetadata('plans.json')) || [];
    const filtered = cloudPlans.filter((p) => p.id !== planId);
    await supabaseStorage.saveMetadata('plans.json', filtered);
  } catch (err) {
    console.warn('[CloudSync] removePlan notice:', err.message);
  }
}
