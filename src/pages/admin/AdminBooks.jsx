import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileText,
  User,
  Eye,
  X,
  HardDrive,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/AdminToast';

export function AdminBooks() {
  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Preview Modal
  const [selectedBook, setSelectedBook] = useState(null);

  const toast = useToast();

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getBooks({
        search,
        sort: sortField,
        order: sortOrder,
        page: pagination.page,
        limit: pagination.limit
      });
      setBooks(res.books || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch books:', err);
      toast.error('Unable to retrieve platform books list.');
    } finally {
      setLoading(false);
    }
  }, [search, sortField, sortOrder, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
            Books Catalog
          </h1>
          <p className="mt-1 text-sm text-[#6b7a77] dark:text-white/60">
            Inspect all digital volumes, storage keys, and owner attribution across Reedshelf.
          </p>
        </div>

        <button
          onClick={fetchBooks}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#e4e1d6] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#0b1619] shadow-xs hover:bg-[#f6f4ee] dark:border-white/15 dark:bg-[#12232a] dark:text-white dark:hover:bg-white/5 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[260px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7a77] dark:text-white/40" />
          <input
            type="text"
            placeholder="Search book title, author, or owner email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full rounded-xl border border-[#e4e1d6] bg-white py-2.5 pl-10 pr-3 text-xs sm:text-sm text-[#0b1619] placeholder:text-[#6b7a77]/60 focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
          />
        </div>

        {/* Sort */}
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
          className="rounded-xl border border-[#e4e1d6] bg-white px-3 py-2.5 text-xs sm:text-sm font-medium text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#12232a] dark:text-white"
        >
          <option value="date">Sort: Upload Date</option>
          <option value="size">Sort: File Size</option>
          <option value="title">Sort: Title</option>
          <option value="pages">Sort: Pages Count</option>
        </select>
      </div>

      {/* Books Table */}
      <div className="rounded-2xl border border-[#e4e1d6] bg-white shadow-xs overflow-hidden dark:border-white/10 dark:bg-[#12232a]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-[#e4e1d6] bg-[#f6f4ee]/50 text-[#6b7a77] dark:border-white/10 dark:bg-white/[0.02] dark:text-white/40">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Book</th>
                <th className="px-4 py-3.5 font-semibold">Owner</th>
                <th className="px-4 py-3.5 font-semibold">
                  <button
                    onClick={() => handleSort('size')}
                    className="flex items-center gap-1 font-semibold hover:text-[#0b1619] dark:hover:text-white"
                  >
                    Size <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-4 py-3.5 font-semibold">Pages</th>
                <th className="px-4 py-3.5 font-semibold">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center gap-1 font-semibold hover:text-[#0b1619] dark:hover:text-white"
                  >
                    Uploaded <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-4 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#e4e1d6]/60 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-[#6b7a77] dark:text-white/40">
                    <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-[#009689]" />
                    Loading books catalog...
                  </td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-[#6b7a77] dark:text-white/40">
                    No books uploaded yet matching the criteria.
                  </td>
                </tr>
              ) : (
                books.map((b) => (
                  <tr key={b.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition">
                    {/* Book Title & Author */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-8 rounded-md bg-[#009689]/10 flex items-center justify-center shrink-0 border border-[#009689]/20 overflow-hidden text-[#009689]">
                          {b.coverUrl || b.coverDataUrl ? (
                            <img src={b.coverUrl || b.coverDataUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <BookOpen size={16} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0b1619] dark:text-white truncate">{b.title}</p>
                          <p className="text-[11px] text-[#6b7a77] dark:text-white/50 truncate">
                            {b.author || 'Unknown Author'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="font-medium text-[#0b1619] dark:text-white truncate">{b.ownerName}</p>
                        <p className="text-[11px] text-[#6b7a77] dark:text-white/50 truncate">{b.ownerEmail}</p>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="px-4 py-3.5 font-bold text-[#009689] dark:text-[#5fc4b8]">
                      {b.formattedSize}
                    </td>

                    {/* Pages */}
                    <td className="px-4 py-3.5 text-[#6b7a77] dark:text-white/60">
                      {b.totalPages > 0 ? `${b.totalPages} pp` : '—'}
                    </td>

                    {/* Upload Date */}
                    <td className="px-4 py-3.5 text-xs text-[#6b7a77] dark:text-white/50 whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedBook(b)}
                          className="rounded-lg border border-[#e4e1d6] p-1.5 text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/10 dark:text-white/60 dark:hover:border-[#5fc4b8] dark:hover:text-[#5fc4b8] transition"
                          title="View Book Metadata"
                        >
                          <Eye size={15} />
                        </button>
                        <Link
                          to={`/admin/users?search=${encodeURIComponent(b.ownerEmail)}`}
                          className="rounded-lg border border-[#e4e1d6] p-1.5 text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/10 dark:text-white/60 dark:hover:border-[#5fc4b8] dark:hover:text-[#5fc4b8] transition"
                          title="Inspect Owner Library"
                        >
                          <User size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e4e1d6] px-4 py-3 dark:border-white/10 text-xs">
            <span className="text-[#6b7a77] dark:text-white/50">
              Page <span className="font-semibold text-[#0b1619] dark:text-white">{pagination.page}</span> of{' '}
              <span className="font-semibold text-[#0b1619] dark:text-white">{pagination.totalPages}</span> ({pagination.total} books)
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#e4e1d6] px-3 py-1 font-semibold text-[#0b1619] disabled:opacity-40 hover:bg-[#f6f4ee] dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#e4e1d6] px-3 py-1 font-semibold text-[#0b1619] disabled:opacity-40 hover:bg-[#f6f4ee] dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Book Metadata Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#12232a]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-16 w-12 rounded-lg bg-[#009689]/10 border border-[#009689]/20 flex items-center justify-center overflow-hidden shrink-0">
                  {selectedBook.coverUrl || selectedBook.coverDataUrl ? (
                    <img src={selectedBook.coverUrl || selectedBook.coverDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen size={24} className="text-[#009689]" />
                  )}
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0b1619] dark:text-white">
                    {selectedBook.title}
                  </h3>
                  <p className="text-xs text-[#6b7a77] dark:text-white/60">
                    By {selectedBook.author || 'Unknown Author'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedBook(null)}
                className="rounded-xl p-1.5 text-[#6b7a77] hover:bg-black/5 dark:text-white/60"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-3 text-xs">
              <div className="rounded-xl border border-[#e4e1d6] p-3 dark:border-white/10 space-y-2 bg-[#fbfcf9] dark:bg-white/[0.02]">
                <div className="flex justify-between">
                  <span className="text-[#6b7a77] dark:text-white/40">File Name:</span>
                  <span className="font-semibold text-[#0b1619] dark:text-white">{selectedBook.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7a77] dark:text-white/40">File Size:</span>
                  <span className="font-bold text-[#009689] dark:text-[#5fc4b8]">{selectedBook.formattedSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7a77] dark:text-white/40">Total Pages:</span>
                  <span className="font-semibold text-[#0b1619] dark:text-white">{selectedBook.totalPages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7a77] dark:text-white/40">Uploaded By:</span>
                  <span className="font-semibold text-[#0b1619] dark:text-white">
                    {selectedBook.ownerName} ({selectedBook.ownerEmail})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7a77] dark:text-white/40">Upload Date:</span>
                  <span className="text-[#0b1619] dark:text-white">
                    {new Date(selectedBook.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[#e4e1d6] p-3 dark:border-white/10 bg-[#fbfcf9] dark:bg-white/[0.02]">
                <p className="text-[11px] font-bold text-[#6b7a77] dark:text-white/40 uppercase tracking-wider mb-1">
                  Supabase Storage Key
                </p>
                <code className="block break-all font-mono text-[11px] text-[#009689] dark:text-[#5fc4b8] bg-black/5 dark:bg-black/30 p-2 rounded-lg">
                  {selectedBook.r2Key || `books/${selectedBook.uploadedBy}/${selectedBook.id}/${selectedBook.fileName}`}
                </code>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#e4e1d6] pt-4 dark:border-white/10">
              <Link
                to={`/admin/users?search=${encodeURIComponent(selectedBook.ownerEmail)}`}
                onClick={() => setSelectedBook(null)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#e4e1d6] px-4 py-2 text-xs font-semibold text-[#0b1619] hover:bg-[#f6f4ee] dark:border-white/10 dark:text-white dark:hover:bg-white/5"
              >
                Inspect Owner Account <ArrowRight size={13} />
              </Link>
              <button
                onClick={() => setSelectedBook(null)}
                className="rounded-xl bg-[#009689] px-4 py-2 text-xs font-semibold text-white hover:bg-[#007268]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
