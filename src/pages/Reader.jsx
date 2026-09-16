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
  RotateCcw,
  Pause,
  Play,
  Target,
  CheckCircle2
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
  saveBookFile,
  recordDailyReadingProgress,
  markDailyQuotaCelebrated,
  getDailyReadingStatus
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
  // Default to 'page' so the opened book always fits perfectly to the screen display
  const [fitMode, setFitMode] = useState('page');
  const [readerTheme, setReaderTheme] = useState('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSwipeReminder, setShowSwipeReminder] = useState(false);

  const [highlights, setHighlights] = useState(() => (user && bookId ? getHighlights(user.id, bookId) : []));
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [showHighlightsDrawer, setShowHighlightsDrawer] = useState(false);
  const [selectionPopover, setSelectionPopover] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Daily reading quota celebration state
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState(null);
  const [dailyStatus, setDailyStatus] = useState(() => (user && bookId ? getDailyReadingStatus(user.id, bookId) : null));

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const fileInputRef = useRef(null);
  const reminderTimeoutRef = useRef(null);

  const themeConfig = THEMES[readerTheme] || THEMES.dark;

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  }, []);

  // Exit Book Handler - saves progress, exits fullscreen, and navigates reliably
  const handleExitBook = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // 1. Immediately persist reading progress
    if (user?.id && bookId) {
      try {
        saveProgress(user.id, bookId, currentPage);
      } catch (err) {
        console.warn('Error saving progress on exit:', err);
      }
    }
    // 2. Safely exit fullscreen if currently active
    if (document.fullscreenElement) {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      } catch {
        // ignore
      }
    }
    // 3. React Router navigation
    navigate('/app/library');
    // 4. Guaranteed fallback navigation if router transition is interrupted
    setTimeout(() => {
      if (window.location.pathname.includes('/reader/')) {
        window.location.href = '/app/library';
      }
    }, 150);
  }, [user, bookId, currentPage, navigate]);

  const handlePauseTillTomorrow = () => {
    setShowQuotaModal(false);
    handleExitBook();
  };

  const handleKeepGoing = () => {
    setShowQuotaModal(false);
  };

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

  // 2b. Track daily reading quota and trigger milestone modal
  useEffect(() => {
    if (!user || !bookId || loading) return;
    const res = recordDailyReadingProgress(user.id, bookId, currentPage);
    setDailyStatus(getDailyReadingStatus(user.id, bookId));

    if (res?.shouldCelebrate) {
      setQuotaDetails({
        quota: res.quota,
        pagesReadToday: res.pagesReadToday,
      });
      setShowQuotaModal(true);
      markDailyQuotaCelebrated(user.id, bookId);
    }
  }, [currentPage, user, bookId, loading]);

  // 3. Render current page on canvas + TextLayer with perfect screen display fit
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
      
      // Calculate available container dimensions
      const containerWidth = container?.clientWidth || window.innerWidth;
      // Subtract header (~56px) and footer (~44px) + margin if clientHeight is unmeasured
      const containerHeight = (container?.clientHeight && container.clientHeight > 120)
        ? container.clientHeight
        : Math.max(300, window.innerHeight - 104);

      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // Clean padding around the page so it fits comfortably within the screen bezels
      const padX = containerWidth < 640 ? 10 : 24;
      const padY = containerHeight < 640 ? 10 : 20;

      const availableWidth = Math.max(160, containerWidth - padX * 2);
      const availableHeight = Math.max(160, containerHeight - padY * 2);

      const scaleW = availableWidth / unscaledViewport.width;
      const scaleH = availableHeight / unscaledViewport.height;

      let currentScale = scale;
      if (fitMode === 'page' || fitMode === 'fit') {
        // Fit perfectly on display: both width and height guaranteed visible without scrolling
        currentScale = Math.min(scaleW, scaleH);
      } else if (fitMode === 'width') {
        currentScale = scaleW;
      } else if (fitMode === 'height') {
        currentScale = scaleH;
      }

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
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

  // Trigger swipe reminder when book is opened
  useEffect(() => {
    if (!loading && pdfDoc && totalPages > 1) {
      setShowSwipeReminder(true);
      if (reminderTimeoutRef.current) clearTimeout(reminderTimeoutRef.current);
      reminderTimeoutRef.current = setTimeout(() => {
        setShowSwipeReminder(false);
      }, 5500);
      return () => {
        if (reminderTimeoutRef.current) clearTimeout(reminderTimeoutRef.current);
      };
    }
  }, [loading, pdfDoc, totalPages]);

  // Window resize & orientation change handler
  useEffect(() => {
    const handleResize = () => {
      if (fitMode !== 'custom') {
        renderPage();
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [fitMode, renderPage]);

  // ResizeObserver to ensure container settling always fits book perfectly
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (fitMode !== 'custom' && pdfDoc) {
        renderPage();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitMode, pdfDoc, renderPage]);

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
    if (e.target.closest('button, aside, [role="dialog"], input')) return;
    const touch = e.touches?.[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }
  };

  const handleTouchEnd = (e) => {
    if (e.target.closest('button, aside, [role="dialog"], input')) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Check if horizontal swipe gesture (at least 35px, mainly horizontal, within 500ms)
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1 && deltaTime < 500) {
      setShowSwipeReminder(false);
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
        setShowSwipeReminder(false);
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setShowSwipeReminder(false);
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'Escape') {
        if (showHighlightsDrawer) {
          setShowHighlightsDrawer(false);
        } else if (isFullscreen) {
          document.exitFullscreen?.();
        } else {
          handleExitBook();
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
  }, [totalPages, showHighlightsDrawer, isFullscreen, handleExitBook]);

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

      {/* Fullscreen Reader Header with Close / Exit Button */}
      <header
        style={{ backgroundColor: themeConfig.navBg, borderColor: themeConfig.border }}
        className="relative z-40 flex h-13 sm:h-14 shrink-0 items-center justify-between border-b px-2.5 sm:px-5 backdrop-blur gap-2"
      >
        {/* Left: Exit Button + Book Info */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleExitBook}
            className="group flex h-9 sm:h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 sm:px-3.5 text-xs sm:text-sm font-bold text-white transition hover:bg-[#009689] shrink-0 active:scale-95 cursor-pointer touch-manipulation border border-white/15"
            title="Exit book and return to library (Escape)"
            aria-label="Exit book"
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            <span>Exit</span>
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
            type="button"
            onClick={() => {
              setShowSwipeReminder(false);
              setCurrentPage((p) => Math.max(1, p - 1));
            }}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg opacity-80 transition hover:bg-white/10 hover:opacity-100 disabled:opacity-20 active:scale-90 cursor-pointer touch-manipulation"
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
                  setShowSwipeReminder(false);
                  setCurrentPage(val);
                }
              }}
              className="w-10 sm:w-12 rounded-lg border border-white/20 bg-white/10 py-0.5 sm:py-1 text-center font-bold text-xs outline-none focus:border-[#009689]"
            />
            <span className="opacity-40">/</span>
            <span className="font-bold opacity-80 text-xs">{totalPages}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowSwipeReminder(false);
              setCurrentPage((p) => Math.min(totalPages, p + 1));
            }}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg opacity-80 transition hover:bg-white/10 hover:opacity-100 disabled:opacity-20 active:scale-90 cursor-pointer touch-manipulation"
            title="Next page"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        {/* Right: Theme, Fit Mode, Highlights, Fullscreen, Exit */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Daily Reading Goal Status Pill */}
          {dailyStatus && (
            <div
              className={`hidden md:inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold border transition ${
                dailyStatus.isMet
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : 'border-white/10 bg-white/5 text-white/80'
              }`}
              title={`Today's Reading Quota: ${dailyStatus.pagesReadToday}/${dailyStatus.quota} pages read today`}
            >
              <Target size={12} className={dailyStatus.isMet ? 'text-emerald-400' : 'text-[#5fc4b8]'} />
              <span>Today: {dailyStatus.pagesReadToday}/{dailyStatus.quota}p</span>
              {dailyStatus.isMet && <Check size={11} strokeWidth={3} className="text-emerald-400" />}
            </div>
          )}

          {/* Reader Theme Switcher */}
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-0.5 sm:p-1">
            <button
              type="button"
              onClick={() => setReaderTheme('dark')}
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition cursor-pointer touch-manipulation ${
                readerTheme === 'dark' ? 'bg-[#009689] text-white' : 'opacity-60 hover:opacity-100'
              }`}
              title="Dark theme"
            >
              <Moon size={13} />
            </button>
            <button
              type="button"
              onClick={() => setReaderTheme('sepia')}
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition cursor-pointer touch-manipulation ${
                readerTheme === 'sepia' ? 'bg-[#d6a84a] text-[#0b1619]' : 'opacity-60 hover:opacity-100'
              }`}
              title="Sepia theme"
            >
              <Coffee size={13} />
            </button>
            <button
              type="button"
              onClick={() => setReaderTheme('light')}
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition cursor-pointer touch-manipulation ${
                readerTheme === 'light' ? 'bg-white text-[#0b1619]' : 'opacity-60 hover:opacity-100'
              }`}
              title="Light theme"
            >
              <Sun size={13} />
            </button>
          </div>

          {/* Fit Mode Toggle */}
          <button
            type="button"
            onClick={() => setFitMode((m) => (m === 'page' ? 'width' : 'page'))}
            className={`hidden sm:flex h-8 sm:h-9 items-center gap-1 rounded-xl px-2.5 sm:px-3 text-xs font-bold transition cursor-pointer touch-manipulation ${
              fitMode === 'page'
                ? 'bg-[#009689] text-white shadow-sm'
                : 'bg-white/5 opacity-80 hover:bg-white/10 hover:opacity-100'
            }`}
            title={fitMode === 'page' ? 'Currently fitted to display. Click to fit width.' : 'Currently fitted to width. Click to fit screen.'}
          >
            <Maximize2 size={14} />
            <span className="hidden md:inline">{fitMode === 'page' ? 'Fit Screen' : 'Fit Width'}</span>
          </button>

          {/* Highlights toggle */}
          <button
            type="button"
            onClick={() => setShowHighlightsDrawer((v) => !v)}
            className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition cursor-pointer touch-manipulation ${
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
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-white/5 opacity-80 transition hover:bg-white/10 hover:opacity-100 cursor-pointer touch-manipulation"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Quick Exit X Button */}
          <button
            type="button"
            onClick={handleExitBook}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-white/10 opacity-85 transition hover:bg-red-600/80 hover:opacity-100 hover:text-white cursor-pointer touch-manipulation"
            title="Exit book"
            aria-label="Exit book"
          >
            <X size={17} />
          </button>
        </div>
      </header>

      {/* Main Reading Viewport */}
      <div className="relative flex flex-1 overflow-hidden">
        <main
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`relative flex flex-1 items-center justify-center p-1.5 sm:p-3 select-none ${
            fitMode === 'custom' ? 'overflow-auto' : 'overflow-hidden'
          }`}
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
                  type="button"
                  onClick={handleExitBook}
                  className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 cursor-pointer"
                >
                  Back to library
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2 text-xs font-bold text-white hover:bg-[#007268] cursor-pointer"
                >
                  <RotateCcw size={14} /> Re-attach PDF file
                </button>
              </div>
            </div>
          ) : (
            <div
              className="group/page relative mx-auto my-auto flex items-center justify-center rounded-lg bg-white transition-all shadow-2xl overflow-hidden"
              style={{
                boxShadow: themeConfig.pageShadow,
                filter: themeConfig.pageFilter,
              }}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDoubleClick}
            >
              {/* Canvas Rendering of the PDF page */}
              <canvas ref={canvasRef} className="block rounded-lg" />

              {/* Text Layer for Selection & Highlights */}
              <div
                ref={textLayerRef}
                className="textLayer absolute inset-0 select-text overflow-hidden rounded-lg"
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
              type="button"
              onClick={() => {
                setShowSwipeReminder(false);
                setCurrentPage((p) => Math.max(1, p - 1));
              }}
              className="hidden md:flex fixed left-4 top-1/2 z-30 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 p-3 text-white shadow-2xl backdrop-blur transition hover:scale-110 hover:bg-[#009689] cursor-pointer"
              title="Previous page (Left Arrow)"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {currentPage < totalPages && !loading && (
            <button
              type="button"
              onClick={() => {
                setShowSwipeReminder(false);
                setCurrentPage((p) => Math.min(totalPages, p + 1));
              }}
              className="hidden md:flex fixed right-4 top-1/2 z-30 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 p-3 text-white shadow-2xl backdrop-blur transition hover:scale-110 hover:bg-[#009689] cursor-pointer"
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

      {/* Reminder when book is opened: swipe left or right to open next page */}
      {showSwipeReminder && !loading && (
        <aside
          role="status"
          aria-live="polite"
          className="pointer-events-auto fixed bottom-14 left-1/2 z-40 -translate-x-1/2 transform transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 rounded-full border border-emerald-500/40 bg-[#081316]/95 px-3.5 sm:px-5 py-2 sm:py-2.5 text-white shadow-2xl backdrop-blur-md">
            <span className="flex items-center gap-1 text-[#5fc4b8] animate-pulse">
              <ChevronLeft size={16} />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden xs:inline">Prev</span>
            </span>

            <span className="h-3.5 w-[1px] bg-white/20" />

            <span className="whitespace-nowrap text-xs sm:text-sm font-semibold">
              Swipe <span className="rounded bg-[#009689]/40 px-1.5 py-0.5 font-bold text-[#5fc4b8]">left</span> or <span className="rounded bg-[#009689]/40 px-1.5 py-0.5 font-bold text-[#5fc4b8]">right</span> to open next page
            </span>

            <span className="h-3.5 w-[1px] bg-white/20" />

            <span className="flex items-center gap-1 text-[#5fc4b8] animate-pulse">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden xs:inline">Next</span>
              <ChevronRight size={16} />
            </span>

            <button
              type="button"
              onClick={() => setShowSwipeReminder(false)}
              className="ml-1 rounded-full p-1 text-white/60 transition hover:bg-white/20 hover:text-white cursor-pointer"
              title="Dismiss reminder"
              aria-label="Dismiss reminder"
            >
              <X size={14} />
            </button>
          </div>
        </aside>
      )}

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
            onChange={(e) => {
              setShowSwipeReminder(false);
              setCurrentPage(Number(e.target.value));
            }}
            aria-label="Seek page"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-[#009689] touch-manipulation"
          />
        </div>

        <div className="flex items-center gap-2 text-[11px] opacity-75">
          <span className="flex items-center gap-1">
            <ChevronLeft size={13} className="text-[#5fc4b8]" />
            Swipe left / right to turn pages
            <ChevronRight size={13} className="text-[#5fc4b8]" />
          </span>
        </div>
      </footer>

      {/* Daily Reading Quota Met Milestone Modal */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#009689]/40 bg-white p-6 sm:p-8 text-[#0b1619] shadow-2xl dark:border-[#5fc4b8]/30 dark:bg-[#122326] dark:text-white">
            {/* Background Glow Accents */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#009689]/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />

            {/* Close Button */}
            <button
              onClick={handleKeepGoing}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-[#7b8c84] transition hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* Icon Banner */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#009689] to-[#007268] text-white shadow-lg shadow-[#009689]/30">
              <Sparkles size={30} className="animate-pulse" />
            </div>

            {/* Header & Exact User Requirement Message */}
            <div className="mt-5 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} /> Goal Achieved for Today
              </span>

              <h3 className="mt-3 text-xl sm:text-2xl font-black tracking-tight text-[#0b1619] dark:text-white">
                Daily Goal Reached! 🎉
              </h3>

              {/* Exact user-requested message */}
              <p className="mt-3.5 text-sm sm:text-base font-semibold leading-relaxed text-[#2c3e39] dark:text-white/90">
                You have met your reading requirement for today, you can pause till tomorrow or you can keep going.
              </p>

              {quotaDetails && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#e6f4f2] px-4 py-2.5 text-xs font-bold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                  <Target size={15} />
                  <span>Completed {quotaDetails.pagesReadToday} pages today (Quota: {quotaDetails.quota} pages)</span>
                </div>
              )}
            </div>

            {/* Modal Decision Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handlePauseTillTomorrow}
                className="flex-1 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-4 py-3 text-xs sm:text-sm font-bold text-[#0b1619] transition hover:bg-[#f0eee6] active:scale-[0.98] dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 cursor-pointer"
              >
                <Pause size={16} />
                <span>Pause till tomorrow</span>
              </button>

              <button
                type="button"
                onClick={handleKeepGoing}
                className="flex-1 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#009689] px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#009689]/25 transition hover:bg-[#007268] active:scale-[0.98] cursor-pointer"
              >
                <Play size={16} fill="currentColor" />
                <span>Keep going</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
