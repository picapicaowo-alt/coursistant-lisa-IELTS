import {describe, expect, it} from 'vitest';
import {fileToDataUrl, insertKindFromMime, isSafeDataUrl, mimeForEditorFile, validateEditorFile} from './media';

const png = new File(['png-bytes'], 'photo.png', {type: 'image/png'});
const pdf = new File(['%PDF'], 'brief.pdf', {type: 'application/pdf'});
const html = new File(['<script>'], 'page.html', {type: 'text/html'});

describe('editor media files', () => {
  it('accepts images and documents in the shared uploader', () => {
    expect(validateEditorFile(png)).toBeNull();
    expect(validateEditorFile(pdf)).toBeNull();
    expect(mimeForEditorFile(png)).toBe('image/png');
    expect(insertKindFromMime('image/png')).toBe('image');
    expect(insertKindFromMime('application/pdf')).toBe('file');
  });

  it('rejects oversized files', () => {
    const huge = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'big.png', {type: 'image/png'});
    expect(validateEditorFile(huge)?.localizedMessage()).toMatch(/8 MB/i);
  });

  it('blocks HTML uploads', () => {
    expect(validateEditorFile(html)?.localizedMessage()).toMatch(/image, video, PDF, Office document, ZIP, or text file/i);
  });

  it('reads a file into a typed data URL', async () => {
    const url = await fileToDataUrl(png, 'image/png');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(isSafeDataUrl(url, true)).toBe(true);
  });

  it('treats only allowlisted data URLs as safe', () => {
    expect(isSafeDataUrl('data:image/png;base64,abc', true)).toBe(true);
    expect(isSafeDataUrl('data:text/html;base64,abc', true)).toBe(false);
    expect(isSafeDataUrl('data:image/svg+xml;base64,abc', true)).toBe(false);
  });
});
