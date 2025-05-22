'use client'

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import LogoutConfirmationModal from './LogoutConfirmationModal';
import { deletePDF } from '@/lib/db';

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
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success' as 'success' | 'error'
  });
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

  const loadPDFs = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('pdfs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPdfs(data || []);
    } catch (err) {
      console.error('Error loading PDFs:', err);
    } finally {
      setLoadingPDFs(false);
    }
  };

  useEffect(() => {
    loadPDFs();
  }, [user]);

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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out z-20`}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Your PDFs</h2>
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
                    <button
                      onClick={(e) => handleDeletePDF(pdf.id, e)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
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
              {showBackButton && (
                <button
                  onClick={onBackClick}
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
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                </button>
              )}
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            </div>
            <div className="flex items-center space-x-4">
              {additionalHeaderContent}
              <span className="text-gray-600">{user?.email}</span>
              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
      />

      {/* Notification */}
      {notification.show && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 z-50">
          <div className={`text-sm ${notification.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {notification.message}
          </div>
        </div>
      )}
    </div>
  );
} 