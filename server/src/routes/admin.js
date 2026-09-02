import express from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { supabaseStorage } from '../storage/supabase.js';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { requireAdmin } from '../middleware/auth.js';

export const adminRouter = express.Router();

// Enforce requireAdmin on all routes except /setup-first-admin
adminRouter.use((req, res, next) => {
  if (req.path === '/setup-first-admin') {
    return next();
  }
  return requireAdmin(req, res, next);
});

const uid = (prefix = 'log') => `${prefix}_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

// Helper: Get Supabase Admin Client for auth operations
let supabaseAdminClient = null;
function getSupabaseAdmin() {
  if (!supabaseAdminClient && config.isSupabaseConfigured()) {
    supabaseAdminClient = createClient(config.supabase.url, config.supabase.key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket }
    });
  }
  return supabaseAdminClient;
}

// Helper: Log administrative action
function logAudit(admin, action, { targetType = null, targetId = null, targetEmail = null, details = null } = {}) {
  try {
    const logId = uid('audit');
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO admin_audit_logs (
        id, admin_id, admin_email, action, target_type, target_id, target_email, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [logId, admin.id, admin.email, action, targetType, targetId, targetEmail, details, now]
    );
  } catch (err) {
    console.warn('[Admin Audit Warning] Failed to log action:', err.message);
  }
}

// Helper: Format bytes cleanly
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ============================================================================
// 1. GET /api/admin/overview
// ============================================================================
adminRouter.get('/overview', async (req, res) => {
  try {
    const totalUsersRow = db.get('SELECT COUNT(*) as count FROM users');
    const totalUsers = totalUsersRow?.count || 0;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const newTodayRow = db.get('SELECT COUNT(*) as count FROM users WHERE created_at >= ?', [todayStart]);
    const newWeekRow = db.get('SELECT COUNT(*) as count FROM users WHERE created_at >= ?', [weekAgo]);
    const newMonthRow = db.get('SELECT COUNT(*) as count FROM users WHERE created_at >= ?', [monthAgo]);

    const totalBooksRow = db.get('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM books');
    const totalBooks = totalBooksRow?.count || 0;
    const storageUsedBytes = Number(totalBooksRow?.size || 0);

    const settingLimit = db.get("SELECT value FROM admin_settings WHERE key = 'storage_limit_gb'");
    const storageLimitGb = parseFloat(settingLimit?.value || '100');
    const storageLimitBytes = storageLimitGb * 1024 * 1024 * 1024;
    const storageAvailableBytes = Math.max(0, storageLimitBytes - storageUsedBytes);
    const storageUsagePercentage = storageLimitBytes > 0
      ? parseFloat(((storageUsedBytes / storageLimitBytes) * 100).toFixed(2))
      : 0;

    let warningLevel = 'normal';
    if (storageUsagePercentage >= 95) warningLevel = 'critical';
    else if (storageUsagePercentage >= 90) warningLevel = 'high';
    else if (storageUsagePercentage >= 80) warningLevel = 'warning';

    const activeUsersRow = db.get('SELECT COUNT(DISTINCT user_id) as count FROM reading_progress WHERE page > 1');
    const activeUsers = activeUsersRow?.count || 0;

    // Top 5 users by storage usage
    const topUsersRaw = db.all(`
      SELECT 
        u.id, u.name, u.email, u.avatar, u.role, u.status, u.created_at,
        COUNT(b.id) as books_count,
        COALESCE(SUM(b.file_size), 0) as storage_bytes
      FROM users u
      LEFT JOIN books b ON b.uploaded_by = u.id
      GROUP BY u.id
      ORDER BY storage_bytes DESC
      LIMIT 5
    `);

    const topStorageUsers = topUsersRaw.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role || 'user',
      status: u.status || 'active',
      booksCount: Number(u.books_count || 0),
      storageUsedBytes: Number(u.storage_bytes || 0),
      formattedStorage: formatBytes(Number(u.storage_bytes || 0)),
      createdAt: u.created_at
    }));

    // Recent 6 audit logs
    const recentAudit = db.all('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 6');

    res.json({
      totalUsers,
      newUsersToday: newTodayRow?.count || 0,
      newUsersThisWeek: newWeekRow?.count || 0,
      newUsersThisMonth: newMonthRow?.count || 0,
      totalBooks,
      totalFiles: totalBooks,
      storageUsedBytes,
      formattedStorageUsed: formatBytes(storageUsedBytes),
      storageLimitGb,
      storageLimitBytes,
      formattedStorageLimit: `${storageLimitGb} GB`,
      storageAvailableBytes,
      formattedStorageAvailable: formatBytes(storageAvailableBytes),
      storageUsagePercentage,
      warningLevel,
      activeUsers,
      topStorageUsers,
      recentAudit
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to retrieve administrative overview.' });
  }
});

// ============================================================================
// 2. GET /api/admin/storage
// ============================================================================
adminRouter.get('/storage', async (req, res) => {
  try {
    const booksStat = db.get('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM books');
    const totalBooks = booksStat?.count || 0;
    const storageUsedBytes = Number(booksStat?.size || 0);

    const settingLimit = db.get("SELECT value FROM admin_settings WHERE key = 'storage_limit_gb'");
    const storageLimitGb = parseFloat(settingLimit?.value || '100');
    const storageLimitBytes = storageLimitGb * 1024 * 1024 * 1024;
    const storageAvailableBytes = Math.max(0, storageLimitBytes - storageUsedBytes);
    const storageUsagePercentage = storageLimitBytes > 0
      ? parseFloat(((storageUsedBytes / storageLimitBytes) * 100).toFixed(2))
      : 0;

    let warningLevel = 'normal';
    if (storageUsagePercentage >= 95) warningLevel = 'critical';
    else if (storageUsagePercentage >= 90) warningLevel = 'high';
    else if (storageUsagePercentage >= 80) warningLevel = 'warning';

    const connTest = await supabaseStorage.testConnection();

    res.json({
      totalBooks,
      totalFiles: totalBooks,
      storageUsedBytes,
      formattedStorageUsed: formatBytes(storageUsedBytes),
      storageLimitGb,
      storageLimitBytes,
      formattedStorageLimit: `${storageLimitGb} GB`,
      storageAvailableBytes,
      formattedStorageAvailable: formatBytes(storageAvailableBytes),
      storageUsagePercentage,
      warningLevel,
      supabaseStatus: {
        configured: config.isSupabaseConfigured(),
        bucket: config.supabase.bucketName,
        url: config.supabase.url,
        connected: connTest.connected,
        message: connTest.message
      }
    });
  } catch (err) {
    console.error('Admin storage error:', err);
    res.status(500).json({ error: 'Failed to retrieve storage statistics.' });
  }
});

// ============================================================================
// 3. GET /api/admin/storage/users (Detailed storage by user)
// ============================================================================
adminRouter.get('/storage/users', (req, res) => {
  try {
    const { search, role, status, sort = 'storage', order = 'desc', page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(5, parseInt(limit, 10)));

    let sql = `
      SELECT 
        u.id, u.name, u.email, u.avatar, u.role, u.status, u.created_at,
        COUNT(b.id) as books_count,
        COALESCE(SUM(b.file_size), 0) as storage_bytes
      FROM users u
      LEFT JOIN books b ON b.uploaded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ' AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)';
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    if (role && role !== 'all') {
      sql += ' AND u.role = ?';
      params.push(role);
    }

    if (status && status !== 'all') {
      sql += ' AND u.status = ?';
      params.push(status);
    }

    sql += ' GROUP BY u.id';

    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    if (sort === 'books') {
      sql += ` ORDER BY books_count ${sortOrder}`;
    } else if (sort === 'date') {
      sql += ` ORDER BY u.created_at ${sortOrder}`;
    } else if (sort === 'name') {
      sql += ` ORDER BY u.name ${sortOrder}`;
    } else {
      sql += ` ORDER BY storage_bytes ${sortOrder}`;
    }

    const allMatched = db.all(sql, params);
    const total = allMatched.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const pageItems = allMatched.slice(offset, offset + limitNum);

    const users = pageItems.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role || 'user',
      status: u.status || 'active',
      booksCount: Number(u.books_count || 0),
      filesCount: Number(u.books_count || 0),
      storageUsedBytes: Number(u.storage_bytes || 0),
      formattedStorage: formatBytes(Number(u.storage_bytes || 0)),
      createdAt: u.created_at
    }));

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('Storage by user error:', err);
    res.status(500).json({ error: 'Failed to retrieve storage by user.' });
  }
});

// ============================================================================
// 4. GET /api/admin/users (User management list)
// ============================================================================
adminRouter.get('/users', (req, res) => {
  try {
    const { search, role, status, sort = 'date', order = 'desc', page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(5, parseInt(limit, 10)));

    let sql = `
      SELECT 
        u.id, u.name, u.email, u.avatar, u.role, u.status, u.created_at,
        COUNT(DISTINCT b.id) as books_count,
        COALESCE(SUM(b.file_size), 0) as storage_bytes,
        MAX(p.updated_at) as last_reading_at
      FROM users u
      LEFT JOIN books b ON b.uploaded_by = u.id
      LEFT JOIN reading_progress p ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ' AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)';
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    if (role && role !== 'all') {
      sql += ' AND u.role = ?';
      params.push(role);
    }

    if (status && status !== 'all') {
      sql += ' AND u.status = ?';
      params.push(status);
    }

    sql += ' GROUP BY u.id';

    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    if (sort === 'storage') {
      sql += ` ORDER BY storage_bytes ${sortOrder}`;
    } else if (sort === 'books') {
      sql += ` ORDER BY books_count ${sortOrder}`;
    } else if (sort === 'name') {
      sql += ` ORDER BY u.name ${sortOrder}`;
    } else {
      sql += ` ORDER BY u.created_at ${sortOrder}`;
    }

    const allMatched = db.all(sql, params);
    const total = allMatched.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const pageItems = allMatched.slice(offset, offset + limitNum);

    const users = pageItems.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role || 'user',
      status: u.status || 'active',
      booksCount: Number(u.books_count || 0),
      filesCount: Number(u.books_count || 0),
      storageUsedBytes: Number(u.storage_bytes || 0),
      formattedStorage: formatBytes(Number(u.storage_bytes || 0)),
      lastActivity: u.last_reading_at || null,
      createdAt: u.created_at
    }));

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('Admin users list error:', err);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// ============================================================================
// 5. GET /api/admin/users/:id (Detailed user inspection)
// ============================================================================
adminRouter.get('/users/:id', (req, res) => {
  try {
    const user = db.get('SELECT id, name, email, avatar, role, status, created_at FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const books = db.all(`
      SELECT b.*, p.page as current_page, p.updated_at as progress_updated_at
      FROM books b
      LEFT JOIN reading_progress p ON p.book_id = b.id AND p.user_id = ?
      WHERE b.uploaded_by = ?
      ORDER BY b.created_at DESC
    `, [user.id, user.id]);

    const totalStorageBytes = books.reduce((sum, b) => sum + (Number(b.file_size) || 0), 0);

    const plans = db.all(`
      SELECT p.*, b.title as book_title
      FROM reading_plans p
      LEFT JOIN books b ON b.id = p.book_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `, [user.id]);

    const highlightsCountRow = db.get('SELECT COUNT(*) as count FROM highlights WHERE user_id = ?', [user.id]);
    const highlightsCount = highlightsCountRow?.count || 0;

    res.json({
      user: {
        ...user,
        role: user.role || 'user',
        status: user.status || 'active',
        storageUsedBytes: totalStorageBytes,
        formattedStorage: formatBytes(totalStorageBytes),
        booksCount: books.length,
        plansCount: plans.length,
        highlightsCount
      },
      books: books.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        fileName: b.file_name,
        fileType: b.file_type,
        fileSize: b.file_size,
        formattedSize: formatBytes(b.file_size),
        totalPages: b.total_pages,
        currentPage: b.current_page || 1,
        progressUpdated: b.progress_updated_at || null,
        r2Key: b.r2_key,
        coverUrl: b.cover_url,
        createdAt: b.created_at
      })),
      plans: plans.map(p => ({
        id: p.id,
        bookId: p.book_id,
        bookTitle: p.book_title || 'Unknown Book',
        startDate: p.start_date,
        targetDate: p.target_date,
        days: p.days,
        pagesPerDay: p.pages_per_day,
        totalPages: p.total_pages,
        createdAt: p.created_at
      }))
    });
  } catch (err) {
    console.error('Admin user detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve user details.' });
  }
});

// ============================================================================
// 6. PUT /api/admin/users/:id/status (Suspend / Reactivate User)
// ============================================================================
adminRouter.put('/users/:id/status', (req, res) => {
  try {
    const targetId = req.params.id;
    const { status, reason } = req.body;

    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: "Status must be either 'active' or 'suspended'." });
    }

    const targetUser = db.get('SELECT * FROM users WHERE id = ?', [targetId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Safety: Admin cannot suspend themselves
    if (req.user.id === targetId && status === 'suspended') {
      return res.status(400).json({ error: 'You cannot suspend your own administrator account.' });
    }

    // Safety: Cannot suspend the last active administrator
    if (targetUser.role === 'admin' && status === 'suspended') {
      const activeAdminsRow = db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active'");
      if ((activeAdminsRow?.count || 0) <= 1) {
        return res.status(400).json({ error: 'Cannot suspend the only remaining active administrator account.' });
      }
    }

    db.run('UPDATE users SET status = ? WHERE id = ?', [status, targetId]);

    logAudit(req.user, status === 'suspended' ? 'user.suspend' : 'user.reactivate', {
      targetType: 'user',
      targetId,
      targetEmail: targetUser.email,
      details: reason ? `Status changed to ${status}. Reason: ${reason}` : `Status changed to ${status}`
    });

    res.json({
      success: true,
      message: `User ${targetUser.email} has been ${status === 'suspended' ? 'suspended' : 'reactivated'}.`,
      status
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// ============================================================================
// 7. PUT /api/admin/users/:id/role (Promote / Demote User Role)
// ============================================================================
adminRouter.put('/users/:id/role', (req, res) => {
  try {
    const targetId = req.params.id;
    const { role } = req.body;

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: "Role must be either 'admin' or 'user'." });
    }

    const targetUser = db.get('SELECT * FROM users WHERE id = ?', [targetId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Safety: Admin cannot demote themselves
    if (req.user.id === targetId && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove administrative privileges from your own account.' });
    }

    // Safety: Cannot demote the last administrator
    if (targetUser.role === 'admin' && role === 'user') {
      const adminCountRow = db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      if ((adminCountRow?.count || 0) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last remaining administrator account on the platform.' });
      }
    }

    db.run('UPDATE users SET role = ? WHERE id = ?', [role, targetId]);

    logAudit(req.user, 'user.role_change', {
      targetType: 'user',
      targetId,
      targetEmail: targetUser.email,
      details: `Role changed from ${targetUser.role || 'user'} to ${role}`
    });

    res.json({
      success: true,
      message: `User ${targetUser.email} role updated to ${role}.`,
      role
    });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// ============================================================================
// 8. DELETE /api/admin/users/:id (Permanent User Deletion + Storage Cleanup)
// ============================================================================
adminRouter.delete('/users/:id', async (req, res) => {
  try {
    const targetId = req.params.id;

    const targetUser = db.get('SELECT * FROM users WHERE id = ?', [targetId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Safety: Admin cannot delete their own account
    if (req.user.id === targetId) {
      return res.status(400).json({ error: 'You cannot remove your own administrator account.' });
    }

    // Safety: Cannot delete the last administrator
    if (targetUser.role === 'admin') {
      const adminCountRow = db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      if ((adminCountRow?.count || 0) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last remaining administrator account.' });
      }
    }

    console.log(`[Admin] Initiating permanent deletion for user: ${targetUser.email} (${targetId})`);

    // 1. Gather all books belonging to this user
    const userBooks = db.all('SELECT id, r2_key, file_size FROM books WHERE uploaded_by = ?', [targetId]);
    const totalBytesToClean = userBooks.reduce((acc, b) => acc + (Number(b.file_size) || 0), 0);

    // 2. Delete Storage files from Supabase
    let deletedFilesCount = 0;
    for (const b of userBooks) {
      if (b.r2_key) {
        try {
          await supabaseStorage.delete(b.r2_key);
          deletedFilesCount++;
        } catch (storageErr) {
          console.warn(`[Storage Cleanup Warning] Could not delete ${b.r2_key}:`, storageErr.message);
        }
      }
    }

    // 3. Delete from Supabase Auth if applicable
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(targetId);
        console.log(`[Supabase Auth] Removed auth user: ${targetId}`);
      } catch (authErr) {
        // May not exist in Supabase Auth if using local credentials
        console.log(`[Supabase Auth Notice] Non-fatal auth deletion response: ${authErr.message}`);
      }
    }

    // 4. Delete from local database (Cascades delete books, progress, plans, highlights, settings)
    db.run('DELETE FROM users WHERE id = ?', [targetId]);

    // 5. Log audit trail
    logAudit(req.user, 'user.delete', {
      targetType: 'user',
      targetId,
      targetEmail: targetUser.email,
      details: `Permanently removed user ${targetUser.email}. Cleaned up ${userBooks.length} books (${formatBytes(totalBytesToClean)}) from storage.`
    });

    res.json({
      success: true,
      message: `User ${targetUser.email} and all associated data have been permanently removed.`,
      deletedBooksCount: userBooks.length,
      cleanedBytes: totalBytesToClean,
      formattedCleaned: formatBytes(totalBytesToClean)
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: `Failed to delete user: ${err.message}` });
  }
});

// ============================================================================
// 9. GET /api/admin/books (All books across platform)
// ============================================================================
adminRouter.get('/books', (req, res) => {
  try {
    const { search, sort = 'date', order = 'desc', page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(5, parseInt(limit, 10)));

    let sql = `
      SELECT 
        b.*,
        u.name as owner_name,
        u.email as owner_email,
        u.status as owner_status
      FROM books b
      LEFT JOIN users u ON u.id = b.uploaded_by
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ' AND (LOWER(b.title) LIKE ? OR LOWER(b.author) LIKE ? OR LOWER(u.email) LIKE ?)';
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    if (sort === 'size') {
      sql += ` ORDER BY b.file_size ${sortOrder}`;
    } else if (sort === 'title') {
      sql += ` ORDER BY b.title ${sortOrder}`;
    } else if (sort === 'pages') {
      sql += ` ORDER BY b.total_pages ${sortOrder}`;
    } else {
      sql += ` ORDER BY b.created_at ${sortOrder}`;
    }

    const allBooks = db.all(sql, params);
    const total = allBooks.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const pageItems = allBooks.slice(offset, offset + limitNum);

    const books = pageItems.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      fileName: b.file_name,
      fileType: b.file_type,
      fileSize: b.file_size,
      formattedSize: formatBytes(b.file_size),
      totalPages: b.total_pages,
      uploadedBy: b.uploaded_by,
      ownerName: b.owner_name || 'Unknown',
      ownerEmail: b.owner_email || 'Unknown',
      ownerStatus: b.owner_status || 'active',
      r2Key: b.r2_key,
      coverUrl: b.cover_url,
      coverDataUrl: b.cover_data_url,
      createdAt: b.created_at
    }));

    res.json({
      books,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('Admin books list error:', err);
    res.status(500).json({ error: 'Failed to retrieve books list.' });
  }
});

// ============================================================================
// 10. GET /api/admin/reading-activity
// ============================================================================
adminRouter.get('/reading-activity', (req, res) => {
  try {
    const totalProgress = db.get('SELECT COUNT(*) as count FROM reading_progress');
    const activeReaders = db.get('SELECT COUNT(DISTINCT user_id) as count FROM reading_progress WHERE page > 1');
    const inProgressBooks = db.get('SELECT COUNT(DISTINCT book_id) as count FROM reading_progress WHERE page > 1');
    const totalPlans = db.get('SELECT COUNT(*) as count FROM reading_plans');

    const recentSessions = db.all(`
      SELECT 
        p.id, p.page, p.updated_at,
        u.name as user_name, u.email as user_email,
        b.title as book_title, b.total_pages
      FROM reading_progress p
      JOIN users u ON u.id = p.user_id
      JOIN books b ON b.id = p.book_id
      ORDER BY p.updated_at DESC
      LIMIT 25
    `);

    res.json({
      totalReadingSessions: totalProgress?.count || 0,
      activeReadersCount: activeReaders?.count || 0,
      booksInProgressCount: inProgressBooks?.count || 0,
      totalPlansCount: totalPlans?.count || 0,
      hasActivity: (recentSessions && recentSessions.length > 0),
      recentSessions: recentSessions.map(s => ({
        id: s.id,
        userName: s.user_name,
        userEmail: s.user_email,
        bookTitle: s.book_title,
        page: s.page,
        totalPages: s.total_pages,
        percentage: s.total_pages > 0 ? Math.round((s.page / s.total_pages) * 100) : 0,
        updatedAt: s.updated_at
      }))
    });
  } catch (err) {
    console.error('Reading activity error:', err);
    res.status(500).json({ error: 'Failed to retrieve reading activity.' });
  }
});

// ============================================================================
// 11. GET & PUT /api/admin/settings
// ============================================================================
adminRouter.get('/settings', (req, res) => {
  try {
    const rows = db.all('SELECT key, value, updated_at FROM admin_settings');
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    res.json({
      storageLimitGb: parseFloat(settings.storage_limit_gb || '100'),
      allowRegistrations: settings.allow_registrations !== 'false',
      maxUploadSizeMb: parseInt(settings.max_upload_size_mb || '100', 10),
      supabaseConfigured: config.isSupabaseConfigured(),
      bucketName: config.supabase.bucketName
    });
  } catch (err) {
    console.error('Admin get settings error:', err);
    res.status(500).json({ error: 'Failed to retrieve admin settings.' });
  }
});

adminRouter.put('/settings', (req, res) => {
  try {
    const { storageLimitGb, allowRegistrations, maxUploadSizeMb } = req.body;
    const now = new Date().toISOString();
    const changes = [];

    if (storageLimitGb !== undefined) {
      const parsed = parseFloat(storageLimitGb);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'Storage limit must be a positive number.' });
      }
      db.run("INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ('storage_limit_gb', ?, ?)", [String(parsed), now]);
      changes.push(`Storage limit updated to ${parsed} GB`);
    }

    if (allowRegistrations !== undefined) {
      const val = Boolean(allowRegistrations) ? 'true' : 'false';
      db.run("INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ('allow_registrations', ?, ?)", [val, now]);
      changes.push(`New registrations ${val === 'true' ? 'enabled' : 'disabled'}`);
    }

    if (maxUploadSizeMb !== undefined) {
      const parsed = parseInt(maxUploadSizeMb, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'Max upload size must be a positive integer.' });
      }
      db.run("INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ('max_upload_size_mb', ?, ?)", [String(parsed), now]);
      changes.push(`Max upload size updated to ${parsed} MB`);
    }

    logAudit(req.user, 'settings.update', {
      details: changes.join('; ')
    });

    res.json({
      success: true,
      message: 'Admin settings updated successfully.'
    });
  } catch (err) {
    console.error('Admin update settings error:', err);
    res.status(500).json({ error: 'Failed to update admin settings.' });
  }
});

// ============================================================================
// 12. GET /api/admin/audit-logs
// ============================================================================
adminRouter.get('/audit-logs', (req, res) => {
  try {
    const { search, action, page = '1', limit = '30' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(5, parseInt(limit, 10)));

    let sql = 'SELECT * FROM admin_audit_logs WHERE 1=1';
    const params = [];

    if (search && search.trim()) {
      sql += ' AND (LOWER(admin_email) LIKE ? OR LOWER(target_email) LIKE ? OR LOWER(details) LIKE ?)';
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    if (action && action !== 'all') {
      sql += ' AND action = ?';
      params.push(action);
    }

    sql += ' ORDER BY created_at DESC';

    const allLogs = db.all(sql, params);
    const total = allLogs.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const pageItems = allLogs.slice(offset, offset + limitNum);

    res.json({
      logs: pageItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

// ============================================================================
// 13. POST /api/admin/setup-first-admin
// ============================================================================
adminRouter.post('/setup-first-admin', (req, res) => {
  try {
    const adminCountRow = db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    const adminCount = adminCountRow?.count || 0;

    if (adminCount > 0) {
      return res.status(400).json({
        error: 'First-time admin setup is locked because administrator accounts already exist.'
      });
    }

    db.run("UPDATE users SET role = 'admin' WHERE id = ?", [req.user.id]);

    logAudit(req.user, 'admin.claim_initial', {
      targetType: 'user',
      targetId: req.user.id,
      targetEmail: req.user.email,
      details: 'Initial administrator role claimed via first-admin setup'
    });

    res.json({
      success: true,
      message: `Your account (${req.user.email}) has been designated as the primary administrator.`
    });
  } catch (err) {
    console.error('Setup first admin error:', err);
    res.status(500).json({ error: 'Failed to claim administrator role.' });
  }
});
