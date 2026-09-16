import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Upload,
  BookOpen,
  LayoutGrid,
  Rows3,
  GalleryHorizontalEnd,
  Columns3,
  Plus,
  AlertTriangle,
  Loader2,
  X,
  CheckCircle2,
  Flame,
  ArrowUpDown,
  HardDrive
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { BookCard } from '../components/BookCard';
import {
  getCurrentUser,
  getBooks,
  getUserBooks,
  getUserStorageUsage,
  fetchBooks,
  getProgress,
  getSettings,
  saveSettings,
  deleteBook
} from '../lib/appStore';

const viewButtons = [
  { id: 'grid', icon: LayoutGrid, label: 'Cover grid' },
  { id: 'shelf', icon: GalleryHorizontalEnd, label: 'Standing shelf' },
  { id: 'list', icon: Rows3, label: 'Compact list' },
  { id: 'wide', icon: Columns3, label: 'Wide covers' },
];

export function Library() {
  const [user, setUser] = useState(() => getCurrentUser());
  const [books, setBooks] = useState(() => {
    const u = getCurrentUser();
    return u?.id ? getUserBooks(u.id) : getBooks();
  });
  const [loading, setLoading] = useState(() => {
    const u = getCurrentUser();
    const init = u?.id ? getUserBooks(u.id) : getBooks();
    return init.length === 0;
  });
  const [query, setQuery] = useState('');
  const [view, setView] = useState(() => getSettings(getCurrentUser()?.id || '').libraryView || 'grid');
  const [filterTab, setFilterTab] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [bookToDelete, setBookToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [storage, setStorage] = useState(() => getUserStorageUsage(user?.id));
  const navigate = useNavigate();

  const loadBooks = useCallback(async () => {
    const activeUser = getCurrentUser();
    const activeId = activeUser?.id;
    const isAdmin = activeUser?.role === 'admin';

    if (activeUser && activeUser.id !== user?.id) {
      setUser(activeUser);
    }

    // Load instantly from local storage cache
    const initial = (activeId && !isAdmin) ? getUserBooks(activeId) : getBooks();
    if (initial.length > 0) {
      setBooks(initial);
      setStorage(getUserStorageUsage(activeId));
      setLoading(false);
    }

    try {
      const fetched = await fetchBooks();
      if (Array.isArray(fetched)) {
        // Admins see all books in the database; regular users see their uploaded books
        const filtered = (activeId && !isAdmin) ? fetched.filter((b) => {
          const owner = b.uploadedBy || b.uploaded_by;
          return !owner || owner === activeId || owner === 'demo_user';
        }) : fetched;
        setBooks(filtered);
        setStorage(getUserStorageUsage(activeId));
      }
    } catch (e) {
      console.warn('Could not load remote books:', e);
      if (initial.length > 0) setBooks(initial);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Keep storage and books list synchronized across upload/delete/cloud updates
  useEffect(() => {
    setStorage(getUserStorageUsage(user?.id));
  }, [books, user?.id]);

  useEffect(() => {
    const handleUpdate = () => {
      loadBooks();
    };
    window.addEventListener('reedshelf:books_updated', handleUpdate);
    return () => window.removeEventListener('reedshelf:books_updated', handleUpdate);
  }, [loadBooks]);

  // Statistics calculation
  const stats = useMemo(() => {
    let reading = 0;
    let completed = 0;
    let unread = 0;

    books.forEach((b) => {
      const p = getProgress(user?.id, b.id).page;
      const total = b.totalPages || 0;
      if (total > 0 && p >= total) {
        completed++;
      } else if (p > 1) {
        reading++;
      } else {
        unread++;
      }
    });

    return { total: books.length, reading, completed, unread };
  }, [books, user?.id]);

  // Filtered and sorted books list
  const filtered = useMemo(() => {
    let result = books.filter((b) => {
      const matchesQuery = `${b.title} ${b.author}`.toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;

      const p = getProgress(user?.id, b.id).page;
      const total = b.totalPages || 0;
      const isCompleted = total > 0 && p >= total;
      const isReading = p > 1 && !isCompleted;
      const isUnread = p <= 1;

      if (filterTab === 'reading') return isReading;
      if (filterTab === 'completed') return isCompleted;
      if (filterTab === 'unread') return isUnread;
      return true;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'progress') {
        const pA = a.totalPages ? (getProgress(user?.id, a.id).page / a.totalPages) : 0;
        const pB = b.totalPages ? (getProgress(user?.id, b.id).page / b.totalPages) : 0;
        return pB - pA;
      }
      // 'recent' by default
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return result;
  }, [books, query, filterTab, sortBy, user?.id]);

  const changeView = (v) => {
    setView(v);
    if (user?.id) {
      saveSettings(user.id, { libraryView: v });
    }
  };

  const confirmDelete = async () => {
    if (!bookToDelete || !user?.id) return;
    setDeleting(true);
    try {
      await deleteBook(bookToDelete.id);
      const updated = await fetchBooks();
      const isAdmin = user?.role === 'admin';
      const filtered = (user?.id && !isAdmin) ? updated.filter((b) => {
        const owner = b.uploadedBy || b.uploaded_by;
        return !owner || owner === user.id || owner === 'demo_user';
      }) : updated;
      setBooks(filtered);
      setStorage(getUserStorageUsage(user?.id));
      setBookToDelete(null);
    } catch (err) {
      console.error('Failed to delete book:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#007268] dark:text-[#5fc4b8]">
              Your Personal Sanctuary
            </span>
            <h1 className="mt-0.5 text-2xl sm:text-3xl font-extrabold text-[#0b1619] dark:text-white tracking-tight">
              Library Shelf
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6b7a77] dark:text-white/60">
              Browse, organize, and continue reading your books with high-fidelity digital covers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              to="/app/profile"
              className="inline-flex items-center gap-2 rounded-xl border border-[#dfe5dc] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0b1619] shadow-xs hover:border-[#009689] dark:border-white/10 dark:bg-[#142326] dark:text-white transition"
              title="Account storage quota: 50 MB"
            >
              <HardDrive size={15} className="text-[#009689] dark:text-[#5fc4b8]" />
              <span>Storage:</span>
              <span className="font-bold text-[#009689] dark:text-[#5fc4b8]">{storage.usedMB} / 50 MB</span>
              <span className="hidden xs:inline text-[11px] text-[#7b8c84] dark:text-white/40">({storage.remainingMB} MB free)</span>
            </Link>
            <Link
              to="/app/upload"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#009689] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#009689]/20 transition-all hover:bg-[#007268] active:scale-[0.98]"
            >
              <Upload size={17} /> Upload book
            </Link>
          </div>
        </div>

        {/* Modern Statistics Bar */}
        {books.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-[#142326]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <BookOpen size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-[#0b1619] dark:text-white">{stats.total}</p>
                <p className="text-[11px] font-medium text-[#6b7a77] dark:text-white/60 truncate">Total Books</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-[#142326]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Flame size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-[#0b1619] dark:text-white">{stats.reading}</p>
                <p className="text-[11px] font-medium text-[#6b7a77] dark:text-white/60 truncate">Reading Now</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-[#142326]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-[#0b1619] dark:text-white">{stats.completed}</p>
                <p className="text-[11px] font-medium text-[#6b7a77] dark:text-white/60 truncate">Completed</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-[#142326]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-white/60">
                <BookOpen size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-[#0b1619] dark:text-white">{stats.unread}</p>
                <p className="text-[11px] font-medium text-[#6b7a77] dark:text-white/60 truncate">Unread Books</p>
              </div>
            </div>
          </div>
        )}

        {/* Modern Filter Pills & Controls Bar */}
        <div className="mt-5 sm:mt-6 flex flex-col gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Books', count: stats.total },
              { id: 'reading', label: 'Currently Reading', count: stats.reading },
              { id: 'completed', label: 'Completed', count: stats.completed },
              { id: 'unread', label: 'Unread', count: stats.unread },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  filterTab === tab.id
                    ? 'bg-[#009689] text-white shadow-xs'
                    : 'border border-[#dfe5dc] bg-white text-[#556864] hover:bg-[#f6f4ee] dark:border-white/10 dark:bg-[#142326] dark:text-white/70 dark:hover:bg-white/5'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                    filterTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-black/5 dark:bg-white/10 text-inherit'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search, Sort & View Switcher */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 text-[#8b9a93]" size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, author..."
                className="w-full rounded-xl border border-[#d5ddd1] bg-white py-2.5 sm:py-3 pl-11 pr-9 text-sm outline-none transition focus:border-[#007268] focus:ring-2 focus:ring-[#007268]/20 dark:border-white/10 dark:bg-[#142326]"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-3 rounded-md p-0.5 text-[#8b9a93] hover:text-[#0b1619] dark:hover:text-white"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-[46px] rounded-xl border border-[#d5ddd1] bg-white px-3.5 pr-8 text-xs font-semibold outline-none focus:border-[#007268] dark:border-white/10 dark:bg-[#142326] cursor-pointer appearance-none"
                  aria-label="Sort books by"
                >
                  <option value="recent">Recently Added</option>
                  <option value="title">Title (A - Z)</option>
                  <option value="progress">Highest Progress</option>
                </select>
                <ArrowUpDown size={14} className="pointer-events-none absolute right-2.5 top-4 text-[#8b9a93]" />
              </div>

              {/* View Switcher */}
              <div className="flex items-center rounded-xl border border-[#d5ddd1] bg-white p-1 dark:border-white/10 dark:bg-[#142326]">
                {viewButtons.map((btn) => {
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.id}
                      title={btn.label}
                      onClick={() => changeView(btn.id)}
                      className={`flex items-center justify-center rounded-lg p-2 sm:p-2.5 transition min-w-[38px] cursor-pointer ${
                        view === btn.id
                          ? 'bg-[#e6f4f2] text-[#007268] font-bold shadow-2xs dark:bg-[#009689]/20 dark:text-[#5fc4b8]'
                          : 'text-[#7b8c84] hover:text-[#0b1619] dark:hover:text-white'
                      }`}
                    >
                      <Icon size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Books Container */}
        {filtered.length ? (
          <div
            className={`mt-5 sm:mt-7 ${
              view === 'grid'
                ? 'grid grid-cols-2 gap-3.5 sm:gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                : view === 'wide'
                ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
                : view === 'shelf'
                ? 'space-y-3'
                : 'divide-y divide-[#e4e1d6] dark:divide-white/10'
            }`}
          >
            {filtered.map((book) => {
              const page = getProgress(user?.id, book.id).page;
              const pct = book.totalPages
                ? Math.min(100, Math.round((page / book.totalPages) * 100))
                : 0;
              return (
                <BookCard
                  key={book.id}
                  book={book}
                  progress={pct}
                  currentPage={page}
                  view={view === 'wide' ? 'grid' : view}
                  onOpen={() => navigate(`/app/reader/${book.id}`)}
                  onDelete={() => setBookToDelete(book)}
                />
              );
            })}
          </div>
        ) : loading && books.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-9 w-9 animate-spin text-[#009689]" />
            <p className="mt-4 text-sm font-semibold text-[#0b1619] dark:text-white">Retrieving your library...</p>
            <p className="mt-1 text-xs text-[#6b7a77] dark:text-white/60">Connecting to cloud bookshelf</p>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-[#c9d6d2] bg-white p-12 text-center dark:border-white/10 dark:bg-[#142326]">
            <BookOpen className="mx-auto text-[#6b7a77] dark:text-white/40" size={36} />
            <h3 className="mt-4 text-lg font-bold text-[#0b1619] dark:text-white">
              {books.length ? 'No books found' : 'Your library is empty'}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#6b7a77] dark:text-white/60">
              {books.length
                ? 'Try searching with a different title or author name.'
                : 'Upload your first PDF to start building your bookshelf.'}
            </p>
            {!books.length && (
              <Link
                to="/app/upload"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#009689] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268]"
              >
                <Plus size={16} /> Upload a book
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {bookToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#142326]">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-500">
                <AlertTriangle size={20} />
              </div>
              <button
                onClick={() => setBookToDelete(null)}
                className="rounded-lg p-1 text-[#9aa9a2] hover:bg-[#f0eee6] hover:text-[#0b1619] dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Cancel"
              >
                <X size={18} />
              </button>
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#0b1619] dark:text-white">Delete this book?</h3>
            <p className="mt-1.5 text-sm text-[#6b7a77] dark:text-white/60">
              "{bookToDelete.title}" will be permanently removed from your library, along with its reading
              progress and highlights. This can't be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setBookToDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-[#d5ddd1] px-4 py-2.5 text-sm font-semibold hover:bg-[#f6f4ee] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  'Delete book'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
