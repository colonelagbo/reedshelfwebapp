import { useEffect, useState, useCallback } from 'react';
import {
  ScrollText,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  User,
  Filter
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/AdminToast';

export function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const toast = useToast();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getAuditLogs({
        search,
        action: actionFilter,
        page: pagination.page,
        limit: pagination.limit
      });
      setLogs(res.logs || []);
      setPagination(res.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      toast.error('Unable to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action) => {
    let color = 'bg-black/5 text-[#6b7a77] dark:bg-white/10 dark:text-white/70';
    if (action.includes('delete')) color = 'bg-[#fee2e2] text-[#991b1b] dark:bg-[#450a0a] dark:text-[#fca5a5]';
    else if (action.includes('suspend')) color = 'bg-[#fef3c7] text-[#92400e] dark:bg-[#451a03] dark:text-[#fcd34d]';
    else if (action.includes('reactivate')) color = 'bg-[#dcfce7] text-[#166534] dark:bg-[#052e16] dark:text-[#86efac]';
    else if (action.includes('role')) color = 'bg-[#e0e7ff] text-[#3730a3] dark:bg-[#1e1b4b] dark:text-[#c7d2fe]';
    else if (action.includes('settings')) color = 'bg-[#ccfbf1] text-[#115e59] dark:bg-[#042f2e] dark:text-[#99f6e4]';

    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${color}`}>
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            Administrative Audit Trail
          </h1>
          <p className="mt-1 text-sm text-[#6b7a77] dark:text-white/60">
            Immutable log of all administrative actions, suspensions, role assignments, and deletions.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#e4e1d6] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#0b1619] shadow-xs hover:bg-[#f6f4ee] dark:border-white/15 dark:bg-[#12232a] dark:text-white dark:hover:bg-white/5 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[260px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7a77] dark:text-white/40" />
          <input
            type="text"
            placeholder="Search by administrator, target email, or details..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full rounded-xl border border-[#e4e1d6] bg-white py-2.5 pl-10 pr-3 text-xs sm:text-sm text-[#0b1619] placeholder:text-[#6b7a77]/60 focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
          />
        </div>

        {/* Action Filter */}
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-xl border border-[#e4e1d6] bg-white px-3 py-2.5 text-xs sm:text-sm font-medium text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
        >
          <option value="all">All Actions</option>
          <option value="user.suspend">user.suspend</option>
          <option value="user.reactivate">user.reactivate</option>
          <option value="user.delete">user.delete</option>
          <option value="user.role_change">user.role_change</option>
          <option value="settings.update">settings.update</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-[#e4e1d6] bg-white shadow-xs overflow-hidden dark:border-white/10 dark:bg-[#12232a]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-[#e4e1d6] bg-[#f6f4ee]/50 text-[#6b7a77] dark:border-white/10 dark:bg-white/[0.02] dark:text-white/40">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Action</th>
                <th className="px-4 py-3.5 font-semibold">Administrator</th>
                <th className="px-4 py-3.5 font-semibold">Target Account</th>
                <th className="px-4 py-3.5 font-semibold">Details</th>
                <th className="px-4 py-3.5 text-right font-semibold">Timestamp</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#e4e1d6]/60 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-[#6b7a77] dark:text-white/40">
                    <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-[#009689]" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-[#6b7a77] dark:text-white/40">
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition">
                    <td className="px-4 py-3.5 font-medium whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-[#0b1619] dark:text-white truncate max-w-[180px]">
                      {log.admin_email}
                    </td>

                    <td className="px-4 py-3.5 text-[#6b7a77] dark:text-white/70 truncate max-w-[180px]">
                      {log.target_email || log.target_id || '—'}
                    </td>

                    <td className="px-4 py-3.5 text-xs text-[#0b1619] dark:text-white/90">
                      {log.details || '—'}
                    </td>

                    <td className="px-4 py-3.5 text-right text-xs text-[#6b7a77] dark:text-white/40 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e4e1d6] px-4 py-3 dark:border-white/10 text-xs">
            <span className="text-[#6b7a77] dark:text-white/50">
              Page <span className="font-semibold text-[#0b1619] dark:text-white">{pagination.page}</span> of{' '}
              <span className="font-semibold text-[#0b1619] dark:text-white">{pagination.totalPages}</span> ({pagination.total} entries)
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
  );
}
