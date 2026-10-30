import { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Users,
  Copy,
  Check,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  BookOpen,
  Mail,
  ExternalLink
} from 'lucide-react';
import { getCurrentUser, searchRegisteredUsers, shareBook, unshareBook } from '../lib/appStore';

export function ShareBookModal({ book, isOpen, onClose, onBookUpdated }) {
  const currentUser = getCurrentUser();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentBook, setCurrentBook] = useState(book);

  useEffect(() => {
    setCurrentBook(book);
    setError('');
    setSuccess('');
    setQuery('');
    setSuggestions([]);
  }, [book, isOpen]);

  // Live user suggestions as user types
  useEffect(() => {
    const trimmed = query.trim().replace(/^@/, '');
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    let isMounted = true;
    setLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchRegisteredUsers(trimmed);
        if (isMounted) {
          const currentEmail = (currentUser?.email || '').toLowerCase();
          const currentName = (currentUser?.name || '').toLowerCase().replace(/\s+/g, '');
          const existing = new Set(
            (currentBook?.sharedWith || []).map((s) => (s.email || s.id || '').toLowerCase())
          );

          // Filter out self and already shared readers
          const filtered = (results || []).filter((u) => {
            const uEmail = (u.email || '').toLowerCase();
            const uName = (u.name || '').toLowerCase().replace(/\s+/g, '');
            return (
              uEmail !== currentEmail &&
              uName !== currentName &&
              !existing.has(uEmail) &&
              !existing.has(u.id)
            );
          });
          setSuggestions(filtered);
        }
      } catch {
        if (isMounted) setSuggestions([]);
      } finally {
        if (isMounted) setLoadingSuggestions(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query, currentUser, currentBook]);

  if (!isOpen || !currentBook) return null;

  const sharedWithList = currentBook.sharedWith || [];
  const isOwner = (currentBook.uploadedBy || currentBook.uploaded_by) === currentUser?.id || !currentBook.uploadedBy;

  const handleShare = async (targetUser = null) => {
    setError('');
    setSuccess('');
    const target = targetUser || { email: query.trim(), username: query.trim() };

    if (!target.email && !target.username && !target.id) {
      setError('Please enter a username or email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await shareBook(currentBook.id, target);
      if (res?.book) {
        setCurrentBook(res.book);
        onBookUpdated?.(res.book);
      }
      setSuccess(res?.message || 'Book shared successfully!');
      setQuery('');
      setSuggestions([]);
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to share book.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnshare = async (entry) => {
    setError('');
    setSuccess('');
    try {
      const res = await unshareBook(currentBook.id, {
        userId: entry.id,
        email: entry.email
      });
      if (res?.book) {
        setCurrentBook(res.book);
        onBookUpdated?.(res.book);
      }
      setSuccess(`Removed share access for ${entry.name || entry.email}.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to revoke access.');
    }
  };

  const shareLink = typeof window !== 'undefined'
    ? `${window.location.origin}/app/reader/${currentBook.id}`
    : `/app/reader/${currentBook.id}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareLink).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  const coverSrc = currentBook.coverDataUrl || currentBook.coverUrl || `/api/books/${currentBook.id}/cover`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#142326] text-[#0b1619] dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e4e1d6] dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
              <Share2 size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold">Share Book</h2>
              <p className="text-xs text-[#7b8c84] dark:text-white/50">
                Grant friends access to read this book on their shelf
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#7b8c84] hover:bg-stone-100 dark:hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Book Preview Card */}
        <div className="mt-4 flex items-center gap-3.5 rounded-2xl bg-[#f6f4ee] p-3 border border-[#e4e1d6]/70 dark:bg-white/5 dark:border-white/10">
          <div className="h-18 w-13 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[#ebe6d8] to-[#dfd9cb] shadow-xs dark:from-[#182629] dark:to-[#121e21]">
            <img
              src={coverSrc}
              alt=""
              onError={(e) => {
                e.target.style.display = 'none';
              }}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-[#0b1619] dark:text-white" title={currentBook.title}>
              {currentBook.title}
            </h3>
            <p className="truncate text-xs text-[#7b8c84] dark:text-white/60 mt-0.5">
              {currentBook.author || 'Unknown author'}
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#7b8c84] dark:text-white/50">
              <span>{currentBook.totalPages || '?'} pages</span>
              <span>&bull;</span>
              <span className="text-[#009689] dark:text-[#5fc4b8] font-semibold">
                {sharedWithList.length} reader{sharedWithList.length === 1 ? '' : 's'} with access
              </span>
            </div>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Share Input Form (only for owner or admin) */}
        {isOwner ? (
          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#557067] dark:text-white/60 mb-1.5">
              Invite Reader (by Username or Email)
            </label>
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7b8c84] dark:text-white/40" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleShare();
                      }
                    }}
                    placeholder="Enter friend's username or email..."
                    className="w-full rounded-xl border border-[#dfe5dc] bg-white pl-9 pr-3 py-2.5 text-xs sm:text-sm text-[#0b1619] placeholder-[#7b8c84] outline-none focus:border-[#009689] focus:ring-1 focus:ring-[#009689] dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/40"
                  />
                  {loadingSuggestions && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#009689]" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleShare()}
                  disabled={submitting || !query.trim()}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-[#007268] active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {submitting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Share2 size={15} />
                  )}
                  <span>Share</span>
                </button>
              </div>

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-[#e4e1d6] bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#1a2c30]">
                  {suggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleShare(u)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-[#009689]/10 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#009689]/15 text-[#009689] font-bold text-xs uppercase">
                          {u.name?.charAt(0) || u.email?.charAt(0) || 'U'}
                        </span>
                        <div>
                          <p className="font-bold text-[#0b1619] dark:text-white leading-tight">{u.name}</p>
                          <p className="text-[11px] text-[#7b8c84] dark:text-white/50">{u.email}</p>
                        </div>
                      </div>
                      <span className="rounded-md bg-[#e6f4f2] px-2 py-0.5 text-[10px] font-bold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                        Invite
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            <span className="font-bold">Shared book:</span> This book was shared with you by{' '}
            <strong>{currentBook.sharedBy?.name || 'another reader'}</strong>.
          </div>
        )}

        {/* Readers with Access List */}
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#557067] dark:text-white/60 mb-2">
            Readers With Access ({sharedWithList.length})
          </p>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {sharedWithList.length > 0 ? (
              sharedWithList.map((entry) => (
                <div
                  key={entry.email || entry.id}
                  className="flex items-center justify-between rounded-xl bg-[#f6f4ee] px-3 py-2 text-xs dark:bg-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#009689]/15 text-[#009689] font-bold text-xs uppercase">
                      {entry.name?.charAt(0) || entry.email?.charAt(0) || 'R'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#0b1619] dark:text-white">
                        {entry.name || entry.email}
                      </p>
                      {entry.name && entry.email && (
                        <p className="truncate text-[10px] text-[#7b8c84] dark:text-white/50">{entry.email}</p>
                      )}
                    </div>
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleUnshare(entry)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                      title="Revoke access"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="py-2 text-center text-xs text-[#7b8c84] dark:text-white/40 italic">
                No readers invited yet. Enter a username or email above to share.
              </p>
            )}
          </div>
        </div>

        {/* Copy Direct Reading Link */}
        <div className="mt-5 pt-4 border-t border-[#e4e1d6] dark:border-white/10">
          <p className="text-xs font-bold uppercase tracking-wider text-[#557067] dark:text-white/60 mb-1.5">
            Direct Reading Link
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareLink}
              className="flex-1 truncate rounded-xl border border-[#dfe5dc] bg-[#f6f4ee] px-3 py-2 text-xs text-[#7b8c84] dark:border-white/10 dark:bg-white/5 dark:text-white/60 select-all"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#dfe5dc] bg-white px-3.5 py-1.5 text-xs font-bold text-[#0b1619] shadow-2xs hover:border-[#009689] dark:border-white/10 dark:bg-white/10 dark:text-white transition cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
