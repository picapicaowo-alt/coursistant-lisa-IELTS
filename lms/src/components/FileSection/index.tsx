import React from 'react';
import FileUploadBox from "./FileUploadBox";
import styles from './index.module.scss';
import {FileBlock} from "./FileBlock";
import {FileView} from "@/types";

/**
 * FileSection Component
 * Displays a file upload box and a list of uploaded files
 * @param {FileView[]} files - Initial list of files to display
 * @param {(file: File, abortSignal: AbortSignal) => Promise<string>} uploadFunction - Function to handle file uploads, returns file ID
 * @param {(file: FileView) => void} onUploaded - Callback when a file upload succeeds
 */
interface FileSectionProps {
  files: FileView[];
  uploadFunction: (file: File, abortSignal: AbortSignal) => Promise<string>;
  onUploaded: (file: FileView) => void;
  onDelete?: (file: FileView) => Promise<void>;
  disabled?: boolean;
  accept?: string;
}

const fileId = (file: FileView) => String(file.id);

export const FileSection: React.FC<FileSectionProps> = ({
                                                          files,
                                                          uploadFunction,
                                                          onUploaded,
                                                          onDelete,
                                                          disabled = false,
                                                          accept,
                                                        }) => {
  const [pendingFiles, setPendingFiles] = React.useState<FileView[]>([]);
  const [deletedFileIds, setDeletedFileIds] = React.useState<Set<string>>(() => new Set());
  const pendingFilesRef = React.useRef(new Map<string | number, FileView>());

  const displayedFiles = React.useMemo(() => {
    const persistedIds = new Set(files.map(fileId));
    return [
      ...files.filter(file => !deletedFileIds.has(fileId(file))),
      ...pendingFiles.filter(file => (
        !persistedIds.has(fileId(file)) && !deletedFileIds.has(fileId(file))
      )),
    ];
  }, [deletedFileIds, files, pendingFiles]);

  React.useEffect(() => {
    const persistedIds = new Set(files.map(fileId));
    if (persistedIds.size > 0) {
      setPendingFiles(prev => {
        const next = prev.filter(file => !persistedIds.has(fileId(file)));
        return next.length === prev.length ? prev : next;
      });
    }

    setDeletedFileIds(prev => {
      const next = new Set([...prev].filter(id => persistedIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [files]);

  const deleteFile = async (file: FileView) => {
      // Failed uploads have only a browser-generated ID. Never send it to the delete API.
      const failedLocally = pendingFilesRef.current.get(file.id)?.uploadStatus === 'error';
      if (!failedLocally) {
        if (!onDelete) return;
        await onDelete(file);
      }
      const deletedId = fileId(file);
      setDeletedFileIds(prev => new Set(prev).add(deletedId));
      pendingFilesRef.current.delete(file.id);
      setPendingFiles(prev => prev.filter(pending => fileId(pending) !== deletedId));
    };
  
  /**
   * Called when a file upload starts
   * Updates the file status to 'uploading' and sets progress to 0
   */
  const onUploadStart = (file: FileView): void => {
    const pendingFile: FileView = {
      ...file,
      uploadStatus: 'uploading',
      uploadProgress: 0
    };

    pendingFilesRef.current.set(file.id, pendingFile);
    setPendingFiles(prev => [...prev, pendingFile]);
  }
  
  /**
   * Called when a file upload succeeds
   * Updates the file status to 'success', replaces temporary ID with actual file ID
   */
  const onUploadSucceed = (tempId: string, uploadedFileId: string): void => {
    const pendingFile = pendingFilesRef.current.get(tempId);
    if (!pendingFile) return;

    const uploadedFile: FileView = {
      ...pendingFile,
      id: uploadedFileId,
      uploadStatus: 'success',
      uploadProgress: 100
    };

    pendingFilesRef.current.delete(tempId);
    setPendingFiles(prev => prev.map(file => file.id === tempId ? uploadedFile : file));
    onUploaded(uploadedFile);
  }
  
  /**
   * Called when a file upload fails
   * Updates the file status to 'error' and stores the error message
   */
  const onUploadError = (tempId: string, error: Error): void => {
    const failedFile = pendingFilesRef.current.get(tempId);
    if (failedFile) {
      pendingFilesRef.current.set(tempId, {
        ...failedFile,
        uploadStatus: 'error',
        uploadError: error,
      });
    }

    setPendingFiles(prev => prev.map(file => {
      if (file.id === tempId) {
        return {
          ...file,
          uploadStatus: 'error',
          uploadError: error,
        };
      }
      return file;
    }));
  }
  
  return (
    <React.Fragment>
      {!disabled &&
        <div className={styles.uploadArea}>
          <FileUploadBox
            uploadFunction={uploadFunction}
            accept={accept}
            onUploadStart={onUploadStart}
            onUploadSucceed={onUploadSucceed}
            onUploadError={onUploadError}
          />
        </div>
      }
      
      <div className={styles.fileList}>
        {displayedFiles.map((fileBlock) => (
          <FileBlock
            key={fileBlock.id}
            block={fileBlock}
            disabled={disabled}
            onDelete={onDelete || pendingFilesRef.current.has(fileBlock.id) ? deleteFile : undefined}
          />
        ))}
      </div>
    </React.Fragment>
  );
};
