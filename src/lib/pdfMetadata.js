import * as pdfjsLib from 'pdfjs-dist';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';

// 1. In-memory fallback worker ensures parsing NEVER fails even if Web Worker is blocked
if (typeof window !== 'undefined') {
  window.pdfjsWorker = pdfjsWorker;
}

// 2. Set worker URL for multi-threaded worker offloading
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
}

/**
 * Format a filename into a clean book title fallback
 */
export function formatFilenameToTitle(filename) {
  if (!filename) return 'Untitled Book';
  let clean = filename.replace(/\.[^/.]+$/, '');
  clean = clean.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || 'Untitled Book';
}

/**
 * Extract title, author, totalPages, and cover thumbnail from a PDF File or Blob
 * @param {File | Blob | ArrayBuffer | Uint8Array} fileOrBuffer
 * @param {string} [originalFileName]
 * @returns {Promise<{ title: string, author: string, totalPages: number, coverDataUrl: string | null }>}
 */
export async function extractPdfInfo(fileOrBuffer, originalFileName = '') {
  let uint8Array;
  if (fileOrBuffer instanceof Uint8Array) {
    uint8Array = fileOrBuffer;
  } else if (fileOrBuffer instanceof ArrayBuffer) {
    uint8Array = new Uint8Array(fileOrBuffer);
  } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function') {
    const buf = await fileOrBuffer.arrayBuffer();
    uint8Array = new Uint8Array(buf);
  } else if (fileOrBuffer instanceof Blob) {
    const buf = await new Response(fileOrBuffer).arrayBuffer();
    uint8Array = new Uint8Array(buf);
  } else {
    throw new Error('Invalid PDF file provided');
  }

  const fileName = originalFileName || (fileOrBuffer instanceof File ? fileOrBuffer.name : '');
  const fallbackTitle = formatFilenameToTitle(fileName);

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages || 1;

    let title = '';
    let author = '';

    // 1. Try reading PDF metadata
    try {
      const meta = await pdfDoc.getMetadata();
      const info = meta?.info || {};

      if (info.Title && typeof info.Title === 'string') {
        const rawTitle = info.Title.trim();
        if (
          rawTitle &&
          !rawTitle.toLowerCase().startsWith('microsoft word') &&
          !rawTitle.toLowerCase().startsWith('untitled') &&
          rawTitle.length > 1
        ) {
          title = rawTitle;
        }
      }

      if (info.Author && typeof info.Author === 'string') {
        const rawAuthor = info.Author.trim();
        if (
          rawAuthor &&
          rawAuthor.length > 1 &&
          !/^(admin|user|owner|author|unknown|anonymous|scan|scanner)$/i.test(rawAuthor)
        ) {
          author = rawAuthor;
        }
      }
    } catch (metaErr) {
      console.warn('Could not extract PDF info metadata:', metaErr);
    }

    if (!title) {
      title = fallbackTitle;
    }
    if (!author) {
      author = 'Unknown author';
    }

    // 2. Render Page 1 to generate original book cover
    let coverDataUrl = null;
    try {
      const page1 = await pdfDoc.getPage(1);
      const unscaledViewport = page1.getViewport({ scale: 1.0 });
      const targetWidth = 600;
      const scale = Math.min(2.0, Math.max(0.8, targetWidth / unscaledViewport.width));
      const viewport = page1.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page1.render(renderContext).promise;
      coverDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    } catch (renderErr) {
      console.warn('Could not render PDF cover thumbnail:', renderErr);
    }

    return {
      title,
      author,
      totalPages,
      coverDataUrl,
    };
  } catch (err) {
    console.error('Error processing PDF metadata:', err);
    return {
      title: fallbackTitle,
      author: 'Unknown author',
      totalPages: 1,
      coverDataUrl: null,
    };
  }
}
