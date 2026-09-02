import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  HardDrive,
  Activity,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Shield
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/AdminToast';

export function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const fetchOverview = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.admin.getOverview();
      setData(res);
      if (isRefresh) toast.success('Platform metrics refreshed.');
    } catch (err) {
      console.error('Error fetching admin overview:', err);
      toast.error('Unable to load platform statistics. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-[#009689]" size={32} />
          <p className="text-sm font-medium text-[#6b7a77] dark:text-white/60">Loading platform statistics...</p>
        </div>
      </div>
    );
  }

  const {
    totalUsers = 0,
    newUsersToday = 0,
    newUsersThisWeek = 0,
    newUsersThisMonth = 0,
    totalBooks = 0,
    formattedStorageUsed = '0 B',
    storageLimitGb = 100,
    formattedStorageLimit = '100 GB',
    formattedStorageAvailable = '100 GB',
    storageUsagePercentage = 0,
    warningLevel = 'normal',
    activeUsers = 0,
    topStorageUsers = [],
    recentAudit = []
  } = data || {};

  return (
    <div className="space-y-8">
      {/* Top Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            Platform Overview
          </h1>
          <p className="mt-1 text-sm text-[#6b7a77] dark:text-white/60">
            Real-time analytics and infrastructure storage for Reedshelf.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e4e1d6] bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#0b1619] shadow-xs transition hover:bg-[#f6f4ee] disabled:opacity-50 dark:border-white/15 dark:bg-[#12232a] dark:text-white dark:hover:bg-white/5"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Storage Alert Banner if warning state */}
      {warningLevel !== 'normal' && (
        <div
          className={`flex items-start gap-3.5 rounded-2xl border p-4.5 ${
            warningLevel === 'critical'
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b] dark:bg-[#450a0a]/50 dark:border-[#7f1d1d] dark:text-[#fca5a5]'
              : warningLevel === 'high'
              ? 'bg-[#fff7ed] border-[#fed7aa] text-[#9a3412] dark:bg-[#431407]/50 dark:border-[#7c2d12] dark:text-[#fdba74]'
              : 'bg-[#fffbeb] border-[#fde68a] text-[#92400e] dark:bg-[#451a03]/50 dark:border-[#78350f] dark:text-[#fcd34d]'
          }`}
        >
          <AlertTriangle size={22} className="shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-bold">
              Storage Threshold Alert: {warningLevel.toUpperCase()} ({storageUsagePercentage}% Used)
            </p>
            <p className="mt-0.5 text-xs opacity-90">
              Reedshelf has consumed {formattedStorageUsed} of {formattedStorageLimit}. Consider adjusting the configured storage limit or cleaning up unneeded files in the{' '}
              <Link to="/admin/storage" className="underline font-semibold">
                Storage Section
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* Key Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Users */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 shadow-xs transition dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/50">
              Total Users
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#009689]/10 text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
              <Users size={20} />
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            {totalUsers.toLocaleString()}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#6b7a77] dark:text-white/50">
            <span className="inline-flex items-center rounded-md bg-[#009689]/10 px-1.5 py-0.5 font-semibold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
              +{newUsersToday} today
            </span>
            <span>•</span>
            <span>+{newUsersThisWeek} this week</span>
          </div>
        </div>

        {/* Card 2: Total Books Uploaded */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 shadow-xs transition dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/50">
              Total Books
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d6a84a]/10 text-[#b58b33] dark:bg-[#d6a84a]/20 dark:text-[#d6a84a]">
              <BookOpen size={20} />
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            {totalBooks.toLocaleString()}
          </p>
          <p className="mt-3 text-xs text-[#6b7a77] dark:text-white/50">
            Across {totalUsers} registered library shelves
          </p>
        </div>

        {/* Card 3: Storage Consumed */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 shadow-xs transition dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/50">
              Storage Used
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#009689]/10 text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
              <HardDrive size={20} />
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            {formattedStorageUsed}
          </p>
          <p className="mt-3 text-xs text-[#6b7a77] dark:text-white/50">
            {formattedStorageAvailable} remaining of {formattedStorageLimit}
          </p>
        </div>

        {/* Card 4: Active Readers */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 shadow-xs transition dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/50">
              Active Readers
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#8b5cf6]/10 text-[#7c3aed] dark:bg-[#8b5cf6]/20 dark:text-[#a78bfa]">
              <Activity size={20} />
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            {activeUsers.toLocaleString()}
          </p>
          <p className="mt-3 text-xs text-[#6b7a77] dark:text-white/50">
            {totalUsers > 0 ? `${Math.round((activeUsers / totalUsers) * 100)}% of user base` : '0% of user base'}
          </p>
        </div>
      </div>

      {/* Storage Capacity Gauge Card */}
      <div className="rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0b1619] dark:text-white flex items-center gap-2">
              <HardDrive size={18} className="text-[#009689]" /> Platform Storage Capacity
            </h2>
            <p className="mt-0.5 text-xs text-[#6b7a77] dark:text-white/50">
              Calculated from actual Supabase Storage book files.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-[#009689] dark:text-[#5fc4b8]">{formattedStorageUsed}</span>
            <span className="text-[#6b7a77] dark:text-white/40">/</span>
            <span>{formattedStorageLimit}</span>
            <span className="rounded-md bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
              {storageUsagePercentage}%
            </span>
          </div>
        </div>

        {/* Progress Bar with Colored Fill */}
        <div className="mt-4">
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-[#e4e1d6]/60 dark:bg-white/10">
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

          <div className="mt-2 flex items-center justify-between text-[11px] text-[#6b7a77] dark:text-white/40">
            <span>0 GB</span>
            <span className="hidden sm:inline">Thresholds: 80% Warning • 90% High • 95% Critical</span>
            <span>{formattedStorageLimit}</span>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Top Storage Users & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Top Storage Consumers (7 cols) */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a] lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0b1619] dark:text-white">
                Top Storage Consumers
              </h2>
              <p className="text-xs text-[#6b7a77] dark:text-white/50">
                Accounts utilizing the highest storage quota.
              </p>
            </div>
            <Link
              to="/admin/storage"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#009689] hover:underline dark:text-[#5fc4b8]"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {topStorageUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e4e1d6] dark:border-white/10 text-[#6b7a77] dark:text-white/40">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold text-center">Books</th>
                    <th className="pb-3 font-semibold text-right">Storage</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e1d6]/60 dark:divide-white/5">
                  {topStorageUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#009689]/10 text-[#009689] font-bold dark:bg-white/10 dark:text-white shrink-0">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              (u.name?.[0] || 'U').toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate text-[#0b1619] dark:text-white">{u.name}</p>
                            <p className="text-[11px] text-[#6b7a77] dark:text-white/50 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center font-medium">{u.booksCount}</td>
                      <td className="py-3 text-right font-bold text-[#009689] dark:text-[#5fc4b8]">
                        {u.formattedStorage}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to={`/admin/users?search=${encodeURIComponent(u.email)}`}
                          className="inline-flex rounded-lg border border-[#e4e1d6] px-2.5 py-1 text-[11px] font-semibold text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/10 dark:text-white/60 dark:hover:border-[#5fc4b8] dark:hover:text-[#5fc4b8]"
                        >
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[#6b7a77] dark:text-white/40">
              No book files uploaded yet.
            </div>
          )}
        </div>

        {/* Right: Recent Admin Activity / Audit Log (5 cols) */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a] lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0b1619] dark:text-white">
                Recent Admin Activity
              </h2>
              <p className="text-xs text-[#6b7a77] dark:text-white/50">
                Audited platform actions.
              </p>
            </div>
            <Link
              to="/admin/audit-logs"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#009689] hover:underline dark:text-[#5fc4b8]"
            >
              All logs <ArrowRight size={14} />
            </Link>
          </div>

          {recentAudit.length > 0 ? (
            <div className="space-y-3">
              {recentAudit.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 rounded-xl border border-[#e4e1d6]/60 p-3 text-xs dark:border-white/5 bg-[#fbfcf9] dark:bg-white/[0.02]"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#009689]/10 text-[#009689] dark:bg-white/10 dark:text-[#5fc4b8] mt-0.5">
                    <Shield size={13} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-[#0b1619] dark:text-white truncate">{log.action}</p>
                      <span className="text-[10px] text-[#6b7a77] dark:text-white/40 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[#6b7a77] dark:text-white/60 text-[11px] truncate mt-0.5">
                      {log.details || log.target_email || 'Action executed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[#6b7a77] dark:text-white/40">
              No audit logs recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
