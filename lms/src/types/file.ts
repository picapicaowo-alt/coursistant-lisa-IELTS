export type FileUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

// Represents file data from the server (DTO)
export interface FileDto {
  id: string | number;
  filename: string;
  mimeType: string;
  fileSize: number;
  /** API payloads are ISO-8601 strings; older view models may already parse them. */
  updatedAt: string | Date;
}

// Extends FileDto with UI-specific fields for upload status
export interface FileView extends FileDto {
  uploadStatus?: FileUploadStatus;
  uploadProgress?: number;
  errorMessage?: string;
  /** Retain error identity so frontend-generated feedback follows locale changes. */
  uploadError?: unknown;
}
