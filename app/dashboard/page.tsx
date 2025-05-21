'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import DragDropUpload from '../components/DragDropUpload';
import { getUserPDFs, deletePDF } from '@/lib/db';
import type { Database } from '@/types/supabase';
import Notification from '../components/Notification';

type PDF = Database['public']['Tables']['pdfs']['Row'];

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [loadingPDFs, setLoadingPDFs] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success' as 'success' | 'error'
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

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
    } finally {
      setLoadingPDFs(false);
    }
  };

  const handleUploadSuccess = (pdfId: string) => {
    loadPDFs();
    setShowUploadModal(false);
    router.push(`/dashboard/${pdfId}`);
    setNotification({
      show: true,
      message: 'Notes generated successfully!',
      type: 'success'
    });
  };

  const handleDeletePDF = async (pdfId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when clicking delete
    if (!user) return;

    if (!window.confirm('Are you sure you want to delete this PDF?')) {
      return;
    }

    try {
      await deletePDF(pdfId, user.id);
      await loadPDFs();
      setNotification({
        show: true,
        message: 'PDF deleted successfully',
        type: 'success'
      });
    } catch (err) {
      console.error('Error deleting PDF:', err);
      setNotification({
        show: true,
        message: 'Failed to delete PDF',
        type: 'error'
      });
    }
  };

  // Only show loading state when initially checking auth
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out z-20`}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Your PDFs</h2>
            <button
              onClick={() => setShowUploadModal(true)}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
          <div className="space-y-2">
            {loadingPDFs ? (
              <p className="text-gray-500">Loading...</p>
            ) : pdfs.length === 0 ? (
              <p className="text-gray-500">No PDFs uploaded yet</p>
            ) : (
              pdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="group p-3 rounded-lg cursor-pointer transition-colors bg-gray-50 hover:bg-gray-100 relative"
                  onClick={() => router.push(`/dashboard/${pdf.id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{pdf.file_name}</h3>
                      <p className="text-xs text-gray-500">
                        {new Date(pdf.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="relative">
                      <div className="relative">
                        <button
                          className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            const menu = e.currentTarget.nextElementSibling as HTMLElement;
                            if (menu) {
                              menu.classList.toggle('hidden');
                            }
                          }}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                            />
                          </svg>
                        </button>
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden">
                          <button
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDeletePDF(pdf.id, e)}
                          >
                            Delete PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="min-h-screen">
        {/* Header */}
        <header className="bg-white shadow relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">PDF Notes Generator</h1>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Log Out
            </button>
          </div>
        </header>

        {/* Main content area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Upload PDF</h2>
            <DragDropUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        </main>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Upload New PDF</h2>
              <button
                onClick={() => setShowUploadModal(false)}
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
            </div>
            <DragDropUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        </div>
      )}
    </div>
  );
} 