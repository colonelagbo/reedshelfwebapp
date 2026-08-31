import { useState } from 'react';
import { BookOpen, MoreHorizontal, Play, Trash2 } from 'lucide-react';

export function BookCard({ book, progress = 0, onOpen, onDelete, view = 'grid' }) {
  const cover = book.coverDataUrl || book.coverUrl;
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDelete?.(book);
  };

  const coverBox = (
    <div className="relative h-full w-full overflow-hidden bg-[#e8e4d9] dark:bg-[#1b2b2e]">
      {cover ? (
        <img
          src={cover}
          alt={`${book.title} cover`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#dce9df] to-[#f0f4e9] p-6 dark:from-[#15272a] dark:to-[#1a3338]">
          <div className="w-[72%] rounded-md bg-[#18332b] px-4 py-7 text-center shadow-xl dark:bg-[#0c1815]">
            <BookOpen className="mx-auto mb-3 text-[#d9f26c]" size={28} />
            <p className="line-clamp-3 text-sm font-bold text-white">{book.title}</p>
            <p className="mt-2 text-[10px] text-white/60">{book.author || 'Unknown author'}</p>
          </div>
        </div>
      )}
      <button
        onClick={onOpen}
        className="absolute inset-0 grid place-items-center bg-[#18332b]/0 transition-colors duration-200 hover:bg-[#18332b]/20 group-hover:bg-[#18332b]/15"
        aria-label={`Open ${book.title}`}
      >
        <span className="scale-75 rounded-full bg-[#d9f26c] p-4 text-[#0b1619] opacity-0 shadow-xl transition-all duration-200 hover:scale-100 hover:opacity-100 group-hover:opacity-100">
          <Play fill="currentColor" size={20} />
        </span>
      </button>
    </div>
  );

  if (view === 'shelf') {
    return (
      <article
        className="group flex items-center gap-4 rounded-xl border border-[#dfe5dc] bg-white p-3 shadow-sm transition hover:border-[#009689]/40 hover:shadow-md dark:border-white/10 dark:bg-[#142326]"
        onDoubleClick={onOpen}
      >
        <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-[#e8e4d9] shadow-sm dark:bg-[#1b2b2e]">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-[#18332b] text-white">
              <BookOpen size={20} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-[#0b1619] dark:text-white" title={book.title}>
            {book.title}
          </h3>
          <p className="truncate text-sm text-[#7b8c84] dark:text-white/60" title={book.author}>
            {book.author || 'Unknown author'}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e9eee7] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-[#7b9346]"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-[#7b8c84] dark:text-white/60">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <button
          onClick={onOpen}
          className="rounded-lg bg-[#009689] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268]"
        >
          Read
        </button>
        {onDelete && (
          <button
            onClick={handleDeleteClick}
            className="rounded-lg p-2.5 text-[#9aa9a2] hover:bg-red-500/10 hover:text-red-500"
            aria-label={`Delete ${book.title}`}
            title="Delete book"
          >
            <Trash2 size={18} />
          </button>
        )}
      </article>
    );
  }

  if (view === 'list') {
    return (
      <article className="flex items-center gap-4 border-b border-[#e4e1d6] py-4 dark:border-white/10">
        <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-[#e8e4d9] shadow-sm dark:bg-[#1b2b2e]">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-[#18332b] text-white">
              <BookOpen size={18} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-[#0b1619] dark:text-white" title={book.title}>
            {book.title}
          </h3>
          <p className="truncate text-sm text-[#7b8c84] dark:text-white/60" title={book.author}>
            {book.author || 'Unknown author'}
          </p>
        </div>
        <span className="text-sm font-semibold text-[#4a5a58] dark:text-white/70">
          {Math.round(progress)}%
        </span>
        <button
          onClick={onOpen}
          className="rounded-lg p-2.5 text-[#007268] hover:bg-[#e6f4f2] dark:text-[#5fc4b8] dark:hover:bg-white/10"
          aria-label={`Open ${book.title}`}
        >
          <Play size={18} />
        </button>
        {onDelete && (
          <button
            onClick={handleDeleteClick}
            className="rounded-lg p-2.5 text-[#9aa9a2] hover:bg-red-500/10 hover:text-red-500"
            aria-label={`Delete ${book.title}`}
            title="Delete book"
          >
            <Trash2 size={18} />
          </button>
        )}
      </article>
    );
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-[#dfe5dc] bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#009689]/40 hover:shadow-md dark:border-white/10 dark:bg-[#142326]">
      <div className="aspect-[2/3] w-full">{coverBox}</div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className="cursor-pointer truncate font-bold text-[#0b1619] transition hover:text-[#007268] dark:text-white dark:hover:text-[#5fc4b8]"
              onClick={onOpen}
              title={book.title}
            >
              {book.title}
            </h3>
            <p className="mt-1 truncate text-sm text-[#7b8c84] dark:text-white/60" title={book.author}>
              {book.author || 'Unknown author'}
            </p>
          </div>
          {onDelete && (
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="rounded-lg p-1 text-[#9aa9a2] hover:bg-[#f0eee6] hover:text-[#0b1619] dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Book options"
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <>
                  {/* Backdrop to close the menu on outside click */}
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-[#e4e1d6] bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#1a2c30]">
                    <button
                      onClick={handleDeleteClick}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 size={15} /> Delete book
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-[#7b8c84] dark:text-white/60">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#e9eee7] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[#7b9346]"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
