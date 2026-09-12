import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  FileText,
  UploadCloud,
  X,
  BookOpen,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { addBook, getCurrentUser, saveBookFile, uploadBookFileToCloudflare } from '../lib/appStore';
import { extractPdfInfo } from '../lib/pdfMetadata';
import { supabase } from '../lib/supabaseClient';

export function Upload() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (f) => {
    setError('');
    if (!f) return;

    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    if (f.size > 50 * 1024 * 1024) {
      setError('PDFs must be 50MB or smaller.');
      return;
    }

    setFile(f);
    setExtracting(true);
    setExtractedInfo(null);

    try {
      const info = await extractPdfInfo(f, f.name);
      setExtractedInfo(info);
    } catch (err) {
      console.error('Failed to extract PDF information:', err);
      setError('Could not read PDF metadata, but you can still upload the file.');
      setExtractedInfo({
        title: f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Book',
        author: 'Unknown author',
        totalPages: 0,
        coverDataUrl: null,
      });
    } finally {
      setExtracting(false);
    }
  };

  const onFileInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setExtractedInfo(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a PDF to upload.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const title = extractedInfo?.title || file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Book';
      const author = extractedInfo?.author || 'Unknown author';
      const totalPages = extractedInfo?.totalPages || 0;
      const coverDataUrl = extractedInfo?.coverDataUrl || null;

      let book;
      const currentUser = getCurrentUser();
      const currentUserId = currentUser?.id || user?.id || 'demo_user';

      try {
        book = await uploadBookFileToCloudflare(file, {
          title,
          author,
          totalPages,
          coverDataUrl,
        });
      } catch (backendErr) {
        console.warn('Backend API upload notice, executing direct Supabase Storage & Database sync:', backendErr.message);

        // If session expired or unauthenticated, prompt user to sign in
        const isAuthError = backendErr.message && (
          backendErr.message.toLowerCase().includes('auth') ||
          backendErr.message.toLowerCase().includes('sign in') ||
          backendErr.message.includes('401')
        );
        if (isAuthError) {
          throw new Error('Your session has expired. Please sign in again before uploading.');
        }

        if (supabase) {
          const bookId = `book_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now()}_${Date.now()}`;
          const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const storageKey = `books/${currentUserId}/${bookId}/${safeName}`;

          let directUploadSuccess = false;
          let finalUrl = null;

          try {
            const { error: uploadErr } = await supabase.storage
              .from('reedshelf-books')
              .upload(storageKey, file, { contentType: 'application/pdf', upsert: true });

            if (uploadErr) {
              console.warn('[Supabase Storage Warning] Direct upload returned error:', uploadErr.message);
            } else {
              directUploadSuccess = true;
              const { data: publicUrlData } = supabase.storage.from('reedshelf-books').getPublicUrl(storageKey);
              try {
                const { data: sData } = await supabase.storage.from('reedshelf-books').createSignedUrl(storageKey, 86400 * 7);
                finalUrl = sData?.signedUrl || publicUrlData?.publicUrl || null;
              } catch {
                finalUrl = publicUrlData?.publicUrl || null;
              }

              // Try inserting into Supabase PostgreSQL books table
              try {
                await supabase.from('users').upsert({
                  id: currentUserId,
                  name: currentUser?.name || 'Reader',
                  email: currentUser?.email || 'reader@reedshelf.com',
                  created_at: new Date().toISOString(),
                }, { onConflict: 'id' });

                await supabase.from('books').insert({
                  id: bookId,
                  title,
                  author,
                  file_name: file.name,
                  file_type: file.type || 'application/pdf',
                  file_size: file.size,
                  total_pages: totalPages,
                  uploaded_by: currentUserId,
                  r2_key: storageKey,
                  cover_data_url: coverDataUrl,
                  cover_url: finalUrl,
                  created_at: new Date().toISOString(),
                });
                console.log(`[Supabase DB] Successfully inserted book record: ${bookId}`);
              } catch (sbInsertErr) {
                console.warn('[Supabase DB Warning] Could not insert to Supabase DB:', sbInsertErr.message);
              }
            }
          } catch (storageEx) {
            console.warn('[Supabase Storage Exception] Direct upload failed:', storageEx.message);
          }

          book = addBook({
            id: bookId,
            title,
            author,
            fileName: file.name,
            fileType: file.type || 'application/pdf',
            size: file.size,
            uploadedBy: currentUserId,
            r2Key: directUploadSuccess ? storageKey : null,
            totalPages,
            coverDataUrl,
            coverUrl: finalUrl,
            storageType: directUploadSuccess ? 'supabase' : 'local',
          });
        } else {
          console.warn('Backend upload failed and Supabase is not configured directly on client, storing in local offline storage:', backendErr.message);
          const bookId = `book_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now()}_${Date.now()}`;
          book = addBook({
            id: bookId,
            title,
            author,
            fileName: file.name,
            fileType: file.type || 'application/pdf',
            size: file.size,
            uploadedBy: currentUserId,
            r2Key: null,
            totalPages,
            coverDataUrl,
            coverUrl: null,
            storageType: 'local',
          });
        }
      }

      // Cache locally in IndexedDB/memory for instantaneous reader opening
      if (book?.id) {
        await saveBookFile(book.id, file);
      }
      navigate('/app/library');
    } catch (err) {
      console.error('Error saving book:', err);
      setError(err.message || 'Failed to upload book. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Upload a book</h1>
            <p className="mt-1 text-xs text-[#6b7a77] sm:text-sm dark:text-white/60">
              Select a PDF and ReedShelf will automatically generate the title, author, and book cover.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/library')}
            className="hidden items-center gap-1 text-sm font-semibold text-[#007268] hover:underline dark:text-[#5fc4b8] sm:inline-flex"
          >
            <ArrowLeft size={16} /> Back to library
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-3xl border border-[#e4e1d6] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#12232a] sm:mt-7 sm:p-8"
        >
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-[#fff1ef] p-3.5 text-sm text-[#9b5147] dark:bg-[#3a1a17] dark:text-[#fca5a5]">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!file ? (
            <div>
              <input
                ref={fileInputRef}
                id="book-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={onFileInputChange}
                className="hidden"
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-10 ${
                  isDragging
                    ? 'border-[#007268] bg-[#e6f4f2]/50 dark:bg-[#007268]/20'
                    : 'border-[#c9d6d2] bg-[#fbfcf9] hover:border-[#007268] hover:bg-[#f6faf8] dark:border-white/20 dark:bg-white/5 dark:hover:border-[#009689]'
                }`}
              >
                <div className="mx-auto flex max-w-sm flex-col items-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e6f4f2] text-[#009689] transition group-hover:scale-105 sm:h-16 sm:w-16 dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                    <UploadCloud size={30} />
                  </div>
                  <span className="mt-3 text-base font-semibold sm:mt-4">Tap to choose PDF or drag & drop</span>
                  <span className="mt-1 text-xs text-[#6b7a77] sm:text-sm dark:text-white/60">
                    PDF files up to 50MB
                  </span>
                  <div className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#009689] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition group-hover:bg-[#007268] touch-manipulation">
                    <FileText size={16} /> Browse device
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {extracting ? (
                <div className="rounded-2xl border border-[#dfe5dc] bg-[#fbfcf9] p-8 text-center dark:border-white/10 dark:bg-white/5">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#009689]" />
                  <p className="mt-4 font-semibold">Analyzing book...</p>
                  <p className="mt-1 text-xs text-[#6b7a77] dark:text-white/60">
                    Extracting title, author, and original cover from the PDF
                  </p>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-[#dfe5dc] bg-[#fbfcf9] p-4 sm:p-6 dark:border-white/10 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="absolute right-3 top-3 rounded-lg p-2 text-[#8b9a93] hover:bg-[#e4e1d6] hover:text-[#0b1619] dark:hover:bg-white/10 dark:hover:text-white"
                    title="Remove file"
                  >
                    <X size={18} />
                  </button>

                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#009689] dark:text-[#5fc4b8]">
                    <Sparkles size={14} />
                    <span>Generated Book Details</span>
                  </div>

                  <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
                    {/* Book Cover Thumbnail */}
                    <div className="mx-auto shrink-0 sm:mx-0">
                      <div className="h-44 w-32 overflow-hidden rounded-xl border border-[#dfe5dc] bg-[#e8e4d9] shadow-md dark:border-white/10">
                        {extractedInfo?.coverDataUrl ? (
                          <img
                            src={extractedInfo.coverDataUrl}
                            alt="Extracted Book Cover"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#dce9df] to-[#f0f4e9] p-3 text-center dark:from-[#1b2f29] dark:to-[#12232a]">
                            <BookOpen className="text-[#009689]" size={28} />
                            <span className="mt-2 line-clamp-3 text-xs font-bold">
                              {extractedInfo?.title || 'Book Cover'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Book Metadata details */}
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <span className="text-xs font-medium text-[#7b8c84] dark:text-white/50">Title</span>
                        <h3 className="text-lg font-bold tracking-tight text-[#0b1619] sm:text-2xl dark:text-white">
                          {extractedInfo?.title || file.name}
                        </h3>
                      </div>

                      <div>
                        <span className="text-xs font-medium text-[#7b8c84] dark:text-white/50">Author</span>
                        <p className="text-sm font-medium text-[#4a5a58] sm:text-base dark:text-white/80">
                          {extractedInfo?.author || 'Unknown author'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {extractedInfo?.totalPages ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#e6f4f2] px-2.5 py-1 text-xs font-medium text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                            <CheckCircle2 size={13} /> {extractedInfo.totalPages} pages
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#f0eee6] px-2.5 py-1 text-xs font-medium text-[#5c6863] dark:bg-white/10 dark:text-white/70">
                          <FileText size={13} /> {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 sm:mt-8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 border-t border-[#e4e1d6] pt-5 sm:pt-6 dark:border-white/10">
            <button
              type="button"
              onClick={() => navigate('/app/library')}
              className="min-h-[44px] rounded-xl border border-[#d5ddd1] px-5 py-2.5 text-sm font-semibold hover:bg-[#f6f4ee] dark:border-white/15 dark:hover:bg-white/5 touch-manipulation text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || extracting || saving}
              className="inline-flex min-h-[44px] justify-center items-center gap-2 rounded-xl bg-[#009689] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving to library...
                </>
              ) : (
                'Upload book'
              )}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
