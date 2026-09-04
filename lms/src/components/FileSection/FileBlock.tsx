import React from 'react';
import {useTranslation} from 'react-i18next';
import styles from './FileBlock.module.scss';
import {FileView} from "@/types";
import {formatFileSize, getFileIcon} from "@/utils/file-utils";

/**
 * FileBlock Component
 * Displays a single file with its status, progress, and actions
 * @param {FileView} block - The file information to display
 */
interface FileBlockProps {
  block: FileView;
  disabled?: boolean;
  onDelete?: (file: FileView) => Promise<void>;
}

export const FileBlock: React.FC<FileBlockProps> = ({
                                                      block,
                                                      disabled = false,
                                                      onDelete,
                                                    }) => {
  const {t} = useTranslation("course");
  const [isDeleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  
  const ext = block.filename?.split('.').pop()?.toUpperCase() || '';
  const fileSize = formatFileSize(block.fileSize);
  const isUploading = block.uploadStatus === 'uploading';
  const isError = block.uploadStatus === 'error';
  
  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(block);
    } catch {
      setDeleteError('Could not delete this file. Please try again.');
    } finally {
      setDeleting(false);
    }
  };
  
  return (
    <div
      className={`${styles.fileBlock} ${isUploading ? styles.uploading : ''} ${isError ? styles.error : ''}`}
    >
      <img
        src={getFileIcon(ext)}
        alt={ext}
        className={styles.fileIcon}
      />
      <div className={styles.fileInfo}>
        <span className={styles.fileName}>
          {block.filename && block.filename.length > 30
            ? `${block.filename.slice(0, 30)}...`
            : block.filename}
        </span>
        <span className={styles.fileSize}>
          {fileSize}
        </span>
        {isUploading && (
          <div className={styles.uploadProgress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{width: `${block.uploadProgress || 0}%`}}
              />
            </div>
            <span className={styles.progressText}>
              {block.uploadProgress || 0}%
            </span>
          </div>
        )}
        {isError && block.errorMessage && (
          <span className={styles.errorMessage}>
            {block.errorMessage}
          </span>
        )}
      </div>
      <div className={styles.fileActions}>
        {isError && !disabled ? <span className={styles.errorMessage}>Choose the file again to retry.</span> : null}
        {!disabled && onDelete &&
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete();
            }}
            className={styles.deleteButton}
            title={isDeleting ? 'Deleting file' : t("blockEditor.deleteFileTitle")}
            aria-label={isDeleting ? `Deleting ${block.filename}` : `Delete ${block.filename}`}
            disabled={isUploading || isDeleting}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        }
      </div>
      {deleteError ? <span className={styles.deleteError} role="alert">{deleteError}</span> : null}
    </div>
  );
};
