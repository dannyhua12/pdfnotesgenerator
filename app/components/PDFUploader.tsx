'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { uploadPDF, getUserPDFs } from '@/lib/db';
import type { Database } from '@/types/supabase';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Notification from './Notification';

type PDF = Database['public']['Tables']['pdfs']['Row'];

interface PDFUploaderProps {
  onUploadSuccess?: () => void;
  onClose?: () => void;
}

export default function PDFUploader({ onUploadSuccess, onClose }: PDFUploaderProps) {
  const { user, loading } = useAuth();
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
    show: boolean;
  }>({
    message: '',
    type: 'success',
    show: false
  });
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadPDFs();
    }
  }, [user]);

  const loadPDFs = async () => {
    if (!user) return;
    try {
      const userPDFs = await getUserPDFs(user.id);
      setPdfs(userPDFs);
    } catch (err) {
      console.error('Error loading PDFs:', err);
      setError('Failed to load PDFs');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    if (!file.type.includes('pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
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

      await loadPDFs(); // Reload the PDFs list
      e.target.value = ''; // Reset the input

      // Call onUploadSuccess callback if provided
      if (onUploadSuccess) {
        onUploadSuccess();
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
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please sign in to upload PDFs</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Upload PDF</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="border rounded p-2"
          />
          {uploading && <span>Uploading...</span>}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Your PDFs</h2>
        {pdfs.length === 0 ? (
          <p>No PDFs uploaded yet</p>
        ) : (
          <div className="grid gap-4">
            {pdfs.map((pdf) => (
              <div
                key={pdf.id}
                className="border rounded p-4 flex justify-between items-center"
              >
                <div>
                  <h3 className="font-semibold">{pdf.file_name}</h3>
                  <p className="text-sm text-gray-500">
                    Uploaded: {new Date(pdf.created_at).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={pdf.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  View PDF
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
} 