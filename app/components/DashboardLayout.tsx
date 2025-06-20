'use client'

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import LogoutConfirmationModal from './LogoutConfirmationModal';

type PDF = Database['public']['Tables']['pdfs']['Row'];

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  additionalHeaderContent?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title = 'PDF Notes Generator',
  showBackButton = false,
  onBackClick,
  additionalHeaderContent
}: DashboardLayoutProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [loadingPDFs, setLoadingPDFs] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pdfToDelete, setPdfToDelete] = useState<PDF | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen]);

  const loadPDFs = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('pdfs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Handle unauthorized error
        if (error.message === 'Unauthorized - No valid session') {
          router.push('/');
          return;
        }
        
        throw error;
      }
      setPdfs(data || []);
    } catch (err) {
      // Handle unauthorized error in catch block as well
      if (err instanceof Error && err.message.includes('Unauthorized')) {
        router.push('/');
        return;
      }
    } finally {
      setLoadingPDFs(false);
    }
  }, [user, router]);

  useEffect(() => {
    loadPDFs();
  }, [user, loadPDFs]);

  const handleDeleteConfirm = async () => {
    if (!pdfToDelete) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('pdfs')
        .remove([`uploads/${pdfToDelete.file_name}`]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('pdfs')
        .delete()
        .eq('id', pdfToDelete.id);

      if (dbError) throw dbError;

      // Update local state
      setPdfs(pdfs.filter(pdf => pdf.id !== pdfToDelete.id));
    } catch (error) {
      console.error('Error deleting PDF:', error);
    } finally {
      setIsDeleteModalOpen(false);
      setPdfToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 w-72 bg-white/80 backdrop-blur-md shadow-lg transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out z-20 border-r border-gray-200`}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Your PDFs</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 custom-scrollbar">
            {loadingPDFs ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : pdfs.length === 0 ? (
              <div className="text-center p-8 bg-gray-50 rounded-xl">
                <p className="text-gray-500">No PDFs uploaded yet</p>
              </div>
            ) : (
              pdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border border-gray-100"
                  onClick={() => {
                    router.push(`/${pdf.id}`);
                    setSidebarOpen(false);
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {pdf.file_name}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {new Date(pdf.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="min-h-screen">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-10 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
              {showBackButton && (
                <button
                  onClick={onBackClick}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                </button>
              )}
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{title}</h1>
            </div>
            <div className="flex items-center space-x-4">
              {additionalHeaderContent}
              <span className="text-gray-600">{user?.email}</span>
              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!showBackButton ? (
            // Dashboard view
            <>
              <div className="mb-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Your PDFs</h2>
                  <button
                    onClick={() => router.push('/upload')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:-translate-y-0.5"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
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
                    Upload New PDF
                  </button>
                </div>
              </div>

              {loadingPDFs ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : pdfs.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No PDFs</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by uploading a new PDF.</p>
                  <div className="mt-6">
                    <button
                      onClick={() => router.push('/upload')}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
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
                      Upload PDF
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {pdfs.map((pdf) => (
                    <div
                      key={pdf.id}
                      className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border border-gray-100"
                      onClick={() => {
                        router.push(`/${pdf.id}`);
                        setSidebarOpen(false);
                      }}
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                              {pdf.file_name}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              {new Date(pdf.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Other pages (upload, PDF notes, etc.)
            <div className="max-w-4xl mx-auto">
              {children}
            </div>
          )}
        </main>
      </div>

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && pdfToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl transform transition-all duration-300">
            <h3 className="text-lg font-semibold mb-4">Delete PDF</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete &quot;{pdfToDelete.file_name}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setPdfToDelete(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 