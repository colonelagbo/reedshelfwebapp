import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  MoreVertical,
  Shield,
  ShieldAlert,
  Ban,
  CheckCircle2,
  Trash2,
  Eye,
  X,
  BookOpen,
  Calendar,
  HardDrive,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { api } from '../../lib/api';
import { getCurrentUser } from '../../lib/appStore';
import { useToast } from '../../components/AdminToast';

export function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals & Dialogs
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [suspendModal, setSuspendModal] = useState(null); // { user, action: 'suspend' | 'reactivate', reason: '' }
  const [deleteModal, setDeleteModal] = useState(null); // { user, confirmText: '' }
  const [actionLoading, setActionLoading] = useState(false);

  const currentUser = getCurrentUser();
  const toast = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getUsers({
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
      console.error('Failed to fetch users:', err);
      toast.error('Unable to retrieve user list.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, sortField, sortOrder, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Open detailed user inspection modal
  const handleInspect = async (u) => {
    setUserDetailLoading(true);
    try {
      const details = await api.admin.getUser(u.id);
      setSelectedUser(details);
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      toast.error('Unable to fetch detailed user record.');
    } finally {
      setUserDetailLoading(false);
    }
  };

  // Execute Suspend or Reactivate
  const handleConfirmStatusChange = async () => {
    if (!suspendModal) return;
    const { user, action, reason } = suspendModal;
    const newStatus = action === 'suspend' ? 'suspended' : 'active';

    setActionLoading(true);
    try {
      await api.admin.updateUserStatus(user.id, { status: newStatus, reason });
      toast.success(`User ${user.email} has been ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}.`);
      setSuspendModal(null);
      fetchUsers();
    } catch (err) {
      console.error('Status change error:', err);
      toast.error(err.message || 'Failed to update user account status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Admin Role
  const handleToggleRole = async (targetUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    const confirmMsg = newRole === 'admin'
      ? `Promote "${targetUser.name}" (${targetUser.email}) to Platform Administrator?`
      : `Remove administrative privileges from "${targetUser.name}" (${targetUser.email})?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.admin.updateUserRole(targetUser.id, { role: newRole });
      toast.success(`Role updated: ${targetUser.email} is now ${newRole}.`);
      fetchUsers();
    } catch (err) {
      console.error('Role update error:', err);
      toast.error(err.message || 'Failed to update user role.');
    }
  };

  // Execute Permanent Deletion
  const handleConfirmDelete = async () => {
    if (!deleteModal || deleteModal.confirmText !== 'DELETE') return;
    const { user } = deleteModal;

    setActionLoading(true);
    try {
      const res = await api.admin.deleteUser(user.id);
      toast.success(res.message || `User ${user.email} permanently removed.`);
      setDeleteModal(null);
      if (selectedUser?.user?.id === user.id) setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Delete user error:', err);
      toast.error(err.message || 'Failed to delete user.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            Users Management
          </h1>
          <p className="mt-1 text-sm text-[#6b7a77] dark:text-white/60">
            Inspect reader libraries, enforce suspensions, manage permissions, or remove accounts.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#e4e1d6] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#0b1619] shadow-xs hover:bg-[#f6f4ee] dark:border-white/15 dark:bg-[#12232a] dark:text-white dark:hover:bg-white/5 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7a77] dark:text-white/40" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full rounded-xl border border-[#e4e1d6] bg-white py-2.5 pl-10 pr-3 text-xs sm:text-sm text-[#0b1619] placeholder:text-[#6b7a77]/60 focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
          />
        </div>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-xl border border-[#e4e1d6] bg-white px-3 py-2.5 text-xs sm:text-sm font-medium text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
        >
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Administrator</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-xl border border-[#e4e1d6] bg-white px-3 py-2.5 text-xs sm:text-sm font-medium text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        {/* Sort Selection */}
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
          className="rounded-xl border border-[#e4e1d6] bg-white px-3 py-2.5 text-xs sm:text-sm font-medium text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
        >
          <option value="date">Sort: Joined Date</option>
          <option value="storage">Sort: Storage Used</option>
          <option value="books">Sort: Books Count</option>
          <option value="name">Sort: User Name</option>
        </select>
      </div>

      {/* Users Table Card */}
      <div className="rounded-2xl border border-[#e4e1d6] bg-white shadow-xs overflow-hidden dark:border-white/10 dark:bg-[#12232a]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-[#e4e1d6] bg-[#f6f4ee]/50 text-[#6b7a77] dark:border-white/10 dark:bg-white/[0.02] dark:text-white/40">
              <tr>
                <th className="px-4 py-3.5 font-semibold">User</th>
                <th className="px-4 py-3.5 font-semibold">Role</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Books</th>
                <th className="px-4 py-3.5 font-semibold">Storage</th>
                <th className="px-4 py-3.5 font-semibold">Joined</th>
                <th className="px-4 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#e4e1d6]/60 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-[#6b7a77] dark:text-white/40">
                    <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-[#009689]" />
                    Loading registered users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-[#6b7a77] dark:text-white/40">
                    No users matching the current query.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition">
                      {/* User Column */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#009689]/10 text-[#009689] font-bold text-xs shrink-0 dark:bg-white/10 dark:text-white">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              (u.name?.[0] || 'U').toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-[#0b1619] dark:text-white truncate">{u.name}</p>
                              {isSelf && (
                                <span className="rounded-md bg-[#009689]/10 px-1.5 py-0.2 text-[10px] font-bold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#6b7a77] dark:text-white/50 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'admin'
                              ? 'bg-[#fef3c7] text-[#92400e] dark:bg-[#451a03] dark:text-[#fcd34d]'
                              : 'bg-black/5 text-[#6b7a77] dark:bg-white/10 dark:text-white/70'
                          }`}
                        >
                          {u.role === 'admin' && <Shield size={10} />}
                          {u.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            u.status === 'suspended'
                              ? 'bg-[#fee2e2] text-[#991b1b] dark:bg-[#450a0a] dark:text-[#fca5a5]'
                              : 'bg-[#dcfce7] text-[#166534] dark:bg-[#052e16] dark:text-[#86efac]'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      {/* Books */}
                      <td className="px-4 py-3.5 font-medium">{u.booksCount}</td>

                      {/* Storage */}
                      <td className="px-4 py-3.5 font-bold text-[#009689] dark:text-[#5fc4b8]">
                        {u.formattedStorage}
                      </td>

                      {/* Joined Date */}
                      <td className="px-4 py-3.5 text-xs text-[#6b7a77] dark:text-white/50 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect Details */}
                          <button
                            onClick={() => handleInspect(u)}
                            className="rounded-lg border border-[#e4e1d6] p-1.5 text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/10 dark:text-white/60 dark:hover:border-[#5fc4b8] dark:hover:text-[#5fc4b8] transition"
                            title="Inspect User Details & Library"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Suspend / Reactivate */}
                          {!isSelf && (
                            <button
                              onClick={() =>
                                setSuspendModal({
                                  user: u,
                                  action: u.status === 'suspended' ? 'reactivate' : 'suspend',
                                  reason: ''
                                })
                              }
                              className={`rounded-lg border p-1.5 transition ${
                                u.status === 'suspended'
                                  ? 'border-[#86efac] text-[#166534] hover:bg-[#dcfce7] dark:border-[#166534] dark:text-[#86efac]'
                                  : 'border-[#fecaca] text-[#b91c1c] hover:bg-[#fee2e2] dark:border-[#7f1d1d] dark:text-[#fca5a5]'
                              }`}
                              title={u.status === 'suspended' ? 'Reactivate Account' : 'Suspend Account'}
                            >
                              {u.status === 'suspended' ? <CheckCircle2 size={15} /> : <Ban size={15} />}
                            </button>
                          )}

                          {/* Role Toggle */}
                          {!isSelf && (
                            <button
                              onClick={() => handleToggleRole(u)}
                              className="rounded-lg border border-[#e4e1d6] p-1.5 text-[#557067] hover:border-[#d6a84a] hover:text-[#d6a84a] dark:border-white/10 dark:text-white/60 transition"
                              title={u.role === 'admin' ? 'Demote to Regular User' : 'Promote to Admin'}
                            >
                              <Shield size={15} />
                            </button>
                          )}

                          {/* Delete Account */}
                          {!isSelf && (
                            <button
                              onClick={() => setDeleteModal({ user: u, confirmText: '' })}
                              className="rounded-lg border border-[#fecaca] p-1.5 text-[#dc2626] hover:bg-[#fee2e2] dark:border-[#7f1d1d] dark:text-[#fca5a5] dark:hover:bg-[#450a0a] transition"
                              title="Permanently Delete User"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e4e1d6] px-4 py-3 dark:border-white/10 text-xs">
            <span className="text-[#6b7a77] dark:text-white/50">
              Page <span className="font-semibold text-[#0b1619] dark:text-white">{pagination.page}</span> of{' '}
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

      {/* ==================================================================== */}
      {/* 1. USER DETAILS MODAL                                                */}
      {/* ==================================================================== */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#12232a]">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#009689]/10 text-[#009689] font-bold text-lg dark:bg-white/10 dark:text-white shrink-0">
                  {selectedUser.user.avatar ? (
                    <img src={selectedUser.user.avatar} alt="" className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    (selectedUser.user.name?.[0] || 'U').toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-[#0b1619] dark:text-white">
                      {selectedUser.user.name}
                    </h2>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        selectedUser.user.status === 'suspended'
                          ? 'bg-[#fee2e2] text-[#991b1b]'
                          : 'bg-[#dcfce7] text-[#166534]'
                      }`}
                    >
                      {selectedUser.user.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#6b7a77] dark:text-white/60">{selectedUser.user.email}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-xl p-1.5 text-[#6b7a77] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Meta Summary Grid */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-[#e4e1d6] p-3 dark:border-white/10 bg-[#fbfcf9] dark:bg-white/[0.02]">
                <p className="text-[10px] uppercase font-bold text-[#6b7a77] dark:text-white/40">Books</p>
                <p className="text-lg font-bold text-[#0b1619] dark:text-white mt-0.5">
                  {selectedUser.user.booksCount}
                </p>
              </div>
              <div className="rounded-xl border border-[#e4e1d6] p-3 dark:border-white/10 bg-[#fbfcf9] dark:bg-white/[0.02]">
                <p className="text-[10px] uppercase font-bold text-[#6b7a77] dark:text-white/40">Storage</p>
                <p className="text-lg font-bold text-[#009689] dark:text-[#5fc4b8] mt-0.5">
                  {selectedUser.user.formattedStorage}
                </p>
              </div>
              <div className="rounded-xl border border-[#e4e1d6] p-3 dark:border-white/10 bg-[#fbfcf9] dark:bg-white/[0.02]">
                <p className="text-[10px] uppercase font-bold text-[#6b7a77] dark:text-white/40">Plans</p>
                <p className="text-lg font-bold text-[#0b1619] dark:text-white mt-0.5">
                  {selectedUser.user.plansCount}
                </p>
              </div>
              <div className="rounded-xl border border-[#e4e1d6] p-3 dark:border-white/10 bg-[#fbfcf9] dark:bg-white/[0.02]">
                <p className="text-[10px] uppercase font-bold text-[#6b7a77] dark:text-white/40">Highlights</p>
                <p className="text-lg font-bold text-[#0b1619] dark:text-white mt-0.5">
                  {selectedUser.user.highlightsCount}
                </p>
              </div>
            </div>

            {/* Uploaded Books List */}
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-bold text-[#0b1619] dark:text-white flex items-center gap-1.5">
                <BookOpen size={16} className="text-[#009689]" /> Uploaded Books ({selectedUser.books?.length || 0})
              </h3>

              {selectedUser.books?.length > 0 ? (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {selectedUser.books.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-xl border border-[#e4e1d6] p-3 text-xs dark:border-white/10"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-[#0b1619] dark:text-white truncate">{b.title}</p>
                        <p className="text-[#6b7a77] dark:text-white/50 text-[11px] truncate">
                          {b.author || 'Unknown Author'} • {b.totalPages} pages
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-[#009689] dark:text-[#5fc4b8]">{b.formattedSize}</span>
                        <p className="text-[10px] text-[#6b7a77] dark:text-white/40">Page {b.currentPage}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6b7a77] dark:text-white/40 italic">User has not uploaded any books yet.</p>
              )}
            </div>

            {/* Reading Plans */}
            {selectedUser.plans?.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-bold text-[#0b1619] dark:text-white flex items-center gap-1.5">
                  <Calendar size={16} className="text-[#d6a84a]" /> Reading Plans ({selectedUser.plans.length})
                </h3>
                <div className="space-y-2">
                  {selectedUser.plans.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-[#e4e1d6] p-3 text-xs dark:border-white/10"
                    >
                      <div>
                        <p className="font-semibold text-[#0b1619] dark:text-white">{p.bookTitle}</p>
                        <p className="text-[#6b7a77] dark:text-white/50 text-[11px]">
                          Target: {new Date(p.targetDate).toLocaleDateString()} ({p.days} days)
                        </p>
                      </div>
                      <span className="font-bold text-[#d6a84a]">{p.pagesPerDay} pages/day</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex justify-end border-t border-[#e4e1d6] pt-4 dark:border-white/10">
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-xl bg-[#009689] px-5 py-2 text-xs font-semibold text-white hover:bg-[#007268]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. SUSPEND / REACTIVATE CONFIRMATION MODAL                          */}
      {/* ==================================================================== */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#12232a]">
            <div className="flex items-center gap-3">
              <span
                className={`grid h-12 w-12 place-items-center rounded-2xl ${
                  suspendModal.action === 'suspend'
                    ? 'bg-[#fee2e2] text-[#dc2626] dark:bg-[#450a0a] dark:text-[#fca5a5]'
                    : 'bg-[#dcfce7] text-[#166534] dark:bg-[#052e16] dark:text-[#86efac]'
                }`}
              >
                {suspendModal.action === 'suspend' ? <Ban size={24} /> : <CheckCircle2 size={24} />}
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-[#0b1619] dark:text-white">
                  {suspendModal.action === 'suspend' ? 'Suspend Account' : 'Reactivate Account'}
                </h3>
                <p className="text-xs text-[#6b7a77] dark:text-white/60">{suspendModal.user.email}</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-[#6b7a77] dark:text-white/70">
              {suspendModal.action === 'suspend'
                ? 'Suspending this account will immediately revoke all active sessions and block the user from logging in or uploading books until reactivated by an administrator.'
                : 'Reactivating this account will restore the user’s ability to sign in, read books, and manage their library.'}
            </p>

            {/* Optional Reason Input */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#0b1619] dark:text-white mb-1">
                Reason / Note (Logged in Audit Trail):
              </label>
              <input
                type="text"
                placeholder="e.g., Storage policy violation, requested hold..."
                value={suspendModal.reason}
                onChange={(e) => setSuspendModal((m) => ({ ...m, reason: e.target.value }))}
                className="w-full rounded-xl border border-[#e4e1d6] bg-white p-2.5 text-xs text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#0b1619] dark:text-white"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setSuspendModal(null)}
                disabled={actionLoading}
                className="rounded-xl border border-[#e4e1d6] px-4 py-2 text-xs font-semibold text-[#6b7a77] hover:bg-black/5 dark:border-white/10 dark:text-white/70"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                disabled={actionLoading}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-xs transition ${
                  suspendModal.action === 'suspend'
                    ? 'bg-[#dc2626] hover:bg-[#b91c1c]'
                    : 'bg-[#16a34a] hover:bg-[#15803d]'
                }`}
              >
                {actionLoading && <RefreshCw size={12} className="animate-spin" />}
                {suspendModal.action === 'suspend' ? 'Confirm Suspension' : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. PERMANENT USER DELETION MODAL (Requires typing 'DELETE')         */}
      {/* ==================================================================== */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[#fca5a5] bg-white p-6 shadow-2xl dark:border-[#7f1d1d] dark:bg-[#1f1315]">
            <div className="flex items-center gap-3 text-[#dc2626] dark:text-[#f87171]">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fee2e2] dark:bg-[#450a0a]">
                <Trash2 size={24} />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold">Permanently Delete User</h3>
                <p className="text-xs opacity-90">{deleteModal.user.email}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-[#fef2f2] p-3 text-xs leading-relaxed text-[#991b1b] dark:bg-[#380e12] dark:text-[#fca5a5] border border-[#fecaca] dark:border-[#7f1d1d]">
              <p className="font-bold flex items-center gap-1">
                <AlertTriangle size={14} /> Irreversible Destructive Operation
              </p>
              <p className="mt-1">
                This will permanently delete this user’s account, delete all uploaded books ({deleteModal.user.booksCount || 0} files, {deleteModal.user.formattedStorage}) from Supabase Storage, and delete all reading plans, progress, and highlights.
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#0b1619] dark:text-white mb-1.5">
                To confirm, type <span className="font-mono font-bold text-[#dc2626]">DELETE</span> below:
              </label>
              <input
                type="text"
                placeholder="Type DELETE"
                value={deleteModal.confirmText}
                onChange={(e) => setDeleteModal((m) => ({ ...m, confirmText: e.target.value }))}
                className="w-full rounded-xl border border-[#fca5a5] bg-white p-2.5 text-xs text-[#0b1619] font-mono tracking-wider focus:border-[#dc2626] focus:outline-hidden dark:border-[#7f1d1d] dark:bg-[#12232a] dark:text-white"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={actionLoading}
                className="rounded-xl border border-[#e4e1d6] px-4 py-2 text-xs font-semibold text-[#6b7a77] hover:bg-black/5 dark:border-white/10 dark:text-white/70"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteModal.confirmText !== 'DELETE' || actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#dc2626] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#b91c1c] disabled:opacity-40"
              >
                {actionLoading && <RefreshCw size={12} className="animate-spin" />}
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
