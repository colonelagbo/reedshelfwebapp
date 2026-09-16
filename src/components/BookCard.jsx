import { useState } from 'react';
import { BookOpen, MoreHorizontal, Play, Trash2, CheckCircle2, Clock, Check } from 'lucide-react';

export function BookCard({ book, progress = 0, currentPage = 1, onOpen, onDelete, view = 'grid' }) {
  const cover = book.coverDataUrl || book.coverUrl;
  const [menuOpen, setMenuOpen] = useState(false);
  const totalPages = book.totalPages || 0;
  const isFinished = progress >= 100;
  const isStarted = progress > 0 && !isFinished;

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDelete?.(book);
  };

  const coverBox = (
    <div
      onClick={onOpen}
      className="relative h-full w-full cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-[#ebe6d8] to-[#dfd9cb] dark:from-[#182629] dark:to-[#121e21] select-none group/cover shadow-inner"
    >
      {/* 3D Realistic Spine Groove & Edge Lighting */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-3.5 bg-gradient-to-r from-black/35 via-black/15 to-transparent z-20" />
      <div className="pointer-events-none absolute inset-y-0 left-[3px] w-[1px] bg-white/20 z-20" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10 dark:ring-white/10 z-20" />

      {cover ? (
        <img
          src={cover}
          alt={`${book.title} cover`}
          className="h-full w-full object-cover transition-all duration-500 ease-out group-hover/cover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="relative flex h-full w-full flex-col justify-between p-4 sm:p-5 bg-gradient-to-br from-[#0c2420] via-[#153a33] to-[#0a1d1a] text-white">
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-[#5fc4b8] backdrop-blur-md">
              <BookOpen size={16} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              ReedShelf
            </span>
          </div>
          <div className="my-auto py-2">
            <h4 className="line-clamp-3 text-xs sm:text-sm font-bold text-white leading-snug tracking-tight">
              {book.title}
            </h4>
            <p className="mt-1.5 text-[11px] font-medium text-white/60 truncate">
              {book.author || 'Unknown author'}
            </p>
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/40 border-t border-white/10 pt-2">
            <span>{totalPages ? `${totalPages} pages` : 'PDF'}</span>
            <span>Document</span>
          </div>
        </div>
      )}

      {/* Top Status & Format Badges */}
      <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-center justify-between pointer-events-none">
        {isFinished ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm backdrop-blur-md">
            <Check size={11} strokeWidth={3} /> Finished
          </span>
        ) : isStarted ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#009689]/90 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5fc4b8] animate-pulse" />
            {Math.round(progress)}%
          </span>
        ) : (
          <span className="rounded-full bg-black/45 text-white/80 text-[10px] font-semibold px-2 py-0.5 backdrop-blur-md">
            Unread
          </span>
        )}

        <span className="rounded-md bg-black/45 text-white/80 text-[9px] font-bold px-1.5 py-0.5 backdrop-blur-md uppercase tracking-wider">
          PDF
        </span>
      </div>

      {/* Modern Hover Action Overlay */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover/cover:opacity-100">
        <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-[#009689] text-white shadow-xl shadow-[#009689]/40 transition-transform duration-300 hover:scale-110 hover:bg-[#007f74]">
          <Play fill="currentColor" size={20} className="translate-x-0.5" />
        </span>
        <span className="text-xs font-bold text-white shadow-xs">
          {isStarted ? 'Continue Reading' : isFinished ? 'Read Again' : 'Start Reading'}
        </span>
        {totalPages > 0 && (
          <span className="mt-1 text-[11px] font-medium text-white/70">
            {isStarted ? `Page ${currentPage} of ${totalPages}` : `${totalPages} pages`}
          </span>
        )}
      </div>
    </div>
  );

  // 1. STANDING SHELF VIEW (Modern Horizontal Card)
  if (view === 'shelf') {
    return (
      <article
        onClick={onOpen}
        className="group relative flex items-center gap-4 sm:gap-5 rounded-2xl border border-[#dfe5dc] bg-white p-3.5 sm:p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#009689]/40 hover:shadow-md dark:border-white/10 dark:bg-[#142326] cursor-pointer"
      >
        <div className="relative h-24 w-16 sm:h-28 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#ebe6d8] to-[#dfd9cb] shadow-sm dark:from-[#182629] dark:to-[#121e21]">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/30 to-transparent z-10" />
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="grid h-full place-items-center bg-[#153a33] text-white">
              <BookOpen size={20} className="text-[#5fc4b8]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isFinished ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5">
                <CheckCircle2 size={11} /> Finished
              </span>
            ) : isStarted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#009689]/10 text-[#007268] dark:text-[#5fc4b8] text-[10px] font-bold px-2 py-0.5">
                <Clock size={11} /> Page {currentPage} of {totalPages || '?'}
              </span>
            ) : (
              <span className="rounded-full bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-white/60 text-[10px] font-bold px-2 py-0.5">
                Not started
              </span>
            )}
            {totalPages > 0 && (
              <span className="text-[11px] text-[#7b8c84] dark:text-white/50">
                • {totalPages} pages
              </span>
            )}
          </div>

          <h3 className="line-clamp-1 font-bold text-sm sm:text-base text-[#0b1619] group-hover:text-[#007268] dark:text-white dark:group-hover:text-[#5fc4b8] transition-colors" title={book.title}>
            {book.title}
          </h3>
          <p className="truncate text-xs sm:text-sm text-[#7b8c84] dark:text-white/60 mt-0.5" title={book.author}>
            {book.author || 'Unknown author'}
          </p>

          <div className="mt-3 flex items-center gap-3 max-w-sm">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e9eee7] dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFinished ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#009689] to-[#5fc4b8]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <span className="text-xs font-bold text-[#007268] dark:text-[#5fc4b8]">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-[#007268] active:scale-95"
          >
            <Play fill="currentColor" size={13} />
            <span>{isStarted ? 'Continue' : 'Read'}</span>
          </button>
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#9aa9a2] transition hover:bg-red-500/10 hover:text-red-500 active:scale-95"
              aria-label={`Delete ${book.title}`}
              title="Delete book"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </article>
    );
  }

  // 2. COMPACT LIST VIEW
  if (view === 'list') {
    return (
      <article
        onClick={onOpen}
        className="group flex items-center gap-3 sm:gap-4 border-b border-[#e4e1d6] py-3.5 dark:border-white/10 cursor-pointer hover:bg-[#009689]/[0.03] dark:hover:bg-white/[0.03] px-2 rounded-xl transition"
      >
        <div className="relative h-14 w-10 sm:h-16 sm:w-11 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[#ebe6d8] to-[#dfd9cb] shadow-xs dark:from-[#182629] dark:to-[#121e21]">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/25 to-transparent z-10" />
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-[#153a33] text-[#5fc4b8]">
              <BookOpen size={14} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 font-bold text-sm sm:text-base text-[#0b1619] group-hover:text-[#007268] dark:text-white dark:group-hover:text-[#5fc4b8] transition" title={book.title}>
            {book.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-[#7b8c84] dark:text-white/60">
            <span className="truncate max-w-[200px]" title={book.author}>{book.author || 'Unknown author'}</span>
            {totalPages > 0 && <span>• {totalPages} pages</span>}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 w-40">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e9eee7] dark:bg-white/10">
            <div
              className={`h-full rounded-full ${isFinished ? 'bg-emerald-500' : 'bg-[#009689]'}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <span className="text-xs font-bold text-[#4a5a58] dark:text-white/70 w-9 text-right">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#007268] bg-[#e6f4f2] transition hover:bg-[#007268] hover:text-white dark:bg-white/10 dark:text-[#5fc4b8] dark:hover:bg-[#009689] dark:hover:text-white"
            aria-label={`Open ${book.title}`}
          >
            <Play size={15} fill="currentColor" />
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
        </div>
      </article>
    );
  }

  // 3. MODERN GRID VIEW (Standard & Wide)
  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#dfe5dc] bg-white p-2.5 sm:p-3 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:border-[#009689]/40 hover:shadow-xl dark:border-white/10 dark:bg-[#142326]">
      {/* Cover container with 3D spine and interactive overlay */}
      <div className="aspect-[2/3] w-full overflow-hidden rounded-2xl">
        {coverBox}
      </div>

      {/* Book Information Section */}
      <div className="mt-3 flex flex-1 flex-col justify-between px-1">
        <div>
          <div className="flex items-start justify-between gap-1.5">
            <h3
              className="cursor-pointer line-clamp-2 text-xs sm:text-sm font-bold text-[#0b1619] transition-colors group-hover:text-[#007268] dark:text-white dark:group-hover:text-[#5fc4b8] leading-snug"
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
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9aa9a2] transition hover:bg-[#f0eee6] hover:text-[#0b1619] dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Book options"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-xl border border-[#e4e1d6] bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#1a2c30]">
                      <button
                        onClick={handleDeleteClick}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-500/10 transition"
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

        {/* Progress bar and page tracker */}
        <div className="mt-3 border-t border-[#f0eee6] pt-2.5 dark:border-white/5">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-medium text-[#7b8c84] dark:text-white/50">
              {totalPages > 0 && isStarted ? `p. ${currentPage} of ${totalPages}` : isFinished ? 'Completed' : 'Progress'}
            </span>
            <span className={`font-bold ${isFinished ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#007268] dark:text-[#5fc4b8]'}`}>
              {Math.round(progress)}%
            </span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-[#e9eee7] dark:bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFinished ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#009689] to-[#5fc4b8]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
