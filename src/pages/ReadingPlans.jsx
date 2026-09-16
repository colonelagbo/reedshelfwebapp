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
  Play,
  User,
  Users,
  AtSign,
  UserPlus
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import {
  addPlan,
  deletePlan,
  getCurrentUser,
  getProgress,
  getUserBooks,
  getUserPlans,
  fetchBooks,
  fetchPlans,
  searchRegisteredUsers,
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
  const [books, setBooks] = useState(() => getUserBooks(user?.id || ''));
  const [plans, setPlans] = useState(() => (user?.id ? getUserPlans(user.id) : []));
  const [open, setOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(14);
  const [planType, setPlanType] = useState('individual'); // 'individual' | 'group'
  const [groupName, setGroupName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState([]);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [filterPlanTab, setFilterPlanTab] = useState('all'); // 'all' | 'individual' | 'group'

  useEffect(() => {
    if (user?.id) {
      fetchPlans().then((p) => p && setPlans(p)).catch(() => {});
      fetchBooks().then((b) => {
        if (b && Array.isArray(b)) {
          setBooks(b);
          setSelectedBookId((curr) => curr || (b.length > 0 ? b[0].id : ''));
        }
      }).catch(() => {});
    }
  }, [user?.id]);

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

  const handleSearchUsers = async (val) => {
    setMemberInput(val);
    if (!val || val.trim().length < 1) {
      setUserSuggestions([]);
      return;
    }
    try {
      const cleanVal = val.replace(/^@/, '').trim();
      const results = await searchRegisteredUsers(cleanVal);
      const currentUserName = (user?.name || '').toLowerCase().replace(/\s+/g, '');
      const existingUsernames = new Set(members.map((m) => m.username.toLowerCase()));
      // Filter out self and already added members
      const filtered = (results || []).filter((u) => {
        const uName = (u.username || u.name || '').toLowerCase();
        return uName !== currentUserName && !existingUsernames.has(uName);
      });
      setUserSuggestions(filtered);
    } catch {
      setUserSuggestions([]);
    }
  };

  const handleAddMember = (candidate) => {
    let username = '';
    let name = '';
    let email = '';
    let id = null;

    if (typeof candidate === 'object' && candidate !== null) {
      username = candidate.username || candidate.name?.toLowerCase().replace(/\s+/g, '') || '';
      name = candidate.name || username;
      email = candidate.email || '';
      id = candidate.id || null;
    } else {
      username = String(candidate || '').replace(/^@/, '').trim().toLowerCase();
      name = username;
    }

    if (!username) return;

    // Check if member already exists
    if (members.some((m) => m.username.toLowerCase() === username.toLowerCase())) {
      setMemberInput('');
      setUserSuggestions([]);
      return;
    }

    // Check if adding self
    const currentUserName = (user?.name || '').toLowerCase().replace(/\s+/g, '');
    if (username.toLowerCase() === currentUserName) {
      setMemberInput('');
      setUserSuggestions([]);
      return;
    }

    setMembers([...members, { id, username, name, email, addedAt: new Date().toISOString() }]);
    setMemberInput('');
    setUserSuggestions([]);
  };

  const handleRemoveMember = (usernameToRemove) => {
    setMembers(members.filter((m) => m.username !== usernameToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBook?.id || !user?.id) return;

    try {
      const isGroup = planType === 'group';
      const cleanGroupName = isGroup
        ? (groupName.trim() || `${user?.name || 'Reader'}'s Book Club`)
        : '';

      const newPlan = await addPlan({
        bookId: selectedBook.id,
        userId: user.id,
        startDate,
        targetDate,
        days: numDays,
        pagesPerDay,
        totalPages,
        planType: isGroup ? 'group' : 'individual',
        groupName: cleanGroupName,
        members: isGroup ? members : [],
      });

      setPlans([newPlan, ...plans]);
      setOpen(false);
      // Reset form state
      setPlanType('individual');
      setGroupName('');
      setMembers([]);
      setMemberInput('');
      setUserSuggestions([]);
    } catch (err) {
      console.error('Error adding plan:', err);
    }
  };

  const handleRemove = async (id) => {
    if (window.confirm('Delete this reading plan?')) {
      await deletePlan(id);
      setPlans(plans.filter((p) => p.id !== id));
    }
  };

  const PaceIcon = paceInfo.icon;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Reading Plans</h1>
            <p className="mt-1 text-xs text-[#6b7a77] sm:text-sm dark:text-white/60">
              Set how many days you want to read a book, and ReedShelf calculates your daily targets.
            </p>
          </div>
          {books.length > 0 && (
            <button
              onClick={() => setOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#009689] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268] touch-manipulation"
            >
              <Plus size={18} /> Create a plan
            </button>
          )}
        </div>

        {/* Create Plan Section / Modal Form */}
        {open && (
          <div className="mt-5 rounded-3xl border border-[#e4e1d6] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#142326] sm:mt-7 sm:p-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-2xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                  <Sparkles size={22} />
                </span>
                <div>
                  <h2 className="text-lg font-bold sm:text-xl">Create a Reading Plan</h2>
                  <p className="text-xs text-[#6b7a77] sm:text-sm dark:text-white/60">
                    How many days do you want to read this book?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-[#7b8c84] hover:bg-[#f6f4ee] dark:hover:bg-white/10 touch-manipulation"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5 sm:mt-7 sm:space-y-6">
              {/* Plan Type Selector */}
              <div>
                <label className="mb-2 block text-xs sm:text-sm font-semibold">Choose Plan Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlanType('individual')}
                    className={`flex items-center justify-center gap-2 rounded-2xl border p-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
                      planType === 'individual'
                        ? 'border-[#009689] bg-[#e6f4f2] text-[#007268] ring-2 ring-[#009689]/20 dark:bg-[#009689]/20 dark:text-[#5fc4b8]'
                        : 'border-[#dfe5dc] bg-[#fbfcf9] text-[#556864] hover:border-[#009689]/50 dark:border-white/10 dark:bg-white/5 dark:text-white/70'
                    }`}
                  >
                    <User size={18} />
                    <span>Individual Plan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanType('group')}
                    className={`flex items-center justify-center gap-2 rounded-2xl border p-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
                      planType === 'group'
                        ? 'border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-500/20 dark:border-purple-400 dark:bg-purple-950/40 dark:text-purple-300'
                        : 'border-[#dfe5dc] bg-[#fbfcf9] text-[#556864] hover:border-purple-400/50 dark:border-white/10 dark:bg-white/5 dark:text-white/70'
                    }`}
                  >
                    <Users size={18} />
                    <span>Group Reading Plan</span>
                  </button>
                </div>
              </div>

              {/* Group Reading Plan Configuration */}
              {planType === 'group' && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 sm:p-5 dark:border-purple-900/40 dark:bg-purple-950/20 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs sm:text-sm font-semibold text-[#0b1619] dark:text-white">
                      Group / Book Club Name
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g. Summer Reading Club, Philosophy Circle..."
                      className="w-full rounded-xl border border-[#d5ddd1] bg-white px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-purple-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs sm:text-sm font-semibold text-[#0b1619] dark:text-white">
                        Add Group Members (by Username)
                      </label>
                      <span className="text-[11px] text-[#7b8c84] dark:text-white/60">
                        {members.length + 1} participant{members.length > 0 ? 's' : ''}
                      </span>
                    </div>

                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <AtSign className="absolute left-3 top-3 text-[#8b9a93]" size={16} />
                          <input
                            type="text"
                            value={memberInput}
                            onChange={(e) => handleSearchUsers(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddMember(memberInput);
                              }
                            }}
                            placeholder="Type username or name..."
                            className="w-full rounded-xl border border-[#d5ddd1] bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm outline-none focus:border-purple-500 dark:border-white/10 dark:bg-white/5"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddMember(memberInput)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition active:scale-95 cursor-pointer"
                        >
                          <UserPlus size={15} /> Add
                        </button>
                      </div>

                      {/* Dropdown suggestions */}
                      {userSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-[#e4e1d6] bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#1a2c30]">
                          {userSuggestions.map((u) => (
                            <button
                              type="button"
                              key={u.id || u.username}
                              onClick={() => handleAddMember(u)}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-purple-50 dark:hover:bg-white/10 transition cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <span className="grid h-6 w-6 place-items-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                                  {u.name?.charAt(0) || u.username?.charAt(0) || 'U'}
                                </span>
                                <div>
                                  <p className="font-bold text-[#0b1619] dark:text-white">@{u.username || u.name}</p>
                                  <p className="text-[10px] text-[#7b8c84] dark:text-white/60">{u.name}</p>
                                </div>
                              </div>
                              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">+ Add</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Members Chips List */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {/* Host Chip */}
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-purple-100/90 px-2.5 py-1 text-xs font-bold text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
                        <span>@{user?.name?.toLowerCase().replace(/\s+/g, '') || 'you'}</span>
                        <span className="text-[9px] uppercase font-extrabold tracking-wider bg-purple-600 text-white rounded px-1 py-0.2">Host</span>
                      </span>

                      {/* Added members chips */}
                      {members.map((m) => (
                        <span
                          key={m.username}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#0b1619] shadow-2xs dark:border-purple-800/40 dark:bg-white/10 dark:text-white"
                        >
                          <span>@{m.username}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.username)}
                            className="rounded-full p-0.5 text-stone-400 hover:text-red-500 transition cursor-pointer"
                            aria-label={`Remove ${m.username}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}

                      {members.length === 0 && (
                        <span className="text-xs text-stone-400 dark:text-white/40 italic">
                          No members added yet. Type a username above to invite friends.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 1. Book Selector */}
              <div>
                <label className="mb-2 block text-xs sm:text-sm font-semibold">1. Select a Book</label>
                <select
                  required
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-[#007268] dark:border-white/10 dark:bg-white/5"
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
                <label className="mb-2 block text-xs sm:text-sm font-semibold">
                  2. How many days do you want to read this book?
                </label>

                {/* Preset Day Buttons */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                  {PRESET_DAYS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = numDays === preset.days;
                    return (
                      <button
                        type="button"
                        key={preset.days}
                        onClick={() => setDays(preset.days)}
                        className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl border p-2.5 sm:p-3.5 text-center transition touch-manipulation ${
                          isSelected
                            ? 'border-[#009689] bg-[#e6f4f2] text-[#007268] ring-2 ring-[#009689]/20 dark:bg-[#009689]/20 dark:text-[#5fc4b8]'
                            : 'border-[#dfe5dc] bg-[#fbfcf9] text-[#556864] hover:border-[#009689]/50 dark:border-white/10 dark:bg-white/5 dark:text-white/70'
                        }`}
                      >
                        <Icon size={18} className="mb-0.5 sm:mb-1" />
                        <span className="text-xs sm:text-sm font-bold">{preset.days} Days</span>
                        <span className="text-[10px] sm:text-[11px] opacity-70">{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Stepper & Range Slider */}
                <div className="mt-3 sm:mt-4 flex flex-col gap-3 rounded-2xl border border-[#dfe5dc] bg-[#fbfcf9] p-3 sm:p-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDays((d) => Math.max(1, d - 1))}
                      className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-[#d5ddd1] text-lg font-bold shadow-sm hover:bg-[#f6f4ee] dark:border-white/15 dark:bg-white/10 touch-manipulation"
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
                      className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-[#d5ddd1] text-lg font-bold shadow-sm hover:bg-[#f6f4ee] dark:border-white/15 dark:bg-white/10 touch-manipulation"
                    >
                      +
                    </button>
                    <span className="text-xs sm:text-sm font-semibold text-[#556864] dark:text-white/70">days total</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="90"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#d5ddd1] accent-[#009689] dark:bg-white/20 touch-manipulation"
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
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-[44px] rounded-xl border border-[#d5ddd1] px-5 py-2.5 text-sm font-semibold hover:bg-[#f6f4ee] dark:border-white/15 dark:hover:bg-white/5 touch-manipulation text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] justify-center items-center gap-2 rounded-xl bg-[#009689] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268] touch-manipulation"
                >
                  <CheckCircle2 size={18} /> Save Reading Plan
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Plans List */}
        {!plans.length && !open ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[#c9d6d2] bg-white p-8 sm:p-12 text-center dark:border-white/10 dark:bg-[#142326]">
            <CalendarDays className="mx-auto text-[#009689] dark:text-[#5fc4b8]" size={40} />
            <h3 className="mt-4 text-lg font-bold sm:text-xl">No Reading Plans Yet</h3>
            <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-[#6b7a77] dark:text-white/60">
              Set reading targets for books in your library. Choose how many days you want to spend on each book and stay on track.
            </p>
            {books.length > 0 ? (
              <button
                onClick={() => setOpen(true)}
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#009689] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268] touch-manipulation"
              >
                <Plus size={18} /> Create your first plan
              </button>
            ) : (
              <Link
                to="/app/upload"
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#009689] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268] touch-manipulation"
              >
                <Plus size={18} /> Upload a book first
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold sm:text-xl">Active Plans ({plans.length})</h2>

              {/* Plan Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'All Plans', count: plans.length },
                  { id: 'individual', label: 'Personal', count: plans.filter(p => p.planType !== 'group').length },
                  { id: 'group', label: 'Group Plans', count: plans.filter(p => p.planType === 'group').length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterPlanTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      filterPlanTab === tab.id
                        ? 'bg-[#009689] text-white shadow-xs'
                        : 'border border-[#dfe5dc] bg-white text-[#556864] hover:bg-[#f6f4ee] dark:border-white/10 dark:bg-[#142326] dark:text-white/70'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="rounded-full bg-black/10 dark:bg-white/15 px-1.5 py-0.2 text-[10px]">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
              {plans
                .filter((plan) => {
                  if (filterPlanTab === 'individual') return plan.planType !== 'group';
                  if (filterPlanTab === 'group') return plan.planType === 'group';
                  return true;
                })
                .map((plan) => {
                const book = books.find((b) => b.id === plan.bookId);
                const cover = book?.coverDataUrl || book?.coverUrl;
                const currentPage = book ? getProgress(user.id, book.id).page : 1;
                const total = book?.totalPages || plan.totalPages || 1;
                const pct = Math.min(100, Math.round((currentPage / total) * 100));
                const remainingPages = Math.max(0, total - currentPage);
                const daysLeft = Math.ceil(remainingPages / (plan.pagesPerDay || 1));
                const isGroup = plan.planType === 'group';
                const planMembers = Array.isArray(plan.members) ? plan.members : [];

                return (
                  <div
                    key={plan.id}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition duration-200 hover:shadow-md dark:bg-[#142326] sm:p-6 ${
                      isGroup
                        ? 'border-purple-200 dark:border-purple-900/40 hover:border-purple-400'
                        : 'border-[#e4e1d6] hover:border-[#009689]/40 dark:border-white/10'
                    }`}
                  >
                    <div>
                      {/* Top Header: Cover, Title, Target */}
                      <div className="flex gap-3.5 sm:gap-4">
                        {/* Book Cover Thumbnail */}
                        <div className="h-24 w-16 sm:h-28 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-[#e8e4d9] shadow-sm dark:bg-[#1b2b2e]">
                          {cover ? (
                            <img src={cover} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center bg-[#18332b] text-white">
                              <BookOpen size={20} />
                            </div>
                          )}
                        </div>

                        {/* Plan Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <h3 className="truncate text-sm sm:text-base font-bold text-[#0b1619] dark:text-white" title={book?.title}>
                              {book?.title || 'Book'}
                            </h3>
                            <button
                              onClick={() => handleRemove(plan.id)}
                              className="grid h-9 w-9 place-items-center rounded-lg text-[#9b5147] opacity-70 transition hover:bg-[#fff1ef] hover:opacity-100 dark:hover:bg-red-950/40 touch-manipulation cursor-pointer"
                              title="Delete plan"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <p className="truncate text-xs text-[#7b8c84] dark:text-white/60">
                            {book?.author || 'Unknown author'}
                          </p>

                          {/* Group Badge if Group Plan */}
                          {isGroup && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-purple-100/80 dark:bg-purple-950/40 px-2 py-0.5 text-[11px] font-bold text-purple-800 dark:text-purple-300">
                              <Users size={12} />
                              <span className="truncate max-w-[170px]">
                                {plan.groupName || 'Group Plan'}
                              </span>
                            </div>
                          )}

                          <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#e6f4f2] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                              <Target size={12} /> {plan.pagesPerDay} pages/day
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f0eee6] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-medium text-[#5c6863] dark:bg-white/10 dark:text-white/70">
                              <CalendarDays size={12} /> Finish by {new Date(`${plan.targetDate}T12:00:00`).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Group Members List if Group Plan */}
                      {isGroup && (
                        <div className="mt-3.5 rounded-2xl bg-purple-50/50 p-2.5 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-purple-900 dark:text-purple-300 mb-1.5">
                            <span className="flex items-center gap-1">
                              <Users size={12} /> Members ({planMembers.length + 1})
                            </span>
                            <span className="text-[10px] text-purple-600 dark:text-purple-400">
                              {plan.userId === user?.id ? 'You are Host' : 'Joined Group'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className="rounded-md bg-purple-200/60 dark:bg-purple-900/50 px-2 py-0.5 text-[10px] font-bold text-purple-900 dark:text-purple-200">
                              Host
                            </span>
                            {planMembers.map((m, idx) => {
                              const uName = typeof m === 'string' ? m : (m.username || m.name || 'Member');
                              return (
                                <span
                                  key={idx}
                                  className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-stone-700 shadow-2xs border border-purple-100 dark:bg-white/10 dark:border-transparent dark:text-white/80"
                                >
                                  @{uName}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div className="mt-4 sm:mt-5">
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#556864] dark:text-white/70">
                            Page {currentPage} of {total}
                          </span>
                          <span className="font-bold text-[#007268] dark:text-[#5fc4b8]">{pct}%</span>
                        </div>
                        <div className="h-2 sm:h-2.5 overflow-hidden rounded-full bg-[#e9eee7] dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#009689] to-[#d6a84a] transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-t border-[#e4e1d6] pt-3.5 sm:pt-4 dark:border-white/10">
                      <span className="text-xs text-[#7b8c84] dark:text-white/50">
                        {remainingPages > 0 ? `~${daysLeft} days left at target pace` : '🎉 Plan complete!'}
                      </span>

                      {book && (
                        <button
                          onClick={() => navigate(`/app/reader/${book.id}`)}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#007268] touch-manipulation"
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
