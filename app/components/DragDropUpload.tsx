'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { uploadPDF } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import Notification from './Notification';

interface DragDropUploadProps {
  onUploadSuccess: (pdfId: string) => void;
  onClose?: () => void;
}

export default function DragDropUpload({ onUploadSuccess, onClose }: DragDropUploadProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
    show: boolean;
  }>({
    message: '',
    type: 'success',
    show: false
  });

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      setNotification({
        message: 'Please upload a PDF file',
        type: 'error',
        show: true
      });
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const supabase = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pdfs')
        .getPublicUrl(fileName);

      // Create PDF record in database
      const { data: pdfData, error: dbError } = await supabase
        .from('pdfs')
        .insert([
          {
            name: file.name,
            file_url: publicUrl,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      setNotification({
        message: 'PDF uploaded successfully!',
        type: 'success',
        show: true
      });

      if (onUploadSuccess) {
        onUploadSuccess(pdfData.id);
      }

      if (onClose) {
        onClose();
      }

      // Redirect to the PDF page
      router.push(`/dashboard/${pdfData.id}`);
    } catch (err) {
      console.error('Error uploading PDF:', err);
      setError('Failed to upload PDF');
      setNotification({
        message: 'Failed to upload PDF',
        type: 'error',
        show: true
      });
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess, onClose, router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  return (
    <div className="w-full max-w-3xl mx-auto">
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

      <button
        onClick={onClose}
        className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        disabled={uploading}
      >
        Cancel
      </button>

      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
} 