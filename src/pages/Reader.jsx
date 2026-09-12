import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Highlighter,
  BookOpen,
  Minus,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  SlidersHorizontal,
  X,
  Loader2,
  Sun,
  Moon,
  Coffee,
  RotateCcw
} from 'lucide-react';
import {
  getBookFile,
  getCurrentUser,
  getProgress,
  getBooks,
  saveProgress,
  getHighlights,
  saveHighlight,
  deleteHighlight,
  updateBook,
  saveBookFile
} from '../lib/appStore';

// Configure worker URL using Vite asset bundle with fallback
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl || '/pdf.worker.min.mjs';
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#ffd24c' },
  { name: 'Green', value: '#75e0a7' },
  { name: 'Pink', value: '#ff8e8e' },
  { name: 'Blue', value: '#78d1ff' },
  { name: 'Purple', value: '#cfa1ff' },
];

const THEMES = {
  dark: {
    bg: '#0a0f12',
    navBg: '#0f181c',
    border: 'rgba(255,255,255,0.1)',
    text: '#f6f4ee',
    pageShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
    pageFilter: 'none',
  },
  sepia: {
    bg: '#2c2419',
    navBg: '#382f22',
    border: 'rgba(255,255,255,0.12)',
    text: '#faebd7',
    pageShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
    pageFilter: 'sepia(25%) contrast(96%)',
  },
  light: {
    bg: '#e8e5dc',
    navBg: '#f6f4ee',
    border: '#d5ddd1',
    text: '#0b1619',
    pageShadow: '0 20px 40px -15px rgba(0,0,0,0.2)',
    pageFilter: 'none',
  }
};

export function Reader() {
  const { bookId } = useParams();
  const user = getCurrentUser();
  const navigate = useNavigate();

  const allBooks = getBooks();
  const book = allBooks.find((b) => b.id === bookId);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [totalPages, setTotalPages] = useState(book?.totalPages || 1);
  const [currentPage, setCurrentPage] = useState(() => (user && bookId ? getProgress(user.id, bookId).page : 1));
  const [scale, setScale] = useState(1.0);
  const [fitMode, setFitMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'width' : 'page'));
  const [readerTheme, setReaderTheme] = useState('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [highlights, setHighlights] = useState(() => (user && bookId ? getHighlights(user.id, bookId) : []));
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [showHighlightsDrawer, setShowHighlightsDrawer] = useState(false);
  const [selectionPopover, setSelectionPopover] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const fileInputRef = useRef(null);

  const themeConfig = THEMES[readerTheme] || THEMES.dark;

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  }, []);

  // 1. Load PDF document from Storage
  const loadDocument = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    setLoadProgress(10);
    setLoadError('');

    try {
      const file = await getBookFile(bookId);
      if (!file) {
        setLoadError('Book file not found in local storage.');
        setLoading(false);
        return;
      }

      setLoadProgress(30);

      let uint8Array;
      if (file instanceof Uint8Array) {
        uint8Array = file;
      } else if (file instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(file);
      } else if (file instanceof Blob || file instanceof File) {
        const buf = await file.arrayBuffer();
        uint8Array = new Uint8Array(buf);
      } else if (typeof file === 'string') {
        const res = await fetch(file);
        const buf = await res.arrayBuffer();
        uint8Array = new Uint8Array(buf);
      } else {
        throw new Error('Unsupported book file format');
      }

      setLoadProgress(50);

      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        isEvalSupported: false,
      });

      loadingTask.onProgress = ({ loaded, total }) => {
        if (total > 0) {
          const pct = Math.min(95, Math.max(50, Math.round((loaded / total) * 100)));
          setLoadProgress(pct);
        }
      };

      // Safety timeout: abort if document parsing takes longer than 25 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Opening book timed out. The PDF file may be damaged or too large.')), 25000);
      });

      const doc = await Promise.race([loadingTask.promise, timeoutPromise]);
      setLoadProgress(100);
      setPdfDoc(doc);
      setTotalPages(doc.numPages);

      const currentBook = getBooks().find((b) => b.id === bookId);
      if (currentBook && (!currentBook.totalPages || currentBook.totalPages !== doc.numPages)) {
        updateBook(bookId, { totalPages: doc.numPages });
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading PDF document in reader:', err);
      setLoadError(err.message || 'Could not load PDF document. The file may be corrupt or encrypted.');
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // 2. Save reading progress debounce
  useEffect(() => {
    if (!user || !bookId) return;
    const t = setTimeout(() => {
      saveProgress(user.id, bookId, currentPage);
    }, 400);
    return () => clearTimeout(t);
  }, [currentPage, user, bookId]);

  // 3. Render current page on canvas + TextLayer
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore cancellation
      }
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const container = containerRef.current;
      const containerWidth = container?.clientWidth || window.innerWidth;
      const containerHeight = container?.clientHeight || window.innerHeight;
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      let currentScale = scale;
      if (fitMode === 'width') {
        const padding = containerWidth < 640 ? 12 : 32;
        const availableWidth = Math.max(260, containerWidth - padding);
        currentScale = availableWidth / unscaledViewport.width;
      } else if (fitMode === 'page') {
        const paddingH = containerHeight < 640 ? 16 : 32;
        const paddingW = containerWidth < 640 ? 12 : 32;
        const availableHeight = Math.max(300, containerHeight - paddingH);
        const scaleH = availableHeight / unscaledViewport.height;
        const availableWidth = Math.max(260, containerWidth - paddingW);
        const scaleW = availableWidth / unscaledViewport.width;
        currentScale = Math.min(scaleH, scaleW);
      }

      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: currentScale });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: false });

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      // Render Text Layer for text selection & highlighting
      if (textLayerRef.current) {
        try {
          const textLayerDiv = textLayerRef.current;
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

          const textContent = await page.getTextContent();
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
          });

          await textLayer.render();
        } catch (textErr) {
          console.warn('Text layer render notice:', textErr);
        }
      }
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  }, [pdfDoc, currentPage, scale, fitMode]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (fitMode !== 'custom') {
        renderPage();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitMode, renderPage]);

  // 4. Text Highlighting & Double Tap / Double Click handlers
  const createHighlight = useCallback(
    (textToHighlight, colorToUse = activeColor) => {
      const trimmed = textToHighlight?.trim();
      if (!trimmed || !user) return;

      const newHighlights = saveHighlight(user.id, bookId, {
        text: trimmed,
        page: currentPage,
        color: colorToUse,
      });

      setHighlights(newHighlights);
      setSelectionPopover(null);
      window.getSelection()?.removeAllRanges();
      showToast('✨ Highlight saved!');
    },
    [user, bookId, currentPage, activeColor, showToast]
  );

  const handleSelectionCheck = useCallback(
    (e, isDoubleTap = false) => {
      const sel = window.getSelection();
      const text = sel?.toString()?.trim();

      if (!text || text.length === 0) {
        setSelectionPopover(null);
        return;
      }

      // If double-tapped or double-clicked, highlight immediately!
      if (isDoubleTap) {
        createHighlight(text, activeColor);
        return;
      }

      // Otherwise show floating highlight toolbar above selection
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionPopover({
          text,
          top: Math.max(12, rect.top - 52),
          left: Math.max(12, Math.min(window.innerWidth - 220, rect.left + rect.width / 2 - 110)),
        });
      } catch {
        setSelectionPopover(null);
      }
    },
    [activeColor, createHighlight]
  );

  const handleMouseUp = (e) => {
    setTimeout(() => handleSelectionCheck(e, false), 60);
  };

  const handleDoubleClick = (e) => {
    setTimeout(() => handleSelectionCheck(e, true), 30);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches?.[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Check if horizontal swipe gesture (at least 45px, mainly horizontal, fast swipe)
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4 && deltaTime < 450) {
      if (deltaX < 0) {
        // Swipe left -> Next Page
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      } else {
        // Swipe right -> Prev Page
        setCurrentPage((p) => Math.max(1, p - 1));
      }
      return;
    }

    // Double tap handling
    const now = Date.now();
    const timeDiff = now - lastTapRef.current.time;

    if (timeDiff < 350) {
      lastTapRef.current = { time: 0, x: 0, y: 0 };
      setTimeout(() => handleSelectionCheck(e, true), 50);
    } else {
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      setTimeout(() => handleSelectionCheck(e, false), 160);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'Escape') {
        if (showHighlightsDrawer) {
          setShowHighlightsDrawer(false);
        } else if (isFullscreen) {
          document.exitFullscreen?.();
        } else {
          navigate('/app/library');
        }
      } else if (e.key === '+' || e.key === '=') {
        setScale((s) => Math.min(3.0, s + 0.15));
        setFitMode('custom');
      } else if (e.key === '-' || e.key === '_') {
        setScale((s) => Math.max(0.5, s - 0.15));
        setFitMode('custom');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages, showHighlightsDrawer, isFullscreen, navigate]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const copyHighlightText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const removeHighlight = (id) => {
    if (user?.id) {
      deleteHighlight(user.id, bookId, id);
      setHighlights(getHighlights(user.id, bookId));
      showToast('Highlight removed');
    }
  };

  const handleRepairFileUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await saveBookFile(bookId, f);
      showToast('File updated. Loading book...');
      loadDocument();
    } catch (err) {
      console.error('Failed to repair file:', err);
      showToast('Could not save file. Try again.');
    }
  };

  const pageHighlights = useMemo(
    () => highlights.filter((h) => Number(h.page) === Number(currentPage)),
    [highlights, currentPage]
  );

  return (
    <div
      style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
      className="fixed inset-0 z-50 flex h-screen w-screen flex-col overflow-hidden transition-colors duration-300"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="pointer-events-none fixed top-16 left-1/2 z-[99] -translate-x-1/2 rounded-full bg-[#009689] px-5 py-2 text-xs font-bold text-white shadow-2xl transition-all">
          {toastMessage}
        </div>
      )}

      {/* Floating 1-Tap Highlight Toolbar */}
      {selectionPopover && (
        <div
          style={{ top: `${selectionPopover.top}px`, left: `${selectionPopover.left}px` }}
          className="fixed z-50 flex items-center gap-1.5 rounded-xl border border-white/20 bg-[#12232a] p-1.5 shadow-2xl backdrop-blur-lg animate-in fade-in zoom-in-95"
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                setActiveColor(c.value);
                createHighlight(selectionPopover.text, c.value);
              }}
              title={`Highlight with ${c.name}`}
              className="h-6 w-6 rounded-full transition hover:scale-110"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <div className="mx-1 h-4 w-[1px] bg-white/20" />
          <button
            onClick={() => createHighlight(selectionPopover.text, activeColor)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#009689] px-2.5 py-1 text-xs font-bold text-white transition hover:bg-[#007268]"
          >
            <Highlighter size={13} /> Highlight
          </button>
          <button
            onClick={() => setSelectionPopover(null)}
            className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Fullscreen Reader Header with Close Arrow */}
      <header
        style={{ backgroundColor: themeConfig.navBg, borderColor: themeConfig.border }}
        className="relative z-40 flex h-13 sm:h-14 shrink-0 items-center justify-between border-b px-2.5 sm:px-5 backdrop-blur gap-2"
      >
        {/* Left: Close Arrow + Book Info */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/app/library')}
            className="group flex h-9 sm:h-10 items-center gap-1 rounded-xl bg-white/10 px-2.5 sm:px-3 text-xs sm:text-sm font-bold transition hover:bg-[#009689] hover:text-white shrink-0 active:scale-95"
            title="Close book and return to library (Escape)"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5 sm:size-[18px]" />
            <span className="hidden sm:inline">Close</span>
          </button>

          <div className="min-w-0 max-w-[110px] xs:max-w-[150px] sm:max-w-xs md:max-w-md">
            <h1 className="truncate text-xs sm:text-base font-bold leading-tight" title={book?.title || 'Reading'}>
              {book?.title || 'Reading Book'}
            </h1>
            <p className="truncate text-[10px] sm:text-[11px] opacity-60 hidden sm:block leading-tight" title={book?.author || ''}>
              {book?.author || 'Unknown author'}
            </p>
          </div>
        </div>

        {/* Center: Page Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg opacity-80 transition hover:bg-white/10 hover:opacity-100 disabled:opacity-20 active:scale-90"
            title="Previous page"
          >
            <ChevronLeft size={17} />
          </button>

          <div className="flex items-center gap-0.5 sm:gap-1 px-0.5 sm:px-1 text-xs">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 1 && val <= totalPages) {
                  setCurrentPage(val);
                }
              }}
              className="w-10 sm:w-12 rounded-lg border border-white/20 bg-white/10 py-0.5 sm:py-1 text-center font-bold text-xs outline-none focus:border-[#009689]"
            />
            <span className="opacity-40">/</span>
            <span className="font-bold opacity-80 text-xs">{totalPages}</span>
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg opacity-80 transition hover:bg-white/10 hover:opacity-100 disabled:opacity-20 active:scale-90"
            title="Next page"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        {/* Right: Theme, Highlights, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Reader Theme Switcher */}
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-0.5 sm:p-1">
            <button
              onClick={() => setReaderTheme('dark')}
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition ${
                readerTheme === 'dark' ? 'bg-[#009689] text-white' : 'opacity-60 hover:opacity-100'
              }`}
              title="Dark theme"
            >
              <Moon size={13} />
            </button>
            <button
              onClick={() => setReaderTheme('sepia')}
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition ${
                readerTheme === 'sepia' ? 'bg-[#d6a84a] text-[#0b1619]' : 'opacity-60 hover:opacity-100'
              }`}
              title="Sepia theme"
            >
              <Coffee size={13} />
            </button>
            <button
              onClick={() => setReaderTheme('light')}
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition ${
                readerTheme === 'light' ? 'bg-white text-[#0b1619]' : 'opacity-60 hover:opacity-100'
              }`}
              title="Light theme"
            >
              <Sun size={13} />
            </button>
          </div>

          {/* Highlights toggle */}
          <button
            onClick={() => setShowHighlightsDrawer((v) => !v)}
            className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition ${
              showHighlightsDrawer ? 'bg-[#d6a84a] text-[#0b1619]' : 'bg-white/5 opacity-80 hover:bg-white/10'
            }`}
            title="Toggle Highlights Drawer"
          >
            <Highlighter size={16} />
            {highlights.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#d6a84a] px-1 text-[9px] font-black text-[#0b1619]">
                {highlights.length}
              </span>
            )}
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-white/5 opacity-80 transition hover:bg-white/10 hover:opacity-100"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* Main Reading Viewport */}
      <div className="relative flex flex-1 overflow-hidden">
        <main
          ref={containerRef}
          className="relative flex flex-1 items-start justify-center overflow-auto p-2 sm:p-4"
        >
          {loading ? (
            <div className="my-auto flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-[#009689]" />
              <p className="mt-4 text-sm font-semibold">Opening book pages...</p>
              <p className="mt-1 text-xs opacity-60">Preparing razor-sharp text view ({loadProgress}%)</p>
            </div>
          ) : loadError ? (
            <div className="my-auto max-w-md rounded-3xl border border-red-500/20 bg-red-950/40 p-6 text-center text-red-200 shadow-2xl backdrop-blur">
              <BookOpen size={40} className="mx-auto mb-3 text-red-400" />
              <p className="text-base font-bold">Unable to display PDF</p>
              <p className="mt-2 text-xs opacity-80">{loadError}</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleRepairFileUpload}
                className="hidden"
              />

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => navigate('/app/library')}
                  className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
                >
                  Back to library
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2 text-xs font-bold text-white hover:bg-[#007268]"
                >
                  <RotateCcw size={14} /> Re-attach PDF file
                </button>
              </div>
            </div>
          ) : (
            <div
              className="group/page relative my-auto rounded-md bg-white transition-all"
              style={{
                boxShadow: themeConfig.pageShadow,
                filter: themeConfig.pageFilter,
              }}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDoubleClick}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Canvas Rendering of the PDF page */}
              <canvas ref={canvasRef} className="block rounded-md" />

              {/* Text Layer for Selection & Highlights */}
              <div
                ref={textLayerRef}
                className="textLayer absolute inset-0 select-text overflow-hidden rounded-md"
                style={{ zIndex: 2 }}
              />

              {/* Page Highlights Badge */}
              {pageHighlights.length > 0 && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-[#0b1619]/90 px-3 py-1 text-xs font-medium text-[#ffd24c] shadow-lg backdrop-blur">
                  <Sparkles size={13} />
                  <span>
                    {pageHighlights.length} highlight{pageHighlights.length > 1 ? 's' : ''} on this page
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quick Floating Next/Prev Side Buttons (Desktop only - mobile uses swipe gestures) */}
          {currentPage > 1 && !loading && (
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="hidden md:flex fixed left-4 top-1/2 z-30 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 p-3 text-white shadow-2xl backdrop-blur transition hover:scale-110 hover:bg-[#009689]"
              title="Previous page (Left Arrow)"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {currentPage < totalPages && !loading && (
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="hidden md:flex fixed right-4 top-1/2 z-30 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 p-3 text-white shadow-2xl backdrop-blur transition hover:scale-110 hover:bg-[#009689]"
              title="Next page (Right Arrow / Space)"
            >
              <ChevronRight size={22} />
            </button>
          )}
        </main>

        {/* Highlights Drawer Panel */}
        {showHighlightsDrawer && (
          <aside
            style={{ backgroundColor: themeConfig.navBg, borderColor: themeConfig.border }}
            className="fixed inset-y-14 right-0 z-40 flex w-full max-w-sm flex-col border-l p-5 shadow-2xl animate-in slide-in-from-right sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Highlighter className="text-[#d6a84a]" size={18} />
                <h2 className="font-bold">Book Highlights</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold">
                  {highlights.length}
                </span>
              </div>
              <button
                onClick={() => setShowHighlightsDrawer(false)}
                className="rounded-lg p-1.5 opacity-60 hover:bg-white/10 hover:opacity-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs opacity-70">
                <span className="font-bold text-[#009689]">Tip:</span> Double-tap or double-click any word or passage on the page to instantly highlight it!
              </p>

              {/* Color picker for default highlight color */}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 p-2.5">
                <span className="text-xs font-medium opacity-80">Default Color</span>
                <div className="flex items-center gap-2">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setActiveColor(c.value)}
                      className={`h-5 w-5 rounded-full transition ${
                        activeColor === c.value ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {highlights.length ? (
                highlights.map((h) => {
                  const isCurrent = Number(h.page) === Number(currentPage);
                  return (
                    <div
                      key={h.id}
                      className={`group relative rounded-2xl border p-3.5 transition ${
                        isCurrent
                          ? 'border-[#009689] bg-[#009689]/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs opacity-80">
                        <button
                          onClick={() => {
                            setCurrentPage(Number(h.page));
                          }}
                          className="font-bold text-[#009689] hover:underline"
                        >
                          Page {h.page} {isCurrent && '• Viewing now'}
                        </button>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => copyHighlightText(h.text, h.id)}
                            className="rounded p-1 hover:bg-white/10"
                            title="Copy text"
                          >
                            {copiedId === h.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                          </button>
                          <button
                            onClick={() => removeHighlight(h.id)}
                            className="rounded p-1 hover:bg-red-500/20 hover:text-red-300"
                            title="Delete highlight"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p
                        className="mt-2 rounded-lg p-2 text-xs leading-relaxed text-[#0b1619] shadow-sm"
                        style={{ backgroundColor: h.color || '#ffd24c' }}
                      >
                        {h.text}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center opacity-40">
                  <Highlighter className="mx-auto mb-2" size={32} />
                  <p className="text-sm font-bold">No highlights saved yet</p>
                  <p className="mt-1 text-xs">Double-tap or select words in the book to save favorite quotes and notes.</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Fullscreen Reader Bottom Status & Scrub Bar */}
      <footer
        style={{
          backgroundColor: themeConfig.navBg,
          borderColor: themeConfig.border,
          paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0px))',
        }}
        className="flex min-h-[2.75rem] shrink-0 items-center justify-between border-t px-3 sm:px-4 py-1.5 text-xs opacity-90"
      >
        <div className="flex items-center gap-1.5 sm:gap-2 font-medium text-[11px] sm:text-xs">
          <span>{totalPages ? Math.round((currentPage / totalPages) * 100) : 0}%</span>
          <span className="opacity-40">•</span>
          <span>p. {currentPage}/{totalPages || 1}</span>
        </div>

        <div className="flex max-w-xs sm:max-w-sm flex-1 items-center gap-2 px-2 sm:px-4">
          <input
            type="range"
            min={1}
            max={totalPages || 1}
            value={currentPage}
            onChange={(e) => setCurrentPage(Number(e.target.value))}
            aria-label="Seek page"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-[#009689] touch-manipulation"
          />
        </div>

        <div className="hidden items-center gap-3 sm:flex opacity-70 text-[11px]">
          <span>Swipe or tap arrows to turn pages</span>
        </div>
      </footer>
    </div>
  );
}
