import React from 'react';
import {LocalizedError} from '@/i18n/errors';
import {useTranslation} from "react-i18next";
import styles from './FileUploadBox.module.scss';
import {v4} from "uuid";
import {FileView} from "@/types";
import {Upload} from 'lucide-react';

/**
 * FileUploadBox Component
 * Provides a drag-and-drop area for file uploads
 * @param {(fileInfo: FileView) => void} [onUploadStart] - Callback when upload starts
 * @param {(taskId: string, uploadedFileId: string) => void} [onUploadSucceed] - Callback when upload succeeds
 * @param {(taskId: string, error: Error) => void} [onUploadError] - Callback when upload fails
 * @param {(file: File, abortSignal: AbortSignal) => Promise<string>} uploadFunction - Function to handle file uploads, returns file ID
 */
interface FileUploadBoxProps {
  onUploadStart?: (fileInfo: FileView) => void;
  onUploadSucceed?: (taskId: string, uploadedFileId: string) => void;
  onUploadError?: (taskId: string, error: Error) => void;
  uploadFunction: (file: File, abortSignal: AbortSignal) => Promise<string>;
  accept?: string;
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({
                                                       onUploadStart,
                                                       onUploadSucceed,
                                                       onUploadError,
                                                       uploadFunction,
                                                       accept,
                                                     }) => {
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const {t} = useTranslation("course");
  
  React.useEffect(() => {
    abortControllerRef.current = new AbortController();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };
  
  const handleChooseClick = () => {
    fileInputRef.current?.click();
  };

  const handleChooseKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleChooseClick();
    }
  };
  
  const handleFiles = (files: FileList) => {
    if (files.length === 0) return;
    const file = files[0];
    const id = `tmp-${v4()}`;
    
    const fileInfo: FileView = {
      id,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      updatedAt: new Date().toISOString(),
      uploadStatus: 'uploading'
    };
    
    if (onUploadStart) onUploadStart(fileInfo);
    
    const controller = abortControllerRef.current ?? new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;
    uploadFunction(file, signal)
      .then((uploadedFileId) => {
        if (onUploadSucceed) onUploadSucceed(id, uploadedFileId);
      })
      .catch((reason: unknown) => {
        const error = reason instanceof Error ? reason : new LocalizedError('common:files.uploadFailed');
        if (onUploadError) onUploadError(id, error);
      });
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };
  const getUploadAreaClass = () => {
    const baseClass = styles.uploadArea;
    return isDragging ? `${baseClass} ${styles.uploadAreaDragging}` : baseClass;
  };
  
  return (
    <div>
      <div
        className={getUploadAreaClass()}
        role="button"
        tabIndex={0}
        onClick={handleChooseClick}
        onKeyDown={handleChooseKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.uploadAreaContent}>
          <Upload
            className={styles.uploadIcon}
            aria-hidden="true"
          />
          <p className={styles.promptText}>
            {t("fileUploadBox.prompt")}{" "}
            <span className={styles.chooseLink}>
              {t("fileUploadBox.choose")}
            </span>{" "}
            {t("fileUploadBox.toUpload")}
          </p>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          className={styles.fileInput}
          multiple={false}
          accept={accept}
          onChange={handleFileInputChange}
        />
      </div>
    </div>
  );
};

export default FileUploadBox;
