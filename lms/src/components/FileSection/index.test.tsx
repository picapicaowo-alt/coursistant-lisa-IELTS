// noinspection DuplicatedCode

import React from 'react';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {act} from 'react-dom/test-utils';
import '@testing-library/jest-dom';
import {FileSection} from './index';
import {FileView} from '@/types';
import {
  createMockUploadFunction,
  createMockOnUploaded,
  createInitialFiles,
  createTestFile,
  simulateFileInputChange
} from './test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'fileUploadBox.prompt': 'Drag and drop files here or',
        'fileUploadBox.choose': 'choose',
        'fileUploadBox.toUpload': 'to upload'
      };
      return translations[key] || key;
    }
  })
}));

describe('FileSection', () => {
  let mockUploadFunction: ReturnType<typeof createMockUploadFunction>;
  let mockOnUploaded: ReturnType<typeof createMockOnUploaded>;
  let initialFiles: FileView[];
  
  beforeEach(() => {
    mockUploadFunction = createMockUploadFunction();
    mockOnUploaded = createMockOnUploaded();
    initialFiles = createInitialFiles();
    vi.clearAllMocks();
  });
  
  describe('Initial Rendering', () => {
    it('renders FileUploadBox and file list with initial files', () => {
      render(
        <FileSection
          files={initialFiles}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
        />
      );
      
      expect(screen.getByText(/test-file.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/1 KB/)).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /drag and drop/i})).toBeInTheDocument();
    });
    
    it('displays file list with existing files', () => {
      render(
        <FileSection
          files={initialFiles}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
        />
      );
      
      expect(screen.getByText(/test-file.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/1 KB/)).toBeInTheDocument();
    });
    
    it('renders empty state when no files', () => {
      render(
        <FileSection
          files={[]}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
        />
      );
      
      expect(screen.getByRole('button', {name: /drag and drop/i})).toBeInTheDocument();
      expect(screen.queryByText(/test-file.pdf/)).not.toBeInTheDocument();
    });
    
    it('displays multiple files correctly', () => {
      const multipleFiles: FileView[] = [
        {
          id: '1',
          filename: 'file1.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          updatedAt: '2024-01-01T00:00:00.000Z',
          uploadStatus: 'success'
        },
        {
          id: '2',
          filename: 'file2.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileSize: 2048,
          updatedAt: '2024-01-02T00:00:00.000Z',
          uploadStatus: 'success'
        }
      ];
      
      render(
        <FileSection
          files={multipleFiles}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
        />
      );
      
      expect(screen.getByText(/file1.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/file2.docx/)).toBeInTheDocument();
    });

    it('deletes a persisted file through the provided callback', async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      render(
        <FileSection
          files={initialFiles}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
          onDelete={onDelete}
        />
      );

      fireEvent.click(screen.getByRole('button', {name: 'Delete test-file.pdf'}));

      await waitFor(() => expect(onDelete).toHaveBeenCalledWith(initialFiles[0]));
      expect(screen.queryByText(/test-file.pdf/)).not.toBeInTheDocument();
    });
  });
  
  describe('File Upload Process', () => {
    it('handles file upload start', async () => {
      const mockFile = createTestFile();
      mockUploadFunction.mockResolvedValue('uploaded-file-id');
      
      const {container} = render(
        <FileSection
          files={[]}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
        />
      );
      
      // Wait for components to fully initialize
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate file selection
      const input = await simulateFileInputChange(container, mockFile);
      
      await act(async () => {
        fireEvent.change(input);
      });
      
      await waitFor(() => {
        expect(mockUploadFunction).toHaveBeenCalledWith(mockFile, expect.any(Object));
      });
    });
    
    it('updates file status to uploading when upload starts', async () => {
      const mockFile = createTestFile();
      mockUploadFunction.mockImplementation(() => new Promise(() => {
      })); // Never resolves
      
      const {container} = render(
        <FileSection
          files={[]}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
        />
      );
      
      // Wait for components to fully initialize
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate file selection
      const input = await simulateFileInputChange(container, mockFile);
      
      await act(async () => {
        fireEvent.change(input);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/test.pdf/)).toBeInTheDocument();
        expect(screen.getByText('0%')).toBeInTheDocument(); // Shows uploading status
      });
    });
    
    it('handles successful upload', async () => {
      const mockFile = createTestFile();
      mockUploadFunction.mockResolvedValue('uploaded-file-id');
      
      const {container} = render(
        <FileSection
          files={[]}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
        />
      );
      
      // Wait for components to fully initialize
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate file selection
      const input = await simulateFileInputChange(container, mockFile);
      
      await act(async () => {
        fireEvent.change(input);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('0%')).not.toBeInTheDocument(); // Progress bar disappears
        expect(screen.getByText(/test.pdf/)).toBeInTheDocument();
      });
    });
    
    it('handles upload error', async () => {
      const mockFile = createTestFile();
      const error = new Error('Upload failed');
      mockUploadFunction.mockRejectedValue(error);
      
      const {container} = render(
        <FileSection
          files={[]}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
        />
      );
      
      // Wait for components to fully initialize
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate file selection
      const input = await simulateFileInputChange(container, mockFile);
      
      await act(async () => {
        fireEvent.change(input);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
      });
    });
    
    it('removes failed temporary uploads locally without deleting a server file', async () => {
      const onDelete = vi.fn();
      mockUploadFunction.mockRejectedValue(new Error('Upload failed'));
      const {container} = render(<FileSection files={[]} uploadFunction={mockUploadFunction} onUploaded={mockOnUploaded} onDelete={onDelete}/>);
      const input = await simulateFileInputChange(container, createTestFile());
      fireEvent.change(input);
      await screen.findByText('Upload failed');
      fireEvent.click(screen.getByRole('button', {name: 'Delete test.pdf'}));
      await waitFor(() => expect(screen.queryByText('Upload failed')).not.toBeInTheDocument());
      expect(onDelete).not.toHaveBeenCalled();
      expect(mockOnUploaded).not.toHaveBeenCalled();
    });

    it('calls onUploaded callback with correct data on successful upload', async () => {
      const mockFile = createTestFile();
      mockUploadFunction.mockResolvedValue('uploaded-file-id');
      
      const {container} = render(
        <FileSection
          files={[]}
          uploadFunction={mockUploadFunction}
          onUploaded={mockOnUploaded}
        />
      );
      
      // Wait for components to fully initialize
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate file selection
      const input = await simulateFileInputChange(container, mockFile);
      
      await act(async () => {
        fireEvent.change(input);
      });
      
      // Wait for the upload process to complete
      await waitFor(() => {
        expect(mockOnUploaded).toHaveBeenCalled();
      }, {timeout: 10000});
      
      // Check the exact call
      expect(mockOnUploaded).toHaveBeenCalledWith(expect.objectContaining({
        id: 'uploaded-file-id',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 7,
        uploadStatus: 'success',
        uploadProgress: 100
      }));
    });

    it('does not duplicate an uploaded file when the API changes its ID from string to number', async () => {
      const mockFile = createTestFile();
      mockUploadFunction.mockResolvedValue('42');

      const Harness = () => {
        const [files, setFiles] = React.useState<FileView[]>([]);
        return (
          <FileSection
            files={files}
            uploadFunction={mockUploadFunction}
            onUploaded={(file) => setFiles([{...file, id: Number(file.id)}])}
          />
        );
      };

      const {container} = render(<Harness/>);
      const input = await simulateFileInputChange(container, mockFile);
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getAllByText(/test.pdf/)).toHaveLength(1);
      });
    });
  });
});
