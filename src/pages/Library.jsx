import { useEffect, useMemo, useState } from 'react';
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
  X
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { BookCard } from '../components/BookCard';
import {
  getCurrentUser,
  getUserBooks,
  fetchBooks,
  getProgress,
  getSettings,
  saveSettings,
  getBookFile,
  updateBook,
  deleteBook
} from '../lib/appStore';
import { extractPdfInfo } from '../lib/pdfMetadata';

const viewButtons = [
  { id: 'grid', icon: LayoutGrid, label: 'Cover grid' },
  { id: 'shelf', icon: GalleryHorizontalEnd, label: 'Standing shelf' },
  { id: 'list', icon: Rows3, label: 'Compact list' },
  { id: 'wide', icon: Columns3, label: 'Wide covers' },
];

export function Library() {
  const user = getCurrentUser();
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState('');
  const [view, setView] = useState(getSettings(user?.id || '').libraryView || 'grid');
  const [bookToDelete, setBookToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const userId = user?.id;

  const loadBooks = async () => {
    if (!userId) return;
    const initial = getUserBooks(userId);
    setBooks(initial);

    try {
      const fetched = await fetchBooks();
      setBooks(fetched);
    } catch (e) {
      console.warn('Could not load remote books:', e);
    }
  };

  useEffect(() => {
    loadBooks();
  }, [userId]);

  const filtered = useMemo(
    () =>
      books.filter((b) =>
        `${b.title} ${b.author}`.toLowerCase().includes(query.toLowerCase())
      ),
    [books, query]
  );

  const changeView = (v) => {
    setView(v);
    if (user?.id) {
      saveSettings(user.id, { libraryView: v });
    }
  };

  const confirmDelete = async () => {
    if (!bookToDelete || !userId) return;
    setDeleting(true);
    try {
      await deleteBook(bookToDelete.id);
      const updated = await fetchBooks();
      setBooks(updated);
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
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold">Your library</h1>
            <p className="mt-1 text-[#6b7a77] dark:text-white/60">
              Browse your books with original covers in your preferred layout.
            </p>
          </div>
          <Link
            to="/app/upload"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#009689] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268]"
          >
            <Upload size={18} /> Upload book
          </Link>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 text-[#8b9a93]" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or author..."
              className="w-full rounded-xl border border-[#d5ddd1] bg-white py-3 pl-11 pr-4 outline-none focus:border-[#007268] focus:ring-2 focus:ring-[#007268]/20 dark:border-white/10 dark:bg-[#142326]"
            />
          </div>
          <div className="flex rounded-xl border border-[#d5ddd1] bg-white p-1 dark:border-white/10 dark:bg-[#142326]">
            {viewButtons.map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.id}
                  title={btn.label}
                  onClick={() => changeView(btn.id)}
                  className={`rounded-lg p-2.5 transition ${
                    view === btn.id
                      ? 'bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]'
                      : 'text-[#7b8c84] hover:text-[#0b1619] dark:hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length ? (
          <div
            className={`mt-7 ${
              view === 'grid'
                ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-4'
                : view === 'wide'
                ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'
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
                  view={view === 'wide' ? 'grid' : view}
                  onOpen={() => navigate(`/app/reader/${book.id}`)}
                  onDelete={() => setBookToDelete(book)}
                />
              );
            })}
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
