import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Plus, Sparkles } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { BookCard } from '../components/BookCard';
import { getCurrentUser, getUserBooks, getProgress, getUserPlans, fetchBooks, fetchPlans, isBookSharedWithUser } from '../lib/appStore';

export function Dashboard() {
  const user = getCurrentUser();
  const [books, setBooks] = useState(() => (user?.id ? getUserBooks(user.id) : []));
  const [plans, setPlans] = useState(() => (user?.id ? getUserPlans(user.id) : []));
  const [loading, setLoading] = useState(() => {
    const u = getCurrentUser();
    const init = u?.id ? getUserBooks(u.id) : [];
    return init.length === 0;
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    const loadData = async () => {
      try {
        const [b, p] = await Promise.allSettled([fetchBooks(), fetchPlans()]);
        if (isMounted) {
          if (b.status === 'fulfilled' && Array.isArray(b.value)) {
            const filtered = b.value.filter((item) => {
              const owner = item.uploadedBy || item.uploaded_by;
              return owner === user.id || item.isShared || isBookSharedWithUser(item, user);
            });
            setBooks(filtered);
          }
          if (p.status === 'fulfilled' && Array.isArray(p.value)) {
            setPlans(p.value);
          }
        }
      } catch (err) {
        // Ignored
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    window.addEventListener('reedshelf:books_updated', loadData);
    window.addEventListener('reedshelf:plans_updated', loadData);
    return () => {
      isMounted = false;
      window.removeEventListener('reedshelf:books_updated', loadData);
      window.removeEventListener('reedshelf:plans_updated', loadData);
    };
  }, [user?.id, user?.role]);

  const progress = (b) => {
    const p = getProgress(user?.id, b.id).page;
    return b.totalPages ? Math.round((p / b.totalPages) * 100) : 0;
  };

  const started = books.filter((b) => getProgress(user?.id, b.id).page > 1).slice(0, 3);
  const unstarted = books.filter((b) => !started.some((s) => s.id === b.id));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.16em] text-[#007268] dark:text-[#5fc4b8]">Good to see you</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-4xl text-[#0b1619] dark:text-white">
              Welcome, {user?.name?.split(' ')[0] || 'Reader'}.
            </h1>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-[#4a5a58] dark:text-white/60">Keep your reading momentum going.</p>
          </div>
          <Link
            to="/app/upload"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#009689] px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268] active:scale-[0.98]"
          >
            <Plus size={18} /> Upload a book
          </Link>
        </div>

        {/* Responsive Stats Row (3 compact columns on phones) */}
        <div className="mt-5 sm:mt-8 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-2xl bg-[#0b1619] p-3 sm:p-5 text-white dark:border dark:border-white/10">
            <BookOpen className="text-[#d6a84a] size-4 sm:size-6" />
            <p className="mt-2 sm:mt-5 text-xl sm:text-3xl font-bold">{books.length}</p>
            <p className="text-[11px] sm:text-sm text-white/70 leading-tight">Books in library</p>
          </div>
          <div className="rounded-2xl border border-[#e4e1d6] bg-white p-3 sm:p-5 dark:border-white/10 dark:bg-[#12232a]">
            <CalendarDays className="text-[#009689] dark:text-[#5fc4b8] size-4 sm:size-6" />
            <p className="mt-2 sm:mt-5 text-xl sm:text-3xl font-bold text-[#0b1619] dark:text-white">{plans.length}</p>
            <p className="text-[11px] sm:text-sm text-[#6b7a77] dark:text-white/60 leading-tight">Active plans</p>
          </div>
          <div className="rounded-2xl border border-[#e4e1d6] bg-white p-3 sm:p-5 dark:border-white/10 dark:bg-[#12232a]">
            <Sparkles className="text-[#009689] dark:text-[#5fc4b8] size-4 sm:size-6" />
            <p className="mt-2 sm:mt-5 text-xl sm:text-3xl font-bold text-[#0b1619] dark:text-white">{started.length}</p>
            <p className="text-[11px] sm:text-sm text-[#6b7a77] dark:text-white/60 leading-tight">In progress</p>
          </div>
        </div>

        {/* Main Reading Section */}
        <section className="mt-7 sm:mt-10">
          <div className="mb-3.5 sm:mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#0b1619] dark:text-white">
                {started.length > 0 ? 'Continue reading' : books.length > 0 ? 'Your library' : 'Start reading'}
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-[#6b7a77] dark:text-white/60">
                {started.length > 0
                  ? 'Pick up where you left off.'
                  : books.length > 0
                  ? 'Choose a book to begin reading.'
                  : 'Add a book to start building your bookshelf.'}
              </p>
            </div>
            {books.length > 0 && (
              <Link to="/app/library" className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#009689] hover:underline dark:text-[#5fc4b8]">
                View library <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {loading && books.length === 0 ? (
            /* Loading Skeleton while books fetch from backend */
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-2xl border border-[#e4e1d6] bg-white p-4 animate-pulse dark:border-white/10 dark:bg-[#12232a]">
                  <div className="aspect-[3/4] w-full rounded-xl bg-gray-200 dark:bg-white/10" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-gray-200 dark:bg-white/10" />
                </div>
              ))}
            </div>
          ) : started.length > 0 ? (
            /* Books currently in progress */
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
              {started.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  progress={progress(b)}
                  onOpen={() => navigate(`/app/reader/${b.id}`)}
                />
              ))}
            </div>
          ) : books.length > 0 ? (
            /* Books in library ready to start reading */
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
              {books.slice(0, 6).map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  progress={progress(b)}
                  onOpen={() => navigate(`/app/reader/${b.id}`)}
                />
              ))}
            </div>
          ) : (
            /* Empty state ONLY when account genuinely has zero uploaded books */
            <div className="rounded-2xl border border-dashed border-[#c9d6d2] bg-white p-6 sm:p-10 text-center dark:border-white/15 dark:bg-white/5">
              <BookOpen className="mx-auto text-[#6b7a77] dark:text-white/40" size={32} />
              <h3 className="mt-3 font-bold text-sm sm:text-base text-[#0b1619] dark:text-white">Your library is empty</h3>
              <p className="mx-auto mt-1 max-w-md text-xs sm:text-sm text-[#6b7a77] dark:text-white/60">
                Upload your first PDF book and start reading. ReedShelf will remember your place for next time.
              </p>
              <Link
                to="/app/upload"
                className="mt-4 sm:mt-5 inline-flex min-h-[42px] items-center rounded-xl bg-[#009689] px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-[#007268] active:scale-95"
              >
                Upload your first book
              </Link>
            </div>
          )}
        </section>

        {/* Secondary Shelf: More books from library when user has started reading books */}
        {started.length > 0 && unstarted.length > 0 && (
          <section className="mt-7 sm:mt-10">
            <div className="mb-3.5 sm:mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0b1619] dark:text-white">More from your library</h2>
                <p className="mt-0.5 text-xs sm:text-sm text-[#6b7a77] dark:text-white/60">Other books ready on your shelf.</p>
              </div>
              <Link to="/app/library" className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#009689] hover:underline dark:text-[#5fc4b8]">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
              {unstarted.slice(0, 3).map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  progress={progress(b)}
                  onOpen={() => navigate(`/app/reader/${b.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
