import {ChevronLeft, ChevronRight, RotateCcw} from 'lucide-react';
import {usePdfMaterialPreview} from './usePdfMaterialPreview';
import styles from './PdfMaterialPreview.module.scss';

interface PdfMaterialPreviewProps {
  blob: Blob;
  title: string;
  onRetry: () => Promise<unknown>;
}

/** Render protected PDF bytes locally; browser PDF plugins may show an empty iframe. */
export default function PdfMaterialPreview({blob, title, onRetry}: PdfMaterialPreviewProps) {
  const {
    canvas, viewport, pageNumber, setPageNumber, pageCount,
    zoom, setZoom, loading, error, pageText, retry,
  } = usePdfMaterialPreview(blob, onRetry);

  return (
    <section className={styles.document} aria-label={`${title} PDF preview`}>
      <div className={styles.toolbar}>
        <nav aria-label="PDF pages">
          <button
            type="button"
            aria-label="Previous PDF page"
            disabled={!pageCount || pageNumber <= 1}
            onClick={() => setPageNumber(page => page - 1)}
          >
            <ChevronLeft size={18}/>
          </button>
          <span aria-live="polite">Page {pageNumber} of {pageCount ?? '…'}</span>
          <button
            type="button"
            aria-label="Next PDF page"
            disabled={!pageCount || pageNumber >= pageCount}
            onClick={() => setPageNumber(page => page + 1)}
          >
            <ChevronRight size={18}/>
          </button>
        </nav>
        <label>
          Zoom
          <select value={zoom} onChange={event => setZoom(Number(event.target.value))}>
            <option value={1}>Fit width</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
        </label>
      </div>
      <div ref={viewport} className={styles.viewport} aria-busy={loading}>
        {loading ? <p role="status">Loading PDF page…</p> : null}
        {error ? (
          <p role="alert">
            {error}{' '}
            <button type="button" onClick={() => void retry()}>
              <RotateCcw size={16}/>Retry PDF
            </button>
          </p>
        ) : null}
        <canvas
          ref={canvas}
          hidden={Boolean(error)}
          data-rendered={!loading && !error}
          aria-hidden={loading || Boolean(error)}
          role="img"
          aria-label={`Page ${pageNumber} of ${title}`}
        />
        <p className={styles.pageText}>{pageText}</p>
      </div>
    </section>
  );
}
