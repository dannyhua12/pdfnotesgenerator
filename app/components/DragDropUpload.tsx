'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { uploadPDF } from '@/lib/db';

interface DragDropUploadProps {
  onUploadSuccess: (pdfId: string) => void;
  onClose?: () => void;
}

export default function DragDropUpload({ onUploadSuccess, onClose }: DragDropUploadProps) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (!user) return;

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
      setError('Please upload PDF files only');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      setStatus('Uploading PDF...');
      for (const file of pdfFiles) {
        const pdfId = await uploadPDF(file, user.id);
        setStatus('Generating notes...');
        // Wait for notes generation to complete
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulated delay
        onUploadSuccess(pdfId);
      }
    } catch (err) {
      console.error('Error uploading:', err);
      setError('Failed to upload PDF');
      setStatus('');
    } finally {
      setUploading(false);
    }
  }, [user, onUploadSuccess]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files) return;

    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
      setError('Please upload PDF files only');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      setStatus('Uploading PDF...');
      for (const file of pdfFiles) {
        const pdfId = await uploadPDF(file, user.id);
        setStatus('Generating notes...');
        // Wait for notes generation to complete
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulated delay
        onUploadSuccess(pdfId);
      }
      e.target.value = ''; // Reset input
    } catch (err) {
      console.error('Error uploading:', err);
      setError('Failed to upload PDF');
      setStatus('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex justify-end mb-4">
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        )}
      </div>
      <div
        className={`relative border-2 border-dashed rounded-lg p-12 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          multiple
        />
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M24 38c8.837 0 16-3.582 16-8V14M24 6c-8.837 0-16 3.582-16 8m16-8c8.837 0 16 3.582 16 8m0 0v6m-16-6c-8.837 0-16 3.582-16 8m32 6l-3.172 3.172a4 4 0 01-5.656 0L28 28m0 0l-4 4m4-4h6m-6 0v6"
            />
          </svg>
          <p className="mt-4 text-sm text-gray-600">
            Drag and drop your PDF here, or click to select
          </p>
          <p className="mt-2 text-xs text-gray-500">PDF files only</p>
        </div>
        {(uploading || status) && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center">
            <p className="text-blue-600">{status || 'Processing...'}</p>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
} 