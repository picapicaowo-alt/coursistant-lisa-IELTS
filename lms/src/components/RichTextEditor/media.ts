import {LocalizedError} from '@/i18n/errors';

export type MediaInsertKind = 'image' | 'video' | 'file';

export const MAX_EDITOR_FILE_BYTES = 8 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg']);
const FILE_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'zip',
  'txt',
  'csv',
]);

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/ogg']);
const FILE_MIME = new Set([
  ...IMAGE_MIME,
  ...VIDEO_MIME,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
]);

export const SAFE_MEDIA_DATA_MIME = new Set([...IMAGE_MIME, ...VIDEO_MIME]);
export const SAFE_FILE_DATA_MIME = new Set([...FILE_MIME]);

export const MEDIA_INSERT_COPY = {
  title: 'editor:media.title',
  accept: [
    'image/png,image/jpeg,image/gif,image/webp',
    'video/mp4,video/webm,video/ogg',
    '.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.ogg',
    '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.csv',
  ].join(','),
  chooseLabel: 'editor:media.choose',
  chooseHint: 'editor:media.chooseHint',
  dropLabel: 'editor:media.drop',
  dropHint: 'editor:media.dropHint',
  typeError: 'editor:media.typeError',
};

export const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
};

const inferredMime = (file: File): string | null => {
  const type = file.type.toLowerCase();
  if (FILE_MIME.has(type)) return type === 'image/jpg' ? 'image/jpeg' : type;
  const extension = extensionOf(file.name);
  if (!FILE_EXTENSIONS.has(extension)) return null;
  if (IMAGE_EXTENSIONS.has(extension)) return extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
  if (VIDEO_EXTENSIONS.has(extension)) return `video/${extension}`;
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'zip') return 'application/zip';
  if (extension === 'txt') return 'text/plain';
  if (extension === 'csv') return 'text/csv';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (extension === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (extension === 'doc') return 'application/msword';
  if (extension === 'ppt') return 'application/vnd.ms-powerpoint';
  if (extension === 'xls') return 'application/vnd.ms-excel';
  return null;
};

export const insertKindFromMime = (mime: string): MediaInsertKind => {
  const normalized = mime.toLowerCase();
  if (IMAGE_MIME.has(normalized)) return 'image';
  if (VIDEO_MIME.has(normalized)) return 'video';
  return 'file';
};

export const validateEditorFile = (file: File): LocalizedError | null => {
  if (file.size > MAX_EDITOR_FILE_BYTES) {
    return new LocalizedError('editor:media.sizeError', {size: MAX_EDITOR_FILE_BYTES / (1024 * 1024)});
  }
  return inferredMime(file) ? null : new LocalizedError(MEDIA_INSERT_COPY.typeError);
};

export const mimeForEditorFile = (file: File): string | null => inferredMime(file);

export const isSafeDataUrl = (value: string, mediaOnly = false): boolean => {
  if (!value.startsWith('data:')) return false;
  const comma = value.indexOf(',');
  if (comma < 0) return false;
  const header = value.slice(5, comma);
  const [mime, ...params] = header.split(';');
  if (!params.includes('base64')) return false;
  const allowed = mediaOnly ? SAFE_MEDIA_DATA_MIME : SAFE_FILE_DATA_MIME;
  return allowed.has(mime.trim().toLowerCase());
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};

export const fileToDataUrl = async (file: File, mime: string): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
};
