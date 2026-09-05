// noinspection DuplicatedCode

import {describe, it, expect, vi, beforeEach} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import {FileBlock} from './FileBlock';
import {FileView} from '@/types';
import i18n from '@/i18n';
import type {TOptions} from 'i18next';

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({
    t: (key: string, options?: TOptions) => {
      const translations: Record<string, string> = {
        'blockEditor.retryUploadTitle': 'Retry',
        'blockEditor.deleteFileTitle': 'Delete file'
      };
      return translations[key] || i18n.t(key, {...options, ns: 'course'});
    }
  })
}));

vi.mock('@/utils/file-utils', async importOriginal => ({
  ...await importOriginal<typeof import('@/utils/file-utils')>(),
  getFileIcon: (ext: string) => `/icons/${ext.toLowerCase()}.png`,
}));

describe('FileBlock', () => {
  const baseFile: FileView = {
    id: '1',
    filename: 'test-file.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    updatedAt: '2024-01-01T00:00:00.000Z'
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Basic Rendering', () => {
    it('renders file information correctly', () => {
      render(<FileBlock block={baseFile}/>);
      
      expect(screen.getByText(/test-file.pdf/)).toBeInTheDocument();
      expect(screen.getByText('1 KB')).toBeInTheDocument();
    });
    
    it('shows file icon with correct attributes', () => {
      render(<FileBlock block={baseFile}/>);
      
      const fileIcon = screen.getByAltText('PDF');
      expect(fileIcon).toBeInTheDocument();
      expect(fileIcon).toHaveAttribute('src', '/icons/pdf.png');
    });
    
    it('handles long filenames with truncation', () => {
      const longNameFile: FileView = {
        ...baseFile,
        filename: 'very-long-filename-that-should-be-truncated-after-thirty-characters.pdf'
      };
      
      render(<FileBlock block={longNameFile}/>);
      
      // The text might be split across elements or fully truncated
      expect(screen.getByText(/very-long-filename-that-should/)).toBeInTheDocument();
      // Check for the ellipsis in the rendered filename
      const fileNameElement = screen.getByText(/very-long-filename-that-should/);
      expect(fileNameElement.textContent).toMatch(/\.\.\.$/);
    });
  });
  
  describe('Upload Status Display', () => {
    it('displays uploading status with progress bar', () => {
      const uploadingFile: FileView = {
        ...baseFile,
        uploadStatus: 'uploading',
        uploadProgress: 50
      };
      
      render(<FileBlock block={uploadingFile}/>);
      
      expect(screen.getByText(/test-file.pdf/)).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument(); // Progress percentage is shown
    });
    
    it('displays error status with error message', () => {
      const errorFile: FileView = {
        ...baseFile,
        uploadStatus: 'error',
        errorMessage: 'Upload failed: Network error'
      };
      
      render(<FileBlock block={errorFile}/>);
      
      expect(screen.getByText(/test-file.pdf/)).toBeInTheDocument();
      expect(screen.getByText(i18n.t('common:files.uploadFailed'))).toBeInTheDocument();
      expect(screen.queryByText(/Upload failed: Network error/)).not.toBeInTheDocument();
    });
    
    it('displays success status without error message', () => {
      const successFile: FileView = {
        ...baseFile,
        uploadStatus: 'success'
      };
      
      render(<FileBlock block={successFile}/>);
      
      expect(screen.getByText(/test-file.pdf/)).toBeInTheDocument();
      expect(screen.queryByText(/failed|error/i)).not.toBeInTheDocument();
    });
    
    it('displays 0% progress when uploadProgress is undefined', () => {
      const uploadingFile: FileView = {
        ...baseFile,
        uploadStatus: 'uploading'
      };
      
      render(<FileBlock block={uploadingFile}/>);
      
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
    
    it('displays custom progress value when provided', () => {
      const uploadingFile: FileView = {
        ...baseFile,
        uploadStatus: 'uploading',
        uploadProgress: 75
      };
      
      const {container} = render(<FileBlock block={uploadingFile}/>);
      
      expect(screen.getByText('75%')).toBeInTheDocument();
      const progressFill = container.querySelector('[style*="width"]');
      expect(progressFill).not.toBeNull();
      expect(progressFill).toHaveStyle({width: '75%'});
    });
    
    it('does not show error message when uploadStatus is not error', () => {
      const successFile: FileView = {
        ...baseFile,
        uploadStatus: 'success',
        errorMessage: 'This should not show'
      };
      
      render(<FileBlock block={successFile}/>);
      
      expect(screen.queryByText(/This should not show/)).not.toBeInTheDocument();
    });
  });
  
  describe('Action Buttons', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);

    it('explains the supported retry action after an upload error', () => {
      const errorFile: FileView = {
        ...baseFile,
        uploadStatus: 'error',
        errorMessage: 'Upload failed'
      };
      
      render(<FileBlock block={errorFile}/>);
      
      expect(screen.getByText('Choose the file again to retry.')).toBeInTheDocument();
      expect(screen.queryByTitle('Retry')).not.toBeInTheDocument();
    });
    
    it('hides retry button when not in error state', () => {
      const successFile: FileView = {
        ...baseFile,
        uploadStatus: 'success'
      };
      
      render(<FileBlock block={successFile}/>);
      
      expect(screen.queryByTitle('Retry')).not.toBeInTheDocument();
    });
    
    it('disables delete button when uploading', () => {
      const uploadingFile: FileView = {
        ...baseFile,
        uploadStatus: 'uploading',
        uploadProgress: 30
      };
      
      render(<FileBlock block={uploadingFile} onDelete={onDelete}/>);
      
      const deleteButton = screen.getByTitle('Delete file');
      expect(deleteButton).toBeDisabled();
    });
    
    it('enables delete button when not uploading', () => {
      const successFile: FileView = {
        ...baseFile,
        uploadStatus: 'success'
      };
      
      render(<FileBlock block={successFile} onDelete={onDelete}/>);
      
      const deleteButton = screen.getByTitle('Delete file');
      expect(deleteButton).not.toBeDisabled();
    });
    
    it('handles delete button click', async () => {
      const successFile: FileView = {
        ...baseFile,
        uploadStatus: 'success'
      };
      
      render(<FileBlock block={successFile} onDelete={onDelete}/>);
      
      fireEvent.click(screen.getByTitle('Delete file'));

      await waitFor(() => expect(onDelete).toHaveBeenCalledWith(successFile));
    });
  });
});
