'use client'

import { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import Notification from '@/app/components/Notification';
import DashboardLayout from '@/app/components/DashboardLayout';

type PDF = Database['public']['Tables']['pdfs']['Row'];
type PageParams = { pdfId: string };

export default function PDFNotesPage({ params }: { params: Promise<PageParams> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pdf, setPdf] = useState<PDF | null>(null);
  const [loadingPDF, setLoadingPDF] = useState(true);
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success' as 'success' | 'error'
  });
  const [generationProgress, setGenerationProgress] = useState(0);

  // Unwrap params using React.use()
  const unwrappedParams = use(params) as PageParams;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPDF = async () => {
      if (!user) return;
      try {
        // First verify the PDF exists
        const { data: pdfData, error: pdfError } = await supabase
          .from('pdfs')
          .select('*')
          .eq('id', unwrappedParams.pdfId)
          .single();

        if (pdfError) {
          console.error('Error fetching PDF:', {
            error: pdfError,
            code: pdfError.code,
            message: pdfError.message,
            details: pdfError.details
          });
          setNotification({
            show: true,
            message: 'PDF not found or access denied',
            type: 'error'
          });
          router.push('/dashboard');
          return;
        }

        // Then verify ownership
        if (pdfData.user_id !== user.id) {
          console.error('Unauthorized access attempt:', {
            pdfId: unwrappedParams.pdfId,
            userId: user.id,
            ownerId: pdfData.user_id
          });
          setNotification({
            show: true,
            message: 'You do not have permission to view this PDF',
            type: 'error'
          });
          router.push('/dashboard');
          return;
        }

        setPdf(pdfData);

        // Show success notification if this is a new upload
        const isNewUpload = searchParams.get('new') === 'true';
        if (isNewUpload) {
          setNotification({
            show: true,
            message: 'Notes generated successfully!',
            type: 'success'
          });
        }
      } catch (err) {
        console.error('Unexpected error fetching PDF:', {
          error: err,
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
          errorStack: err instanceof Error ? err.stack : undefined,
          pdfId: unwrappedParams.pdfId,
          userId: user.id
        });
        setNotification({
          show: true,
          message: 'An error occurred while loading the PDF',
          type: 'error'
        });
        router.push('/dashboard');
      } finally {
        setLoadingPDF(false);
      }
    };

    fetchPDF();
  }, [unwrappedParams.pdfId, user, searchParams, router]);

  useEffect(() => {
    if (pdf?.notes_generation_status === 'in_progress') {
      const checkProgress = async () => {
        const { data } = await supabase
          .from('pdfs')
          .select('notes_generation_progress, notes_generation_status')
          .eq('id', pdf.id)
          .single();
        
        if (data) {
          setGenerationProgress(data.notes_generation_progress);
          if (data.notes_generation_status === 'completed') {
            // Refresh the page to show the notes
            window.location.reload();
          }
        }
      };

      const interval = setInterval(checkProgress, 2000);
      return () => clearInterval(interval);
    }
  }, [pdf]);

  if (loading || loadingPDF) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  if (!pdf) {
    return null;
  }

  return (
    <DashboardLayout
      title={pdf.file_name}
      showBackButton
      onBackClick={() => router.push('/dashboard')}
      additionalHeaderContent={
        <a
          href={pdf.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600"
        >
          View PDF
        </a>
      }
    >
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />

      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none">
          {pdf.notes_generation_status === 'in_progress' ? (
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${generationProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">
                Generating notes... {generationProgress}%
              </p>
              <p className="text-gray-500 italic">
                This may take a few minutes depending on the size of your PDF.
              </p>
            </div>
          ) : pdf.notes ? (
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                h1: ({...props}) => <h1 className="text-3xl font-bold mb-4" {...props} />,
                h2: ({...props}) => <h2 className="text-2xl font-bold mb-3" {...props} />,
                h3: ({...props}) => <h3 className="text-xl font-bold mb-2" {...props} />,
                p: ({...props}) => <p className="mb-4" {...props} />,
                ul: ({...props}) => <ul className="list-disc pl-6 mb-4" {...props} />,
                ol: ({...props}) => <ol className="list-decimal pl-6 mb-4" {...props} />,
                li: ({...props}) => <li className="mb-1" {...props} />,
                code: ({inline, className, children, ...props}: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline ? (
                    <pre className="bg-gray-100 p-4 rounded mb-4 overflow-x-auto">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code className="bg-gray-100 rounded px-1" {...props}>
                      {children}
                    </code>
                  );
                },
                blockquote: ({...props}) => (
                  <blockquote className="border-l-4 border-gray-200 pl-4 italic mb-4" {...props} />
                ),
                table: ({...props}) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="min-w-full divide-y divide-gray-200" {...props} />
                  </div>
                ),
                th: ({...props}) => (
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props} />
                ),
                td: ({...props}) => (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" {...props} />
                ),
              }}
            >
              {pdf.notes}
            </ReactMarkdown>
          ) : pdf.notes_generation_status === 'failed' ? (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to generate notes</h3>
              <p className="mt-1 text-sm text-gray-500">
                There was an error generating notes for this PDF. Please try uploading it again.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No notes available</h3>
              <p className="mt-1 text-sm text-gray-500">
                Notes have not been generated for this PDF yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
} 