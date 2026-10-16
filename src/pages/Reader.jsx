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
  CheckCircle2,
  Search,
  Download
} from 'lucide-react';
import {
  getBookFile,
  getCurrentUser,
  getProgress,
  getBooks,
  saveProgress,
  getHighlights,
  fetchHighlights,
  saveHighlight,
  updateHighlightColor,
  deleteHighlight,
  updateBook,
  saveBookFile,
  recordDailyReadingProgress,
  markDailyQuotaCelebrated,
  getDailyReadingStatus,
  getDailyQuotaForBook
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

function hexToRgba(hex, alpha = 0.42) {
  if (!hex || typeof hex !== 'string') return `rgba(255, 210, 76, ${alpha})`;
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return `rgba(255, 210, 76, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Accurately finds text spans and computes bounding rectangles for highlight overlays
 */
function computePageHighlightRects(textLayerDiv, pageHighlights) {
  if (!textLayerDiv || !Array.isArray(pageHighlights) || pageHighlights.length === 0) {
    return [];
  }

  const containerRect = textLayerDiv.getBoundingClientRect();
  if (containerRect.width === 0 || containerRect.height === 0) {
    return [];
  }

  // Gather text nodes and map their character offsets in fullText
  const walker = document.createTreeWalker(textLayerDiv, NodeFilter.SHOW_TEXT);
  const nodeRanges = [];
  let fullText = '';
  let currentNode;

  while ((currentNode = walker.nextNode())) {
    const text = currentNode.textContent;
    if (text) {
      const start = fullText.length;
      fullText += text;
      const end = fullText.length;
      nodeRanges.push({ node: currentNode, start, end });
    }
  }

  if (nodeRanges.length === 0 || fullText.length === 0) {
    return [];
  }

  const results = [];

  for (const h of pageHighlights) {
    if (!h.text || !h.text.trim()) continue;
    const cleanTarget = h.text.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!cleanTarget) continue;

    const escaped = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = escaped.replace(/\s+/g, '[\\s\\u00A0]*');
    const matches = [];

    try {
      const regex = new RegExp(regexPattern, 'gi');
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        matches.push({ start: match.index, end: match.index + match[0].length });
        if (matches.length >= 10) break;
      }
    } catch {
      const idx = fullText.toLowerCase().indexOf(cleanTarget);
      if (idx !== -1) {
        matches.push({ start: idx, end: idx + cleanTarget.length });
      }
    }

    // Fallback: If no match, try fuzzy matching ignoring non-alphanumeric punctuation
    if (matches.length === 0) {
      const simplifiedTarget = cleanTarget.replace(/[^a-z0-9]/g, '');
      if (simplifiedTarget.length >= 3) {
        const fuzzyPattern = simplifiedTarget
          .split('')
          .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('[^a-zA-Z0-9]*');
        try {
          const fuzzyRegex = new RegExp(fuzzyPattern, 'i');
          const fMatch = fuzzyRegex.exec(fullText);
          if (fMatch) {
            matches.push({ start: fMatch.index, end: fMatch.index + fMatch[0].length });
          }
        } catch {}
      }
    }

    const hlRects = [];

    for (const m of matches) {
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;

      for (const nr of nodeRanges) {
        if (!startNode && m.start >= nr.start && m.start <= nr.end) {
          startNode = nr.node;
          startOffset = m.start - nr.start;
        }
        if (m.end >= nr.start && m.end <= nr.end) {
          endNode = nr.node;
          endOffset = m.end - nr.start;
          break;
        }
      }

      if (startNode && endNode) {
        try {
          const range = document.createRange();
          range.setStart(startNode, Math.min(startOffset, startNode.textContent.length));
          range.setEnd(endNode, Math.min(endOffset, endNode.textContent.length));

          let clientRects = Array.from(range.getClientRects());
          if (clientRects.length === 0) {
            const bcr = range.getBoundingClientRect();
            if (bcr && bcr.width > 1 && bcr.height > 1) {
              clientRects = [bcr];
            }
          }

          for (const cr of clientRects) {
            if (cr.width > 1 && cr.height > 1) {
              hlRects.push({
                left: Math.round(cr.left - containerRect.left),
                top: Math.round(cr.top - containerRect.top),
                width: Math.round(cr.width),
                height: Math.round(cr.height),
              });
            }
          }
        } catch {
          // ignore boundary errors
        }
      }
    }

    if (hlRects.length > 0) {
      results.push({
        id: h.id,
        text: h.text,
        color: h.color || '#ffd24c',
        page: h.page,
        rects: hlRects,
      });
    }
  }

  return results;
}

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
  const [selectedHighlight, setSelectedHighlight] = useState(null);
  const [renderedHighlightRects, setRenderedHighlightRects] = useState([]);
  const [highlightSearchQuery, setHighlightSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Daily reading quota celebration state
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState(null);
  const [dailyStatus, setDailyStatus] = useState(() => (user && bookId ? getDailyReadingStatus(user.id, bookId) : null));

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const highlightsLayerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const textLayerTaskRef = useRef(null);
  const renderIdRef = useRef(0);
  const activeScaleRef = useRef(1.0);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const fileInputRef = useRef(null);
  const reminderTimeoutRef = useRef(null);

  // Synchronize highlights with cloud on book open
  useEffect(() => {
    if (!bookId) return;
    let isMounted = true;
    fetchHighlights(bookId)
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setHighlights(data);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch cloud highlights:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [bookId]);

  const themeConfig = THEMES[readerTheme] || THEMES.dark;

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  }, []);

  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const highlightsRef = useRef(highlights);
  useEffect(() => {
    highlightsRef.current = highlights;
  }, [highlights]);

  const pageHighlights = useMemo(
    () => (Array.isArray(highlights) ? highlights.filter((h) => Number(h.page) === Number(currentPage)) : []),
    [highlights, currentPage]
  );

  // Recalculate highlight overlays whenever pageHighlights or page changes
  useEffect(() => {
    if (!textLayerRef.current) return;
    const timer = setTimeout(() => {
      if (textLayerRef.current) {
        const computed = computePageHighlightRects(textLayerRef.current, pageHighlights);
        setRenderedHighlightRects(computed);
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [pageHighlights]);

  // Exit Book Handler - saves progress, exits fullscreen, and navigates reliably
  const handleExitBook = useCallback((e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    // 1. Immediately persist reading progress
    const activeUser = user || getCurrentUser();
    const pageToSave = currentPageRef.current || currentPage;
    if (activeUser?.id && bookId) {
      try {
        saveProgress(activeUser.id, bookId, pageToSave);
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
    // 3. React Router navigation back with history check & fallback
    try {
      if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        navigate('/app/library');
      }
    } catch {
      navigate('/app/library');
    }
    // Fallback ensure exit within 150ms if path hasn't changed
    setTimeout(() => {
      if (window.location.pathname.includes('/reader/')) {
        navigate('/app/library');
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

      // Ensure valid currentPage bounds
      setCurrentPage((prev) => {
        const p = Number(prev) || 1;
        if (p < 1) return 1;
        if (p > doc.numPages) return 1;
        return p;
      });

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

  // 2b. Track daily reading quota and trigger milestone modal ONLY if a reading plan was created for this book
  useEffect(() => {
    if (!user || !bookId || loading) return;
    const quota = getDailyQuotaForBook(user.id, bookId);
    if (!quota) {
      setDailyStatus(null);
      return;
    }

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

  // 3. Render current page on canvas + TextLayer with perfect screen display fit & zero-glitch double-buffering
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    const currentRenderId = ++renderIdRef.current;

    // Safely cancel and await settlement of any in-flight canvas render
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
        await renderTaskRef.current.promise;
      } catch {
        // RenderingCancelledException is expected
      }
      renderTaskRef.current = null;
    }

    // Cancel in-flight text layer render
    if (textLayerTaskRef.current) {
      try {
        textLayerTaskRef.current.cancel();
      } catch {
        // ignore cancellation
      }
      textLayerTaskRef.current = null;
    }

    if (currentRenderId !== renderIdRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      if (currentRenderId !== renderIdRef.current) return;

      const container = containerRef.current;
      
      // Calculate available container dimensions
      const containerWidth = container?.clientWidth || window.innerWidth;
      // Subtract header (~56px) and footer (~44px) + margin if clientHeight is unmeasured
      const containerHeight = (container?.clientHeight && container.clientHeight > 120)
        ? container.clientHeight
        : Math.max(300, window.innerHeight - 104);

      // Responsive padding so pages fit comfortably within any display
      const isMobile = containerWidth < 640;
      const padX = isMobile ? 2 : 12;
      const padY = isMobile ? 4 : 10;

      const availableWidth = Math.max(160, containerWidth - padX * 2);
      const availableHeight = Math.max(160, containerHeight - padY * 2);

      const unscaledViewport = page.getViewport({ scale: 1.0 });

      let scaleW = availableWidth / (unscaledViewport.width || 1);
      let scaleH = availableHeight / (unscaledViewport.height || 1);
      if (!Number.isFinite(scaleW) || scaleW <= 0) scaleW = 1.0;
      if (!Number.isFinite(scaleH) || scaleH <= 0) scaleH = 1.0;

      let currentScale = scale;
      if (fitMode === 'page' || fitMode === 'fit') {
        // Fit perfectly on display: both width and height guaranteed visible without scrolling
        currentScale = Math.min(scaleW, scaleH);
      } else if (fitMode === 'width') {
        currentScale = scaleW;
      } else if (fitMode === 'height') {
        currentScale = scaleH;
      }

      if (!Number.isFinite(currentScale) || currentScale <= 0) {
        currentScale = 1.0;
      }
      activeScaleRef.current = currentScale;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = page.getViewport({ scale: currentScale });

      // Double-buffering: render to offscreen canvas first to prevent white/black flash & flickering
      const targetWidth = Math.floor(viewport.width * pixelRatio);
      const targetHeight = Math.floor(viewport.height * pixelRatio);

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = targetWidth;
      offscreenCanvas.height = targetHeight;
      const offCtx = offscreenCanvas.getContext('2d', { alpha: false });
      offCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderContext = {
        canvasContext: offCtx,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      if (currentRenderId !== renderIdRef.current) return;

      // Copy rendered page smoothly to the visible canvas in a single instant frame
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.drawImage(offscreenCanvas, 0, 0);

      // Render Text Layer for text selection & highlighting
      if (textLayerRef.current) {
        try {
          const textLayerDiv = textLayerRef.current;
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
          textLayerDiv.style.setProperty('--total-scale-factor', `${viewport.scale}`);
          textLayerDiv.style.setProperty('--scale-factor', `${viewport.scale}`);

          const textContent = await page.getTextContent();
          if (currentRenderId !== renderIdRef.current) return;

          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
          });

          textLayerTaskRef.current = textLayer;
          await textLayer.render();

          // Immediately compute & draw highlight overlays over text
          if (currentRenderId === renderIdRef.current) {
            const curHls = (Array.isArray(highlightsRef.current) ? highlightsRef.current : []).filter(
              (h) => Number(h.page) === Number(currentPage)
            );
            const computedRects = computePageHighlightRects(textLayerDiv, curHls);
            setRenderedHighlightRects(computedRects);

            setTimeout(() => {
              if (currentRenderId === renderIdRef.current && textLayerRef.current) {
                const refreshed = computePageHighlightRects(textLayerRef.current, curHls);
                if (refreshed.length > 0 || computedRects.length === 0) {
                  setRenderedHighlightRects(refreshed);
                }
              }
            }, 60);
          }
        } catch (textErr) {
          if (textErr?.name !== 'RenderingCancelledException') {
            console.warn('Text layer render notice:', textErr);
          }
        }
      }
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    } finally {
      if (currentRenderId === renderIdRef.current) {
        renderTaskRef.current = null;
      }
    }
  }, [pdfDoc, currentPage, scale, fitMode]);

  useEffect(() => {
    if (!loading && pdfDoc) {
      renderPage();
    }
  }, [loading, pdfDoc, renderPage]);

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

  // Window resize & orientation change handler with debounce
  useEffect(() => {
    let timer = null;
    const handleResize = () => {
      if (fitMode !== 'custom') {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          renderPage();
        }, 120);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [fitMode, renderPage]);

  // ResizeObserver to ensure container settling always fits book perfectly
  useEffect(() => {
    if (!containerRef.current) return;
    let timer = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && (entry.contentRect.width === 0 || entry.contentRect.height === 0)) {
        return;
      }
      if (fitMode !== 'custom' && pdfDoc && !loading) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          renderPage();
        }, 120);
      }
    });
    observer.observe(containerRef.current);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [fitMode, pdfDoc, loading, renderPage]);

  // 4. Text Highlighting & Double Tap / Double Click handlers
  const createHighlight = useCallback(
    async (textToHighlight, colorToUse = activeColor) => {
      const trimmed = textToHighlight?.trim();
      if (!trimmed || !user || !bookId) return;

      const tempId = `hl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const optimisticItem = {
        id: tempId,
        text: trimmed,
        page: currentPage,
        color: colorToUse,
        createdAt: new Date().toISOString(),
      };

      setHighlights((prev) => [...(Array.isArray(prev) ? prev : []), optimisticItem]);
      setSelectionPopover(null);
      setSelectedHighlight(null);
      window.getSelection()?.removeAllRanges();
      showToast('✨ Highlight saved!');

      try {
        const savedList = await saveHighlight(user.id, bookId, {
          text: trimmed,
          page: currentPage,
          color: colorToUse,
        });
        if (Array.isArray(savedList)) {
          setHighlights(savedList);
        }
      } catch (err) {
        console.warn('Failed to save highlight to cloud:', err);
      }
    },
    [user, bookId, currentPage, activeColor, showToast]
  );

  const handleSelectionCheck = useCallback(
    (e, isDoubleTap = false) => {
      const sel = window.getSelection();
      const text = sel?.toString()?.trim();

      // Case 1: No active text selection - check if existing highlight clicked
      if (!text || text.length === 0) {
        setSelectionPopover(null);
        if (textLayerRef.current && e) {
          const containerRect = textLayerRef.current.getBoundingClientRect();
          const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX ?? touchStartRef.current.x;
          const clientY = e.clientY ?? e.changedTouches?.[0]?.clientY ?? touchStartRef.current.y;

          if (typeof clientX === 'number' && typeof clientY === 'number') {
            const clickX = clientX - containerRect.left;
            const clickY = clientY - containerRect.top;

            const hit = renderedHighlightRects.find((hl) =>
              hl.rects.some(
                (r) =>
                  clickX >= r.left - 4 &&
                  clickX <= r.left + r.width + 4 &&
                  clickY >= r.top - 2 &&
                  clickY <= r.top + r.height + 2
              )
            );

            if (hit) {
              setSelectedHighlight({
                id: hit.id,
                text: hit.text,
                color: hit.color,
                page: hit.page,
                x: clientX,
                y: clientY,
              });
              return;
            }
          }
        }
        setSelectedHighlight(null);
        return;
      }

      // Case 2: Active text selected
      setSelectedHighlight(null);

      // If double-tapped or double-clicked, highlight immediately!
      if (isDoubleTap) {
        createHighlight(text, activeColor);
        return;
      }

      // Ensure selection is inside the PDF textLayer (not header/inputs/drawer)
      if (textLayerRef.current && !textLayerRef.current.contains(sel.anchorNode)) {
        setSelectionPopover(null);
        return;
      }

      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setSelectionPopover(null);
          return;
        }

        const top = rect.top > 65 ? rect.top - 54 : rect.bottom + 8;
        const left = Math.max(12, Math.min(window.innerWidth - 240, rect.left + rect.width / 2 - 120));

        setSelectionPopover({
          text,
          top,
          left,
        });
      } catch {
        setSelectionPopover(null);
      }
    },
    [activeColor, createHighlight, renderedHighlightRects]
  );

  const handleMouseUp = (e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    setTimeout(() => handleSelectionCheck({ clientX, clientY }, false), 60);
  };

  const handleDoubleClick = (e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    setTimeout(() => handleSelectionCheck({ clientX, clientY }, true), 40);
  };

  const handleTouchStart = (e) => {
    if (e.target.closest('button, aside, [role="dialog"], input, header, footer')) return;
    const touch = e.touches?.[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }
  };

  const handleTouchEnd = (e) => {
    if (e.target.closest('button, aside, [role="dialog"], input, header, footer')) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const touchEventData = {
      clientX: touch.clientX,
      clientY: touch.clientY,
    };

    // If active text selection exists, DO NOT navigate or turn page!
    const activeText = window.getSelection()?.toString()?.trim();
    if (activeText && activeText.length > 0) {
      setTimeout(() => handleSelectionCheck(touchEventData, false), 50);
      return;
    }

    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Ignore gestures starting near the left or right edges (to allow native phone navigation swipe)
    if (startX < 32 || (window.innerWidth && startX > window.innerWidth - 32)) return;

    // Check if horizontal swipe gesture (at least 35px, mainly horizontal, within 500ms)
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && deltaTime < 500) {
      setShowSwipeReminder(false);
      setSelectionPopover(null);
      setSelectedHighlight(null);
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
      setTimeout(() => handleSelectionCheck(touchEventData, true), 60);
    } else {
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      setTimeout(() => handleSelectionCheck(touchEventData, false), 150);
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
        setFitMode('custom');
        setScale((s) => Number((Math.min(3.0, (activeScaleRef.current || s || 1.0) + 0.15)).toFixed(2)));
      } else if (e.key === '-' || e.key === '_') {
        setFitMode('custom');
        setScale((s) => Number((Math.max(0.4, (activeScaleRef.current || s || 1.0) - 0.15)).toFixed(2)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages, showHighlightsDrawer, isFullscreen, handleExitBook]);

  // Synchronize fullscreen state with document changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Save progress and clean up on browser/mobile back button (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const activeUser = user || getCurrentUser();
      const pageToSave = currentPageRef.current || currentPage;
      if (activeUser?.id && bookId) {
        try {
          saveProgress(activeUser.id, bookId, pageToSave);
        } catch (_err) {
          // ignore save error on popstate
        }
      }
      if (document.fullscreenElement) {
        try {
          document.exitFullscreen?.().catch(() => {});
        } catch (_err) {
          // ignore fullscreen error on popstate
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, bookId, currentPage]);

  // Save progress on component unmount
  useEffect(() => {
    return () => {
      const activeUser = getCurrentUser();
      const pageToSave = currentPageRef.current;
      if (activeUser?.id && bookId && pageToSave) {
        saveProgress(activeUser.id, bookId, pageToSave);
      }
    };
  }, [bookId]);

  // Save progress on tab close, reload, or pagehide
  useEffect(() => {
    const handleUnload = () => {
      const activeUser = getCurrentUser();
      const pageToSave = currentPageRef.current;
      if (activeUser?.id && bookId && pageToSave) {
        saveProgress(activeUser.id, bookId, pageToSave);
      }
    };
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [bookId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const copyHighlightText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const removeHighlight = async (id) => {
    if (!user?.id || !bookId) return;
    setHighlights((prev) => (Array.isArray(prev) ? prev.filter((h) => h.id !== id) : []));
    setSelectedHighlight(null);
    showToast('Highlight removed');
    try {
      await deleteHighlight(user.id, bookId, id);
    } catch (err) {
      console.warn('Failed to delete highlight:', err);
    }
  };

  const changeHighlightColor = async (id, newColor) => {
    if (!user || !bookId) return;
    setHighlights((prev) =>
      (Array.isArray(prev) ? prev : []).map((h) => (h.id === id ? { ...h, color: newColor } : h))
    );
    setSelectedHighlight((prev) => (prev ? { ...prev, color: newColor } : null));
    showToast('Highlight color updated');
    try {
      await updateHighlightColor(user.id, bookId, id, newColor);
    } catch (err) {
      console.warn('Failed to update highlight color:', err);
    }
  };

  const handleExportNotes = useCallback(() => {
    if (!highlights.length) return;
    const bookTitle = book?.title || 'Book';
    let md = `# Highlights & Notes: ${bookTitle}\n`;
    if (book?.author) md += `*Author: ${book.author}*\n`;
    md += `*Exported on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

    const sorted = [...highlights].sort((a, b) => Number(a.page) - Number(b.page));
    sorted.forEach((h) => {
      md += `> "${h.text}"\n\n— **Page ${h.page}**\n\n`;
    });

    navigator.clipboard.writeText(md);
    showToast('📋 Highlights copied as Markdown notes!');
  }, [highlights, book, showToast]);

  const handleDownloadNotes = useCallback(() => {
    if (!highlights.length) return;
    const bookTitle = book?.title || 'Book';
    let md = `# Highlights & Notes: ${bookTitle}\n`;
    if (book?.author) md += `*Author: ${book.author}*\n`;
    md += `*Exported on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

    const sorted = [...highlights].sort((a, b) => Number(a.page) - Number(b.page));
    sorted.forEach((h) => {
      md += `> "${h.text}"\n\n— **Page ${h.page}**\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(bookTitle || 'highlights').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Notes downloaded as Markdown!');
  }, [highlights, book, showToast]);

  const handleJumpToHighlight = useCallback(
    (h) => {
      setCurrentPage(Number(h.page));
      setShowSwipeReminder(false);
      // If already on this page, highlight it visually
      if (Number(h.page) === Number(currentPage)) {
        const matching = renderedHighlightRects.find((r) => r.id === h.id);
        if (matching && matching.rects[0]) {
          const containerRect = textLayerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setSelectedHighlight({
              id: h.id,
              text: h.text,
              color: h.color,
              page: h.page,
              x: containerRect.left + matching.rects[0].left + matching.rects[0].width / 2,
              y: containerRect.top + matching.rects[0].top,
            });
          }
        }
      }
    },
    [currentPage, renderedHighlightRects]
  );

  const filteredHighlights = useMemo(() => {
    if (!Array.isArray(highlights)) return [];
    let list = highlights;
    if (highlightSearchQuery.trim()) {
      const q = highlightSearchQuery.toLowerCase();
      list = list.filter(
        (h) => (h.text && h.text.toLowerCase().includes(q)) || String(h.page).includes(q)
      );
    }
    return list;
  }, [highlights, highlightSearchQuery]);

  const handleRepairFileUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      // 1. Immediately cache in IndexedDB/memory
      await saveBookFile(bookId, f);
      showToast('File updated. Loading book...');

      // 2. Sync to server disk storage in background
      try {
        const formData = new FormData();
        formData.append('file', f);
        const token = localStorage.getItem('reedshelf_token_v1') || '';
        await fetch(`/api/books/${bookId}/file`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
      } catch (syncErr) {
        console.warn('Could not sync repaired file to server disk:', syncErr);
      }

      loadDocument();
    } catch (err) {
      console.error('Failed to repair file:', err);
      showToast('Could not save file. Try again.');
    }
  };

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

      {/* Floating 1-Tap Highlight Toolbar (for newly selected text) */}
      {selectionPopover && (
        <div
          style={{ top: `${selectionPopover.top}px`, left: `${selectionPopover.left}px` }}
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.stopPropagation()}
          className="fixed z-50 flex items-center gap-1.5 rounded-xl border border-white/20 bg-[#12232a] p-1.5 shadow-2xl backdrop-blur-lg animate-in fade-in zoom-in-95"
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveColor(c.value);
                createHighlight(selectionPopover.text, c.value);
              }}
              title={`Highlight with ${c.name}`}
              className="h-6 w-6 rounded-full transition hover:scale-110 active:scale-95 cursor-pointer"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <div className="mx-1 h-4 w-[1px] bg-white/20" />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => createHighlight(selectionPopover.text, activeColor)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#009689] px-2.5 py-1 text-xs font-bold text-white transition hover:bg-[#007268] active:scale-95 cursor-pointer"
          >
            <Highlighter size={13} /> Highlight
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              navigator.clipboard.writeText(selectionPopover.text);
              showToast('Copied to clipboard');
              setSelectionPopover(null);
            }}
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white cursor-pointer"
            title="Copy selected text"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setSelectionPopover(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Floating Toolbar for Clicked Existing Highlight */}
      {selectedHighlight && (
        <div
          style={{
            top: `${Math.max(12, Math.min(window.innerHeight - 70, selectedHighlight.y - 54))}px`,
            left: `${Math.max(12, Math.min(window.innerWidth - 260, selectedHighlight.x - 120))}px`,
          }}
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.stopPropagation()}
          className="fixed z-50 flex items-center gap-1.5 rounded-xl border border-white/20 bg-[#12232a] p-1.5 shadow-2xl backdrop-blur-lg animate-in fade-in zoom-in-95"
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changeHighlightColor(selectedHighlight.id, c.value)}
              title={`Change color to ${c.name}`}
              className={`h-6 w-6 rounded-full transition hover:scale-110 active:scale-95 cursor-pointer ${
                selectedHighlight.color === c.value ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <div className="mx-1 h-4 w-[1px] bg-white/20" />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              copyHighlightText(selectedHighlight.text, selectedHighlight.id);
            }}
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white cursor-pointer"
            title="Copy quote"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => removeHighlight(selectedHighlight.id)}
            className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-500/20 hover:text-red-300 cursor-pointer"
            title="Delete highlight"
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSelectedHighlight(null)}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white cursor-pointer"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Fullscreen Reader Header with Close / Exit Button */}
      <header
        style={{
          backgroundColor: themeConfig.navBg,
          borderColor: themeConfig.border,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'max(0.625rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.625rem, env(safe-area-inset-right, 0px))',
        }}
        className="relative z-40 flex min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] shrink-0 items-center justify-between border-b px-2.5 sm:px-5 backdrop-blur gap-2"
      >
        {/* Left: Exit Button + Book Info */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleExitBook}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleExitBook(e);
            }}
            className="group flex h-9 sm:h-10 items-center gap-1.5 rounded-xl bg-[#009689] px-3 sm:px-3.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-[#007268] shrink-0 active:scale-95 cursor-pointer touch-manipulation border border-[#009689] z-50 pointer-events-auto"
            title="Back to library (Escape)"
            aria-label="Back to library"
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            <span>Back</span>
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
          {/* Daily Reading Goal Status Pill (ONLY if a reading plan was created for this book) */}
          {dailyStatus && dailyStatus.quota && (
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
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleExitBook(e);
            }}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-black/10 dark:bg-white/10 opacity-90 transition hover:bg-red-600 hover:text-white cursor-pointer touch-manipulation z-50 pointer-events-auto"
            title="Exit book and return to library"
            aria-label="Exit book"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Reading Viewport */}
      <div className="relative flex flex-1 overflow-hidden">
        <main
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative flex flex-1 overflow-auto p-0 sm:p-1 select-none"
        >
          {loading ? (
            <div className="m-auto flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-[#009689]" />
              <p className="mt-4 text-sm font-semibold">Opening book pages...</p>
              <p className="mt-1 text-xs opacity-60">Preparing razor-sharp text view ({loadProgress}%)</p>
            </div>
          ) : loadError ? (
            <div className="m-auto max-w-md rounded-3xl border border-red-500/20 bg-red-950/40 p-6 text-center text-red-200 shadow-2xl backdrop-blur">
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
              className="group/page relative m-auto flex items-center justify-center rounded-lg bg-white transition-all shadow-2xl overflow-hidden"
              style={{
                boxShadow: themeConfig.pageShadow,
                filter: themeConfig.pageFilter,
              }}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDoubleClick}
            >
              {/* Canvas Rendering of the PDF page */}
              <canvas ref={canvasRef} className="block rounded-lg" />

              {/* Visual Highlight Overlays Layer */}
              <div
                ref={highlightsLayerRef}
                className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
                style={{ zIndex: 1 }}
              >
                {renderedHighlightRects.map((hl) => (
                  <div key={hl.id} className="contents">
                    {hl.rects.map((rect, idx) => (
                      <div
                        key={`${hl.id}-${idx}`}
                        className="absolute transition-all hover:brightness-95 pointer-events-auto cursor-pointer"
                        style={{
                          left: `${rect.left}px`,
                          top: `${rect.top}px`,
                          width: `${rect.width}px`,
                          height: `${rect.height}px`,
                          backgroundColor: hexToRgba(hl.color, 0.42),
                          borderBottom: `2.5px solid ${hl.color}`,
                          borderRadius: '2px',
                          mixBlendMode: 'multiply',
                        }}
                        title="Click to manage highlight"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHighlight({
                            id: hl.id,
                            text: hl.text,
                            color: hl.color,
                            page: hl.page,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Text Layer for Selection & Highlights */}
              <div
                ref={textLayerRef}
                className="textLayer absolute inset-0 select-text overflow-hidden rounded-lg"
                style={{ zIndex: 2 }}
              />

              {/* Page Highlights Badge */}
              {pageHighlights.length > 0 && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-[#0b1619]/90 px-3 py-1 text-xs font-medium text-[#ffd24c] shadow-lg backdrop-blur pointer-events-none">
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
                <span className="font-bold text-[#009689]">Tip:</span> Double-tap or select any passage on the page to instantly highlight it!
              </p>

              {/* Color picker for default highlight color */}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 p-2.5">
                <span className="text-xs font-medium opacity-80">Default Color</span>
                <div className="flex items-center gap-2">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setActiveColor(c.value)}
                      className={`h-5 w-5 rounded-full transition cursor-pointer ${
                        activeColor === c.value ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Search filter for highlights */}
              {highlights.length > 0 && (
                <div className="relative mt-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search highlights & quotes..."
                    value={highlightSearchQuery}
                    onChange={(e) => setHighlightSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pl-8 pr-8 text-xs text-white placeholder-white/40 outline-none focus:border-[#009689]"
                  />
                  {highlightSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHighlightSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Quick Actions: Export & Download Notes */}
              {highlights.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportNotes}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-1.5 px-2 text-[11px] font-bold opacity-80 hover:bg-white/10 hover:opacity-100 transition active:scale-95 cursor-pointer"
                    title="Copy all highlights formatted as Markdown notes"
                  >
                    <Copy size={12} />
                    <span>Copy Notes</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadNotes}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-1.5 px-2.5 text-[11px] font-bold opacity-80 hover:bg-white/10 hover:opacity-100 transition active:scale-95 cursor-pointer"
                    title="Download highlights as Markdown (.md)"
                  >
                    <Download size={12} />
                    <span>.md</span>
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {filteredHighlights.length ? (
                filteredHighlights.map((h) => {
                  const isCurrent = Number(h.page) === Number(currentPage);
                  return (
                    <div
                      key={h.id}
                      className={`group relative rounded-2xl border p-3.5 transition ${
                        isCurrent
                          ? 'border-[#009689] bg-[#009689]/10 shadow-sm'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs opacity-80">
                        <button
                          type="button"
                          onClick={() => handleJumpToHighlight(h)}
                          className="font-bold text-[#009689] hover:underline cursor-pointer"
                          title="Jump to this page in book"
                        >
                          Page {h.page} {isCurrent && '• Viewing now'}
                        </button>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          {/* Color Switcher */}
                          <div className="hidden sm:flex items-center gap-1 mr-1">
                            {HIGHLIGHT_COLORS.map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => changeHighlightColor(h.id, c.value)}
                                className={`h-3.5 w-3.5 rounded-full transition hover:scale-125 cursor-pointer ${
                                  (h.color || '#ffd24c') === c.value ? 'ring-1 ring-white scale-110' : 'opacity-60'
                                }`}
                                style={{ backgroundColor: c.value }}
                                title={`Change to ${c.name}`}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyHighlightText(h.text, h.id)}
                            className="rounded p-1 hover:bg-white/10 cursor-pointer"
                            title="Copy text"
                          >
                            {copiedId === h.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHighlight(h.id)}
                            className="rounded p-1 text-red-400 hover:bg-red-500/20 hover:text-red-300 cursor-pointer"
                            title="Delete highlight"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p
                        onClick={() => handleJumpToHighlight(h)}
                        className="mt-2 rounded-lg p-2 text-xs leading-relaxed text-[#0b1619] shadow-xs cursor-pointer transition hover:opacity-95"
                        style={{ backgroundColor: h.color || '#ffd24c' }}
                        title="Click to jump to page"
                      >
                        {h.text}
                      </p>
                    </div>
                  );
                })
              ) : highlightSearchQuery ? (
                <div className="py-12 text-center opacity-50">
                  <Search className="mx-auto mb-2" size={24} />
                  <p className="text-xs font-bold">No highlights matching &ldquo;{highlightSearchQuery}&rdquo;</p>
                  <button
                    type="button"
                    onClick={() => setHighlightSearchQuery('')}
                    className="mt-2 text-[11px] font-bold text-[#009689] underline cursor-pointer"
                  >
                    Clear search filter
                  </button>
                </div>
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
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        }}
        className="flex min-h-[calc(2.75rem+env(safe-area-inset-bottom,0px))] shrink-0 items-center justify-between border-t px-3 sm:px-4 py-1.5 text-xs opacity-90"
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

      {/* Daily Reading Quota Met Milestone Modal (ONLY if user created a reading plan for this book) */}
      {showQuotaModal && quotaDetails?.quota && (
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
