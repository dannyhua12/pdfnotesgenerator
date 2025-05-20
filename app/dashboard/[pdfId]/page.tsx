'use client'

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type PDF = Database['public']['Tables']['pdfs']['Row'];

export default function PDFNotesPage({ params }: { params: Promise<{ pdfId: string }> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pdf, setPdf] = useState<PDF | null>(null);
  const [loadingPDF, setLoadingPDF] = useState(true);
  const resolvedParams = use(params);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPDF = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('pdfs')
          .select('*')
          .eq('id', resolvedParams.pdfId)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setPdf(data);
      } catch (err) {
        console.error('Error fetching PDF:', err);
        router.push('/dashboard');
      } finally {
        setLoadingPDF(false);
      }
    };

    fetchPDF();
  }, [resolvedParams.pdfId, user]);

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
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
            <h1 className="text-2xl font-bold text-gray-900">{pdf.file_name}</h1>
          </div>
          <a
            href={pdf.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600"
          >
            View PDF
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none">
            {pdf.notes ? (
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
                      <pre className="bg-gray-100 p-4 rounded mb-4">
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
                }}
              >
                {pdf.notes}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-500">No notes generated yet</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 