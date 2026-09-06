import {useEffect, useRef, useState} from 'react';
import type {PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Own the PDF worker and canvas lifecycle while the material viewer is mounted. */
export function usePdfMaterialPreview(blob: Blob, onRetry: () => Promise<unknown>) {
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageText, setPageText] = useState('');
  const [attempt, setAttempt] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderTask = useRef<RenderTask>();

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    setDocument(undefined);
    setLoading(true);
    setError('');
    setPageNumber(1);
    setPageText('');
    void (async () => {
      try {
        const [pdfjs, data] = await Promise.all([import('pdfjs-dist'), blob.arrayBuffer()]);
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        task = pdfjs.getDocument({data, useSystemFonts: true, isEvalSupported: false});
        const next = await task.promise;
        if (!cancelled) setDocument(next);
      } catch {
        if (!cancelled) {
          setError("course:pdf.openFailed");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTask.current?.cancel();
      void task?.destroy();
    };
  }, [blob, attempt]);

  useEffect(() => {
    viewport.current?.scrollTo({top: 0, left: 0});
  }, [document, pageNumber]);

  useEffect(() => {
    if (!document || width <= 0 || !canvas.current) return;
    let cancelled = false;
    const element = canvas.current;
    setLoading(true);
    setError('');
    setPageText('');
    void (async () => {
      try {
        // A resize or fast page change must finish cancelling before reusing the canvas.
        const previous = renderTask.current;
        previous?.cancel();
        await previous?.promise.catch(() => undefined);
        if (cancelled) return;
        const page = await document.getPage(pageNumber);
        if (cancelled) return;
        const scale = width / page.getViewport({scale: 1}).width * zoom;
        const pageViewport = page.getViewport({scale});
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        element.width = Math.ceil(pageViewport.width * ratio);
        element.height = Math.ceil(pageViewport.height * ratio);
        element.style.width = `${pageViewport.width}px`;
        element.style.height = `${pageViewport.height}px`;
        const context = element.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        const task = page.render({canvasContext: context, viewport: pageViewport, transform: [ratio, 0, 0, ratio, 0, 0]});
        renderTask.current = task;
        await task.promise;
        const content = await page.getTextContent();
        if (!cancelled) {
          setPageText(content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' '));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("course:pdf.pageFailed");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTask.current?.cancel();
    };
  }, [document, pageNumber, width, zoom]);

  const retry = async () => {
    setLoading(true);
    setError('');
    try {
      // Refresh protected bytes too; re-parsing a corrupt cached file cannot recover.
      await onRetry();
      setAttempt(value => value + 1);
    } catch {
      setError("course:pdf.reloadFailed");
      setLoading(false);
    }
  };

  return {
    canvas, viewport, pageNumber, setPageNumber, pageCount: document?.numPages,
    zoom, setZoom, loading, errorKey: error, pageText, retry,
  };
}
