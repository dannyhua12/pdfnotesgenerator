'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import DragDropUpload from '../components/DragDropUpload';
import { getUserPDFs, deletePDF } from '@/lib/db';
import type { Database } from '@/types/supabase';
import Notification from '../components/Notification';
import DashboardLayout from '../components/DashboardLayout';

type PDF = Database['public']['Tables']['pdfs']['Row'];

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
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
    <DashboardLayout>
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />

      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Upload PDF</h2>
        <DragDropUpload onUploadSuccess={handleUploadSuccess} />
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
    </DashboardLayout>
  );
} 