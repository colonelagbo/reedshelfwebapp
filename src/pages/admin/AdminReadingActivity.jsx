import { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  Users,
  Calendar,
  RefreshCw,
  Clock,
  Sparkles,
  TrendingUp,
  BookmarkCheck
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/AdminToast';

export function AdminReadingActivity() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getReadingActivity();
      setData(res);
    } catch (err) {
      console.error('Failed to load reading activity:', err);
      toast.error('Unable to fetch reading activity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="animate-spin text-[#009689]" size={32} />
      </div>
    );
  }

  const {
    totalReadingSessions = 0,
    activeReadersCount = 0,
    booksInProgressCount = 0,
    totalPlansCount = 0,
    hasActivity = false,
    recentSessions = []
  } = data || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            Reading Activity & Engagement
          </h1>
          <p className="mt-1 text-sm text-[#6b7a77] dark:text-white/60">
            Real-time reader progress, reading plan pacing, and engagement metrics.
          </p>
        </div>

        <button
          onClick={fetchActivity}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#e4e1d6] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#0b1619] shadow-xs hover:bg-[#f6f4ee] dark:border-white/15 dark:bg-[#12232a] dark:text-white dark:hover:bg-white/5 transition"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Engagement Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/50">
              Active Readers
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#009689]/10 text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
              <Users size={20} />
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-bold text-[#0b1619] dark:text-white">
            {activeReadersCount}
          </p>
          <p className="mt-2 text-xs text-[#6b7a77] dark:text-white/50">Users actively turning pages</p>
        </div>

        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/50">
              Books In Progress
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d6a84a]/10 text-[#b58b33] dark:bg-[#d6a84a]/20 dark:text-[#d6a84a]">
              <BookOpen size={20} />
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-bold text-[#0b1619] dark:text-white">
            {booksInProgressCount}
          </p>
          <p className="mt-2 text-xs text-[#6b7a77] dark:text-white/50">Volumes currently being read</p>
        </div>

        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/50">
              Reading Plans
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#3b82f6]/10 text-[#2563eb] dark:bg-[#3b82f6]/20 dark:text-[#60a5fa]">
              <Calendar size={20} />
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-bold text-[#0b1619] dark:text-white">
            {totalPlansCount}
          </p>
          <p className="mt-2 text-xs text-[#6b7a77] dark:text-white/50">Daily reading schedules committed</p>
        </div>

        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/50">
              Progress Events
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#8b5cf6]/10 text-[#7c3aed] dark:bg-[#8b5cf6]/20 dark:text-[#a78bfa]">
              <Activity size={20} />
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-bold text-[#0b1619] dark:text-white">
            {totalReadingSessions}
          </p>
          <p className="mt-2 text-xs text-[#6b7a77] dark:text-white/50">Saved page checkpoints</p>
        </div>
      </div>

      {/* Activity Timeline or Clean Empty State */}
      <div className="rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a]">
        <h2 className="text-base font-bold text-[#0b1619] dark:text-white mb-4 flex items-center gap-2">
          <Clock size={18} className="text-[#009689]" /> Recent Reader Sessions
        </h2>

        {hasActivity && recentSessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-[#e4e1d6] text-[#6b7a77] dark:border-white/10 dark:text-white/40">
                <tr>
                  <th className="pb-3 font-semibold">Reader</th>
                  <th className="pb-3 font-semibold">Book Title</th>
                  <th className="pb-3 font-semibold">Page Position</th>
                  <th className="pb-3 font-semibold">Completion</th>
                  <th className="pb-3 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e1d6]/60 dark:divide-white/5">
                {recentSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition">
                    <td className="py-3">
                      <p className="font-semibold text-[#0b1619] dark:text-white">{s.userName}</p>
                      <p className="text-[11px] text-[#6b7a77] dark:text-white/50">{s.userEmail}</p>
                    </td>
                    <td className="py-3 font-medium text-[#0b1619] dark:text-white max-w-xs truncate">
                      {s.bookTitle}
                    </td>
                    <td className="py-3 text-[#6b7a77] dark:text-white/60">
                      Page {s.page} {s.totalPages > 0 ? `of ${s.totalPages}` : ''}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-[#e4e1d6] dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-[#009689] rounded-full"
                            style={{ width: `${Math.min(100, Math.max(2, s.percentage))}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-[#009689] dark:text-[#5fc4b8]">
                          {s.percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-xs text-[#6b7a77] dark:text-white/40 whitespace-nowrap">
                      {new Date(s.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Clean Empty State Designed for Future Extension */
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#009689]/10 text-[#009689] dark:bg-white/5 dark:text-[#5fc4b8]">
              <Sparkles size={28} />
            </div>
            <h3 className="font-display text-lg font-bold text-[#0b1619] dark:text-white">
              Reading Activity Data is Not Available Yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#6b7a77] dark:text-white/60">
              As readers open books in the Reedshelf reader, advance pages, and complete daily reading plans, individual sessions and engagement trends will populate this dashboard in real-time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
