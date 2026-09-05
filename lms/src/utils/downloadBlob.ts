import {ApiResponseDataError} from '@/apis/types/common';
const PREVIEWABLE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']);

export const isPreviewableFile = (filename?: string, contentType?: string): boolean => {
  const extension = filename?.split('.').pop()?.toLowerCase() ?? '';
  const normalizedType = contentType?.toLowerCase() ?? '';
  return PREVIEWABLE_EXTENSIONS.has(extension)
    || normalizedType === 'application/pdf'
    || normalizedType.startsWith('image/');
};

/**
 * A file endpoint must return actual bytes, not a successful JSON error page.
 * Keeping this check in one place prevents every Preview/Download surface from
 * silently saving an error response as a document.
 */
export const assertFileBlob = (blob: Blob): Blob => {
  const contentType = blob.type.toLowerCase();
  if (blob.size === 0 || contentType.includes('application/json') || contentType.includes('text/html')) {
    throw new ApiResponseDataError('The file endpoint did not return usable file bytes.');
  }
  return blob;
};

export const saveBlob = (blob: Blob, filename: string): void => {
  assertFileBlob(blob);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  // Safari can cancel the transfer when the object URL is revoked in the
  // same task as the synthetic click. Keep both the anchor and object URL
  // alive long enough for every supported browser to begin reading it.
  window.setTimeout(() => anchor.remove(), 1_000);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const openPreviewWindow = (): Window | null => {
  // Opening must happen synchronously inside the click handler; otherwise
  // browsers treat the eventual window as an unsolicited pop-up.
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) return null;

  previewWindow.opener = null;
  previewWindow.document.title = 'Loading preview…';
  previewWindow.document.body.textContent = 'Loading preview…';
  return previewWindow;
};

export const showBlobInPreviewWindow = (previewWindow: Window, blob: Blob): void => {
  assertFileBlob(blob);
  const url = URL.createObjectURL(blob);
  previewWindow.location.replace(url);
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
};
