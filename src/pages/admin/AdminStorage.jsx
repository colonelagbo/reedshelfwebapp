import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowUpDown,
  FileText,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/AdminToast';

export function AdminStorage() {
  const [storageData, setStorageData] = useState(null);
  const [loading, setLoading] = useState(true);

  // User breakdown state
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [usersLoading, setUsersLoading] = useState(true);

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('storage');
  const [sortOrder, setSortOrder] = useState('desc');

  const toast = useToast();

  const fetchStorageOverview = async () => {
    try {
      const res = await api.admin.getStorage();
      setStorageData(res);
    } catch (err) {
      console.error('Failed to load storage:', err);
      toast.error('Unable to fetch storage overview.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.admin.getStorageUsers({
        search,
        role: roleFilter,
        status: statusFilter,
        sort: sortField,
        order: sortOrder,
        page: pagination.page,
        limit: pagination.limit
      });
      setUsers(res.users || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load storage by user:', err);
      toast.error('Failed to load storage user breakdown.');
    } finally {
      setUsersLoading(false);
    }
  }, [search, roleFilter, statusFilter, sortField, sortOrder, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchStorageOverview();
  }, []);

  useEffect(() => {
    fetchStorageUsers();
  }, [fetchStorageUsers]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="animate-spin text-[#009689]" size={32} />
      </div>
    );
  }

  const {
    totalBooks = 0,
    totalFiles = 0,
    storageUsedBytes = 0,
    formattedStorageUsed = '0 B',
    storageLimitGb = 100,
    formattedStorageLimit = '100 GB',
    formattedStorageAvailable = '100 GB',
    storageUsagePercentage = 0,
    warningLevel = 'normal',
    supabaseStatus = {}
  } = storageData || {};

  const avgSize = totalBooks > 0 ? (storageUsedBytes / totalBooks) : 0;
  const formatBytes = (b) => {
    if (!b) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            Storage Overview
          </h1>
          <p className="mt-1 text-sm text-[#6b7a77] dark:text-white/60">
            Monitor bucket utilization, warning thresholds, and per-user storage footprint.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/settings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e4e1d6] bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#0b1619] shadow-xs hover:bg-[#f6f4ee] dark:border-white/15 dark:bg-[#12232a] dark:text-white dark:hover:bg-white/5 transition"
          >
            Configure Limit ({storageLimitGb} GB)
          </Link>
          <button
            onClick={() => {
              fetchStorageOverview();
              fetchStorageUsers();
              toast.success('Storage statistics refreshed.');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-[#007268] transition"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Storage Alert Banner if warning */}
      {warningLevel !== 'normal' && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            warningLevel === 'critical'
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b] dark:bg-[#450a0a]/50 dark:border-[#7f1d1d] dark:text-[#fca5a5]'
              : warningLevel === 'high'
              ? 'bg-[#fff7ed] border-[#fed7aa] text-[#9a3412] dark:bg-[#431407]/50 dark:border-[#7c2d12] dark:text-[#fdba74]'
              : 'bg-[#fffbeb] border-[#fde68a] text-[#92400e] dark:bg-[#451a03]/50 dark:border-[#78350f] dark:text-[#fcd34d]'
          }`}
        >
          <AlertTriangle size={22} className="shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">
              Storage Threshold Alert: {warningLevel.toUpperCase()} ({storageUsagePercentage}% Used)
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              Current usage has reached the warning threshold. When storage reaches 95%, critical alerts are broadcast. You can increase the storage ceiling under Settings.
            </p>
          </div>
        </div>
      )}

      {/* Infrastructure Card with Progress */}
      <div className="rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="md:col-span-3 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/50">
                  Global Storage Usage
                </span>
                <p className="font-display text-3xl font-bold text-[#0b1619] dark:text-white mt-1">
                  {formattedStorageUsed}{' '}
                  <span className="text-lg font-normal text-[#6b7a77] dark:text-white/50">
                    / {formattedStorageLimit}
                  </span>
                </p>
              </div>

              <div className="text-right">
                <span className="rounded-lg bg-[#009689]/10 px-2.5 py-1 text-sm font-bold text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                  {storageUsagePercentage}% Consumed
                </span>
                <p className="text-xs text-[#6b7a77] dark:text-white/50 mt-1">
                  {formattedStorageAvailable} remaining
                </p>
              </div>
            </div>

            {/* Visual Gauge Bar */}
            <div className="h-4 w-full overflow-hidden rounded-full bg-[#e4e1d6]/60 dark:bg-white/10">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  warningLevel === 'critical'
                    ? 'bg-[#dc2626]'
                    : warningLevel === 'high'
                    ? 'bg-[#ea580c]'
                    : warningLevel === 'warning'
                    ? 'bg-[#d97706]'
                    : 'bg-gradient-to-r from-[#009689] to-[#00bfa5]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0.5, storageUsagePercentage))}%` }}
              />
            </div>

            {/* Threshold Markers Legend */}
            <div className="flex flex-wrap items-center justify-between text-xs text-[#6b7a77] dark:text-white/50 pt-1">
              <span>0 GB</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#009689]" /> &lt;80% Normal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#d97706]" /> 80-89% Warning
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#ea580c]" /> 90-94% High
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#dc2626]" /> 95%+ Critical
              </span>
              <span>{formattedStorageLimit}</span>
            </div>
          </div>

          {/* Right Summary Column */}
          <div className="border-t border-[#e4e1d6] pt-4 md:border-t-0 md:border-l md:pl-6 md:pt-0 dark:border-white/10 space-y-3">
            <div>
              <p className="text-xs font-semibold text-[#6b7a77] dark:text-white/50">Supabase Bucket</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#10b981]" />
                <p className="text-xs font-bold text-[#0b1619] dark:text-white truncate">
                  {supabaseStatus?.bucket || 'reedshelf-books'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#6b7a77] dark:text-white/50">Total Book Files</p>
              <p className="text-sm font-bold text-[#0b1619] dark:text-white">{totalBooks.toLocaleString()} files</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#6b7a77] dark:text-white/50">Average Book Size</p>
              <p className="text-sm font-bold text-[#0b1619] dark:text-white">{formatBytes(avgSize)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Storage By User Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-[#0b1619] dark:text-white">
              Storage Breakdown by User
            </h2>
            <p className="text-xs text-[#6b7a77] dark:text-white/50">
              Inspect individual accounts, files uploaded, and bandwidth consumption.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7a77] dark:text-white/40" />
              <input
                type="text"
                placeholder="Search user or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="w-56 rounded-xl border border-[#e4e1d6] bg-white py-2 pl-9 pr-3 text-xs text-[#0b1619] placeholder:text-[#6b7a77]/60 focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="rounded-xl border border-[#e4e1d6] bg-white px-3 py-2 text-xs font-medium text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
            >
              <option value="all">All Roles</option>
              <option value="user">Users</option>
              <option value="admin">Admins</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="rounded-xl border border-[#e4e1d6] bg-white px-3 py-2 text-xs font-medium text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Table Card */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white shadow-xs overflow-hidden dark:border-white/10 dark:bg-[#12232a]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-[#e4e1d6] bg-[#f6f4ee]/50 text-[#6b7a77] dark:border-white/10 dark:bg-white/[0.02] dark:text-white/40">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">User</th>
                  <th className="px-4 py-3.5 font-semibold">
                    <button
                      onClick={() => handleSort('books')}
                      className="flex items-center gap-1 font-semibold hover:text-[#0b1619] dark:hover:text-white"
                    >
                      Books <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3.5 font-semibold">Files</th>
                  <th className="px-4 py-3.5 font-semibold">
                    <button
                      onClick={() => handleSort('storage')}
                      className="flex items-center gap-1 font-semibold hover:text-[#0b1619] dark:hover:text-white"
                    >
                      Storage Consumed <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3.5 font-semibold">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-1 font-semibold hover:text-[#0b1619] dark:hover:text-white"
                    >
                      Joined Date <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold">Role</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#e4e1d6]/60 dark:divide-white/5">
                {usersLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6b7a77] dark:text-white/40">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#009689]" />
                      Loading user storage data...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6b7a77] dark:text-white/40">
                      No matching users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#009689]/10 text-[#009689] font-bold text-xs shrink-0 dark:bg-white/10 dark:text-white">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              (u.name?.[0] || 'U').toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0b1619] dark:text-white truncate">{u.name}</p>
                            <p className="text-[11px] text-[#6b7a77] dark:text-white/50 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-medium">{u.booksCount}</td>
                      <td className="px-4 py-3.5 text-[#6b7a77] dark:text-white/60">{u.filesCount}</td>

                      <td className="px-4 py-3.5 font-bold text-[#009689] dark:text-[#5fc4b8]">
                        {u.formattedStorage}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-[#6b7a77] dark:text-white/50">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            u.status === 'suspended'
                              ? 'bg-[#fee2e2] text-[#991b1b] dark:bg-[#450a0a] dark:text-[#fca5a5]'
                              : 'bg-[#dcfce7] text-[#166534] dark:bg-[#052e16] dark:text-[#86efac]'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'admin'
                              ? 'bg-[#fef3c7] text-[#92400e] dark:bg-[#451a03] dark:text-[#fcd34d]'
                              : 'bg-black/5 text-[#6b7a77] dark:bg-white/10 dark:text-white/70'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/admin/users?search=${encodeURIComponent(u.email)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e4e1d6] px-2.5 py-1 text-xs font-semibold text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/10 dark:text-white/60 dark:hover:border-[#5fc4b8] dark:hover:text-[#5fc4b8] transition"
                        >
                          Inspect <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#e4e1d6] px-4 py-3 dark:border-white/10 text-xs">
              <span className="text-[#6b7a77] dark:text-white/50">
                Showing Page <span className="font-semibold text-[#0b1619] dark:text-white">{pagination.page}</span> of{' '}
                <span className="font-semibold text-[#0b1619] dark:text-white">{pagination.totalPages}</span> ({pagination.total} users)
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e4e1d6] px-3 py-1 font-semibold text-[#0b1619] disabled:opacity-40 hover:bg-[#f6f4ee] dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e4e1d6] px-3 py-1 font-semibold text-[#0b1619] disabled:opacity-40 hover:bg-[#f6f4ee] dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
