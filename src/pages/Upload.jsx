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
import { addBook, getCurrentUser, saveBookFile } from '../lib/appStore';
import { extractPdfInfo } from '../lib/pdfMetadata';

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

      const book = addBook({
        title,
        author,
        fileName: file.name,
        fileType: file.type || 'application/pdf',
        size: file.size,
        uploadedBy: user.id,
        totalPages,
        coverDataUrl,
      });

      await saveBookFile(book.id, file);
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
            <h1 className="text-3xl font-bold">Upload a book</h1>
            <p className="mt-1 text-[#6b7a77] dark:text-white/60">
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
          className="mt-7 rounded-3xl border border-[#e4e1d6] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#12232a] sm:p-8"
        >
          {error && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-[#fff1ef] p-4 text-sm text-[#9b5147] dark:bg-[#3a1a17] dark:text-[#fca5a5]">
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
                className={`group cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
                  isDragging
                    ? 'border-[#007268] bg-[#e6f4f2]/50 dark:bg-[#007268]/20'
                    : 'border-[#c9d6d2] bg-[#fbfcf9] hover:border-[#007268] hover:bg-[#f6faf8] dark:border-white/20 dark:bg-white/5 dark:hover:border-[#009689]'
                }`}
              >
                <div className="mx-auto flex max-w-sm flex-col items-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#e6f4f2] text-[#009689] transition group-hover:scale-105 dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                    <UploadCloud size={32} />
                  </div>
                  <span className="mt-4 text-base font-semibold">Choose a PDF or drag & drop</span>
                  <span className="mt-1 text-sm text-[#6b7a77] dark:text-white/60">
                    PDF files up to 50MB
                  </span>
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2 text-xs font-semibold text-white shadow-sm transition group-hover:bg-[#007268]">
                    <FileText size={14} /> Browse file
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
                <div className="relative overflow-hidden rounded-2xl border border-[#dfe5dc] bg-[#fbfcf9] p-5 dark:border-white/10 dark:bg-white/5 sm:p-6">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="absolute right-4 top-4 rounded-lg p-1.5 text-[#8b9a93] hover:bg-[#e4e1d6] hover:text-[#0b1619] dark:hover:bg-white/10 dark:hover:text-white"
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
                        <h3 className="text-xl font-bold tracking-tight text-[#0b1619] dark:text-white sm:text-2xl">
                          {extractedInfo?.title || file.name}
                        </h3>
                      </div>

                      <div>
                        <span className="text-xs font-medium text-[#7b8c84] dark:text-white/50">Author</span>
                        <p className="text-base font-medium text-[#4a5a58] dark:text-white/80">
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

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-[#e4e1d6] pt-6 dark:border-white/10">
            <button
              type="button"
              onClick={() => navigate('/app/library')}
              className="rounded-xl border border-[#d5ddd1] px-5 py-3 text-sm font-semibold hover:bg-[#f6f4ee] dark:border-white/15 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || extracting || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#009689] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268] disabled:cursor-not-allowed disabled:opacity-50"
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
