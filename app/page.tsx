'use client'

import { useState, useCallback, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateNotes = useCallback(async (filename: string) => {
    setIsGeneratingNotes(true);
    try {
      const response = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate notes' }));
        throw new Error(errorData.error || 'Failed to generate notes');
      }

      const data = await response.json();
      setNotes(data.notes);
      setUploadStatus('Notes generated successfully!');
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : 'Failed to generate notes');
    } finally {
      setIsGeneratingNotes(false);
    }
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Uploading...');
    setNotes(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadStatus('Upload successful! Generating notes...');
      
      await generateNotes(data.filename);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [generateNotes, setIsUploading, setUploadStatus, setNotes]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      handleFileUpload(file);
    } else {
      setUploadStatus('Please upload a PDF file');
    }
  }, [handleFileUpload]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleBoxClick = () => {
    if (!isUploading && !isGeneratingNotes && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-black">PDF Notes Generator</h1>
        <div className="flex flex-col items-center gap-4 w-full">
          <div
            onClick={handleBoxClick}
            className={`w-full h-[300px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'}
              ${isUploading || isGeneratingNotes ? 'opacity-50 cursor-not-allowed' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileInput}
              disabled={isUploading || isGeneratingNotes}
            />
            <div className="flex flex-col items-center gap-4">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="48" 
                height="48" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-gray-400"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-700">Drag and drop your PDF here</p>
                <p className="text-sm text-gray-500 mt-2">or</p>
                <p className="text-lg font-semibold text-blue-600 mt-2">Click to browse files</p>
              </div>
            </div>
          </div>
          {uploadStatus && (
            <p className={`text-sm ${uploadStatus.includes('successful') ? 'text-green-600' : 'text-red-600'}`}>
              {uploadStatus}
            </p>
          )}
          {isGeneratingNotes && (
            <div className="flex items-center gap-2 text-blue-600">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating notes...
            </div>
          )}
          {notes && (
            <div className="w-full mt-8 p-6 bg-white rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Generated Notes</h2>
              <div className="prose max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {notes}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
