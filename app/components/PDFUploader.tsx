'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { uploadPDF, getUserPDFs } from '@/lib/db';
import type { Database } from '@/types/supabase';

type PDF = Database['public']['Tables']['pdfs']['Row'];

export default function PDFUploader() {
  const { user, loading } = useAuth();
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPDFs = useCallback(async () => {
    if (!user) return;
    try {
      const userPDFs = await getUserPDFs(user.id);
      setPdfs(userPDFs);
    } catch (err) {
      console.error('Error loading PDFs:', err);
      setError('Failed to load PDFs');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPDFs();
    }
  }, [user, loadPDFs]);

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
      await uploadPDF(file, user.id);
      await loadPDFs(); // Reload the PDFs list
      e.target.value = ''; // Reset the input
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file. Please try again.');
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
        <h2 className="text-2xl font-bold mb-4">Upload PDF</h2>
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
    </div>
  );
} 