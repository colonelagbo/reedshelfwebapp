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
    <div
      onClick={onOpen}
      className="relative h-full w-full cursor-pointer overflow-hidden bg-[#e8e4d9] dark:bg-[#1b2b2e]"
    >
      {cover ? (
        <img
          src={cover}
          alt={`${book.title} cover`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#dce9df] to-[#f0f4e9] p-4 sm:p-6 dark:from-[#15272a] dark:to-[#1a3338]">
          <div className="w-[85%] sm:w-[75%] rounded-md bg-[#18332b] px-3 py-5 sm:px-4 sm:py-7 text-center shadow-xl dark:bg-[#0c1815]">
            <BookOpen className="mx-auto mb-2 sm:mb-3 text-[#d9f26c]" size={24} />
            <p className="line-clamp-3 text-xs sm:text-sm font-bold text-white leading-snug">{book.title}</p>
            <p className="mt-1.5 sm:mt-2 text-[10px] text-white/60 truncate">{book.author || 'Unknown author'}</p>
          </div>
        </div>
      )}
      <div
        className="absolute inset-0 grid place-items-center bg-[#18332b]/0 transition-colors duration-200 group-hover:bg-[#18332b]/15"
        aria-hidden="true"
      >
        <span className="scale-75 rounded-full bg-[#d9f26c] p-3 sm:p-4 text-[#0b1619] opacity-0 shadow-xl transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
          <Play fill="currentColor" size={18} />
        </span>
      </div>
    </div>
  );

  if (view === 'shelf') {
    return (
      <article
        className="group flex items-center gap-3 sm:gap-4 rounded-2xl border border-[#dfe5dc] bg-white p-3 shadow-xs transition hover:border-[#009689]/40 hover:shadow-md dark:border-white/10 dark:bg-[#142326] active:scale-[0.99] cursor-pointer"
        onClick={onOpen}
      >
        <div className="h-24 w-16 sm:h-28 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-[#e8e4d9] shadow-xs dark:bg-[#1b2b2e]">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-[#18332b] text-white">
              <BookOpen size={18} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 sm:line-clamp-2 font-bold text-sm sm:text-base text-[#0b1619] dark:text-white" title={book.title}>
            {book.title}
          </h3>
          <p className="truncate text-xs sm:text-sm text-[#7b8c84] dark:text-white/60 mt-0.5" title={book.author}>
            {book.author || 'Unknown author'}
          </p>
          <div className="mt-3 flex items-center gap-2 sm:gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e9eee7] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-[#009689]"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <span className="text-[11px] sm:text-xs font-semibold text-[#7b8c84] dark:text-white/60">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="rounded-xl bg-[#009689] px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-[#007268] active:scale-95"
        >
          Read
        </button>
        {onDelete && (
          <button
            onClick={handleDeleteClick}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#9aa9a2] hover:bg-red-500/10 hover:text-red-500 active:scale-95"
            aria-label={`Delete ${book.title}`}
            title="Delete book"
          >
            <Trash2 size={16} />
          </button>
        )}
      </article>
    );
  }

  if (view === 'list') {
    return (
      <article
        onClick={onOpen}
        className="flex items-center gap-3 sm:gap-4 border-b border-[#e4e1d6] py-3 sm:py-4 dark:border-white/10 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-1 rounded-xl transition"
      >
        <div className="h-16 w-12 sm:h-20 sm:w-14 shrink-0 overflow-hidden rounded-lg bg-[#e8e4d9] shadow-xs dark:bg-[#1b2b2e]">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-[#18332b] text-white">
              <BookOpen size={16} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 font-bold text-sm sm:text-base text-[#0b1619] dark:text-white" title={book.title}>
            {book.title}
          </h3>
          <p className="truncate text-xs text-[#7b8c84] dark:text-white/60" title={book.author}>
            {book.author || 'Unknown author'}
          </p>
        </div>
        <span className="text-xs sm:text-sm font-semibold text-[#4a5a58] dark:text-white/70">
          {Math.round(progress)}%
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#007268] hover:bg-[#e6f4f2] dark:text-[#5fc4b8] dark:hover:bg-white/10"
          aria-label={`Open ${book.title}`}
        >
          <Play size={16} />
        </button>
        {onDelete && (
          <button
            onClick={handleDeleteClick}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#9aa9a2] hover:bg-red-500/10 hover:text-red-500"
            aria-label={`Delete ${book.title}`}
            title="Delete book"
          >
            <Trash2 size={16} />
          </button>
        )}
      </article>
    );
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#dfe5dc] bg-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-[#009689]/40 hover:shadow-md dark:border-white/10 dark:bg-[#142326]">
      <div className="aspect-[2/3] w-full">{coverBox}</div>
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
        <div>
          <div className="flex items-start justify-between gap-1.5">
            <h3
              className="cursor-pointer line-clamp-2 text-xs sm:text-sm font-bold text-[#0b1619] transition hover:text-[#007268] dark:text-white dark:hover:text-[#5fc4b8] leading-tight"
              onClick={onOpen}
              title={book.title}
            >
              {book.title}
            </h3>
            {onDelete && (
              <div className="relative shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9aa9a2] hover:bg-[#f0eee6] hover:text-[#0b1619] dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Book options"
                >
                  <MoreHorizontal size={17} />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-xl border border-[#e4e1d6] bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#1a2c30]">
                      <button
                        onClick={handleDeleteClick}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 size={14} /> Delete book
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="mt-1 truncate text-[11px] sm:text-xs text-[#7b8c84] dark:text-white/60" title={book.author}>
            {book.author || 'Unknown author'}
          </p>
        </div>

        <div className="mt-3 pt-2">
          <div className="mb-1 flex justify-between text-[11px] text-[#7b8c84] dark:text-white/60">
            <span>Progress</span>
            <span className="font-semibold text-[#007268] dark:text-[#5fc4b8]">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e9eee7] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[#009689]"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
