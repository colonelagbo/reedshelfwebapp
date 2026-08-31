import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CalendarDays,
  Plus,
  Trash2,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Zap,
  Target,
  ArrowRight,
  TrendingUp,
  X,
  Play
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import {
  addPlan,
  deletePlan,
  getCurrentUser,
  getProgress,
  getUserBooks,
  getUserPlans,
} from '../lib/appStore';

const PRESET_DAYS = [
  { label: 'Sprint', days: 7, desc: '1 week', icon: Zap },
  { label: '2 Weeks', days: 14, desc: 'Recommended', icon: Target },
  { label: '1 Month', days: 30, desc: 'Steady', icon: CalendarDays },
  { label: '2 Months', days: 60, desc: 'Relaxed', icon: TrendingUp },
];

export function ReadingPlans() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const books = getUserBooks(user?.id || '');

  const [plans, setPlans] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(books[0]?.id || '');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(14);

  useEffect(() => {
    if (user?.id) {
      setPlans(getUserPlans(user.id));
    }
  }, [user?.id]);

  useEffect(() => {
    if (books.length > 0 && !selectedBookId) {
      setSelectedBookId(books[0].id);
    }
  }, [books, selectedBookId]);

  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) || books[0],
    [books, selectedBookId]
  );

  const totalPages = selectedBook?.totalPages || 100;
  const numDays = Math.max(1, Number(days) || 1);
  const pagesPerDay = Math.ceil(totalPages / numDays);
  const estimatedMinsPerDay = Math.round(pagesPerDay * 1.75); // ~1.75 mins per page

  const targetDate = useMemo(() => {
    const d = new Date(`${startDate}T12:00:00`);
    d.setDate(d.getDate() + numDays - 1);
    return d.toISOString().slice(0, 10);
  }, [startDate, numDays]);

  const formattedTargetDate = useMemo(() => {
    try {
      const d = new Date(`${targetDate}T12:00:00`);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return targetDate;
    }
  }, [targetDate]);

  const paceInfo = useMemo(() => {
    if (pagesPerDay <= 12) {
      return {
        label: 'Relaxed Pace',
        color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        icon: TrendingUp,
        description: 'Easy & manageable with light daily reading.',
      };
    }
    if (pagesPerDay <= 30) {
      return {
        label: 'Balanced Pace',
        color: 'text-[#009689] bg-[#009689]/10 border-[#009689]/20',
        icon: Target,
        description: 'Ideal daily reading habit for consistent progress.',
      };
    }
    return {
      label: 'Intensive Pace',
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      icon: Flame,
      description: 'Fast-track sprint. Requires dedicated reading sessions.',
    };
  }, [pagesPerDay]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedBook?.id || !user?.id) return;

    const newPlan = addPlan({
      bookId: selectedBook.id,
      userId: user.id,
      startDate,
      targetDate,
      days: numDays,
      pagesPerDay,
      totalPages,
    });

    setPlans([newPlan, ...plans]);
    setOpen(false);
  };

  const handleRemove = (id) => {
    if (window.confirm('Delete this reading plan?')) {
      deletePlan(id);
      setPlans(plans.filter((p) => p.id !== id));
    }
  };

  const PaceIcon = paceInfo.icon;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold">Reading Plans</h1>
            <p className="mt-1 text-[#6b7a77] dark:text-white/60">
              Set how many days you want to read a book, and ReedShelf calculates your daily targets.
            </p>
          </div>
          {books.length > 0 && (
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#009689] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268]"
            >
              <Plus size={18} /> Create a plan
            </button>
          )}
        </div>

        {/* Create Plan Section / Modal Form */}
        {open && (
          <div className="mt-7 rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#142326] sm:p-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                  <Sparkles size={24} />
                </span>
                <div>
                  <h2 className="text-xl font-bold">Create a Reading Plan</h2>
                  <p className="text-sm text-[#6b7a77] dark:text-white/60">
                    How many days do you want to read this book?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-[#7b8c84] hover:bg-[#f6f4ee] dark:hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-6">
              {/* 1. Book Selector */}
              <div>
                <label className="mb-2 block text-sm font-semibold">1. Select a Book</label>
                <select
                  required
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-4 py-3 text-sm font-medium outline-none focus:border-[#007268] dark:border-white/10 dark:bg-white/5"
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} by {b.author || 'Unknown'} {b.totalPages ? `(${b.totalPages} pages)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Days Selector & Presets */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  2. How many days do you want to read this book?
                </label>

                {/* Preset Day Buttons */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PRESET_DAYS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = numDays === preset.days;
                    return (
                      <button
                        type="button"
                        key={preset.days}
                        onClick={() => setDays(preset.days)}
                        className={`flex flex-col items-center justify-center rounded-2xl border p-3.5 text-center transition ${
                          isSelected
                            ? 'border-[#009689] bg-[#e6f4f2] text-[#007268] ring-2 ring-[#009689]/20 dark:bg-[#009689]/20 dark:text-[#5fc4b8]'
                            : 'border-[#dfe5dc] bg-[#fbfcf9] text-[#556864] hover:border-[#009689]/50 dark:border-white/10 dark:bg-white/5 dark:text-white/70'
                        }`}
                      >
                        <Icon size={18} className="mb-1" />
                        <span className="text-sm font-bold">{preset.days} Days</span>
                        <span className="text-[11px] opacity-70">{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Stepper & Range Slider */}
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#dfe5dc] bg-[#fbfcf9] p-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDays((d) => Math.max(1, d - 1))}
                      className="grid h-10 w-10 place-items-center rounded-xl bg-white border border-[#d5ddd1] text-lg font-bold shadow-sm hover:bg-[#f6f4ee] dark:border-white/15 dark:bg-white/10"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={days}
                      onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 rounded-xl border border-[#d5ddd1] bg-white py-2 text-center text-lg font-bold outline-none dark:border-white/15 dark:bg-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => setDays((d) => Math.min(365, d + 1))}
                      className="grid h-10 w-10 place-items-center rounded-xl bg-white border border-[#d5ddd1] text-lg font-bold shadow-sm hover:bg-[#f6f4ee] dark:border-white/15 dark:bg-white/10"
                    >
                      +
                    </button>
                    <span className="text-sm font-semibold text-[#556864] dark:text-white/70">days total</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="90"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#d5ddd1] accent-[#009689] dark:bg-white/20"
                  />
                </div>
              </div>

              {/* 3. Start Date */}
              <div>
                <label className="mb-2 block text-sm font-semibold">3. Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-4 py-3 outline-none focus:border-[#007268] dark:border-white/10 dark:bg-white/5"
                />
              </div>

              {/* Calculated Plan Result Preview Card */}
              <div className="rounded-3xl border border-[#009689]/30 bg-gradient-to-br from-[#e6f4f2] to-[#f4faf8] p-6 dark:from-[#0f2324] dark:to-[#142326]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#007268] dark:text-[#5fc4b8]">
                    Calculated Result
                  </span>
                  <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${paceInfo.color}`}>
                    <PaceIcon size={14} />
                    <span>{paceInfo.label}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {/* Daily Target */}
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur dark:bg-white/5">
                    <p className="text-xs text-[#7b8c84] dark:text-white/50">Daily Reading Goal</p>
                    <p className="mt-1 text-2xl font-black text-[#007268] dark:text-[#5fc4b8]">
                      {pagesPerDay} <span className="text-sm font-semibold">pages/day</span>
                    </p>
                    <p className="mt-1 text-xs text-[#556864] dark:text-white/60">
                      Total {totalPages} pages
                    </p>
                  </div>

                  {/* Estimated Time */}
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur dark:bg-white/5">
                    <p className="text-xs text-[#7b8c84] dark:text-white/50">Est. Daily Time</p>
                    <p className="mt-1 text-2xl font-black text-[#0b1619] dark:text-white">
                      ~{estimatedMinsPerDay} <span className="text-sm font-semibold">mins/day</span>
                    </p>
                    <p className="mt-1 text-xs text-[#556864] dark:text-white/60">
                      ~1.75 mins per page
                    </p>
                  </div>

                  {/* Target Completion */}
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur dark:bg-white/5">
                    <p className="text-xs text-[#7b8c84] dark:text-white/50">Finish By</p>
                    <p className="mt-1 text-base font-bold text-[#0b1619] dark:text-white">
                      {formattedTargetDate}
                    </p>
                    <p className="mt-1 text-xs text-[#556864] dark:text-white/60">
                      In {numDays} day{numDays > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Milestone Checkpoints */}
                <div className="mt-4 border-t border-[#009689]/20 pt-4">
                  <p className="text-xs font-semibold text-[#556864] dark:text-white/70">Plan Milestones</p>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-white/60 p-2 dark:bg-white/5">
                      <span className="block font-bold text-[#007268] dark:text-[#5fc4b8]">25%</span>
                      <span className="text-[11px] text-[#7b8c84] dark:text-white/50">Day {Math.max(1, Math.round(numDays * 0.25))}</span>
                    </div>
                    <div className="rounded-lg bg-white/60 p-2 dark:bg-white/5">
                      <span className="block font-bold text-[#007268] dark:text-[#5fc4b8]">50%</span>
                      <span className="text-[11px] text-[#7b8c84] dark:text-white/50">Day {Math.max(1, Math.round(numDays * 0.5))}</span>
                    </div>
                    <div className="rounded-lg bg-white/60 p-2 dark:bg-white/5">
                      <span className="block font-bold text-[#007268] dark:text-[#5fc4b8]">75%</span>
                      <span className="text-[11px] text-[#7b8c84] dark:text-white/50">Day {Math.max(1, Math.round(numDays * 0.75))}</span>
                    </div>
                    <div className="rounded-lg bg-white/60 p-2 dark:bg-white/5">
                      <span className="block font-bold text-[#007268] dark:text-[#5fc4b8]">100%</span>
                      <span className="text-[11px] text-[#7b8c84] dark:text-white/50">Day {numDays}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-[#d5ddd1] px-5 py-3 text-sm font-semibold hover:bg-[#f6f4ee] dark:border-white/15 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#009689] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268]"
                >
                  <CheckCircle2 size={18} /> Save Reading Plan
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Plans List */}
        {!plans.length && !open ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[#c9d6d2] bg-white p-12 text-center dark:border-white/10 dark:bg-[#142326]">
            <CalendarDays className="mx-auto text-[#009689] dark:text-[#5fc4b8]" size={42} />
            <h3 className="mt-4 text-xl font-bold">No Reading Plans Yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6b7a77] dark:text-white/60">
              Set reading targets for books in your library. Choose how many days you want to spend on each book and stay on track.
            </p>
            {books.length > 0 ? (
              <button
                onClick={() => setOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#009689] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268]"
              >
                <Plus size={18} /> Create your first plan
              </button>
            ) : (
              <Link
                to="/app/upload"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#009689] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268]"
              >
                <Plus size={18} /> Upload a book first
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            <h2 className="text-xl font-bold">Active Plans ({plans.length})</h2>

            <div className="grid gap-5 md:grid-cols-2">
              {plans.map((plan) => {
                const book = books.find((b) => b.id === plan.bookId);
                const cover = book?.coverDataUrl || book?.coverUrl;
                const currentPage = book ? getProgress(user.id, book.id).page : 1;
                const total = book?.totalPages || plan.totalPages || 1;
                const pct = Math.min(100, Math.round((currentPage / total) * 100));
                const remainingPages = Math.max(0, total - currentPage);
                const daysLeft = Math.ceil(remainingPages / (plan.pagesPerDay || 1));

                return (
                  <div
                    key={plan.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-[#e4e1d6] bg-white p-5 shadow-sm transition duration-200 hover:border-[#009689]/40 hover:shadow-md dark:border-white/10 dark:bg-[#142326] sm:p-6"
                  >
                    <div>
                      {/* Top Header: Cover, Title, Target */}
                      <div className="flex gap-4">
                        {/* Book Cover Thumbnail */}
                        <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-[#e8e4d9] shadow-sm dark:bg-[#1b2b2e]">
                          {cover ? (
                            <img src={cover} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center bg-[#18332b] text-white">
                              <BookOpen size={22} />
                            </div>
                          )}
                        </div>

                        {/* Plan Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="truncate font-bold text-[#0b1619] dark:text-white" title={book?.title}>
                              {book?.title || 'Book'}
                            </h3>
                            <button
                              onClick={() => handleRemove(plan.id)}
                              className="rounded-lg p-1 text-[#9b5147] opacity-60 transition hover:bg-[#fff1ef] hover:opacity-100 dark:hover:bg-red-950/40"
                              title="Delete plan"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <p className="truncate text-xs text-[#7b8c84] dark:text-white/60">
                            {book?.author || 'Unknown author'}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#e6f4f2] px-2.5 py-1 text-xs font-bold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                              <Target size={13} /> {plan.pagesPerDay} pages/day
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f0eee6] px-2.5 py-1 text-xs font-medium text-[#5c6863] dark:bg-white/10 dark:text-white/70">
                              <CalendarDays size={13} /> Finish by {new Date(`${plan.targetDate}T12:00:00`).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-5">
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#556864] dark:text-white/70">
                            Page {currentPage} of {total}
                          </span>
                          <span className="font-bold text-[#007268] dark:text-[#5fc4b8]">{pct}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#e9eee7] dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#009689] to-[#d6a84a] transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-5 flex items-center justify-between border-t border-[#e4e1d6] pt-4 dark:border-white/10">
                      <span className="text-xs text-[#7b8c84] dark:text-white/50">
                        {remainingPages > 0 ? `~${daysLeft} days left at target pace` : '🎉 Plan complete!'}
                      </span>

                      {book && (
                        <button
                          onClick={() => navigate(`/app/reader/${book.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#007268]"
                        >
                          <Play size={13} fill="currentColor" /> Continue Reading
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
