'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'
import { useAuth } from '@/app/providers/AuthProvider'
import ReactMarkdown from 'react-markdown'
import Notification from '@/app/components/Notification'
import DashboardLayout from '@/app/components/DashboardLayout'

type PDF = Database['public']['Tables']['pdfs']['Row']

export default function PDFNotesPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const pdfId = params.pdfId as string
  const [pdf, setPdf] = useState<PDF | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success' as 'success' | 'error'
  })

  useEffect(() => {
    const fetchPDF = async () => {
      if (!user) {
        router.push('/')
        return
      }

      try {
        const supabase = createBrowserClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data, error: fetchError } = await supabase
          .from('pdfs')
          .select('*')
          .eq('id', pdfId)
          .eq('user_id', user.id)
          .single()

        if (fetchError) throw fetchError
        setPdf(data)

        // Show success notification if this is a new upload
        const isNewUpload = searchParams.get('new') === 'true'
        if (isNewUpload) {
          setNotification({
            show: true,
            message: 'Notes generated successfully!',
            type: 'success'
          })
        }
      } catch (err) {
        console.error('Error fetching PDF:', err)
        setError('Failed to load PDF')
      } finally {
        setLoading(false)
      }
    }

    fetchPDF()
  }, [pdfId, user, searchParams, router])

  useEffect(() => {
    if (pdf?.notes_generation_status === 'in_progress') {
      const interval = setInterval(async () => {
        try {
          const supabase = createBrowserClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          )

          const { data, error: fetchError } = await supabase
            .from('pdfs')
            .select('*')
            .eq('id', pdfId)
            .single()

          if (fetchError) throw fetchError
          setPdf(data)

          if (data.notes_generation_status !== 'in_progress') {
            clearInterval(interval)
          }
        } catch (err) {
          console.error('Error checking PDF status:', err)
          clearInterval(interval)
        }
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [pdf?.notes_generation_status, pdfId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-red-600">{error}</div>
      </div>
    )
  }

  if (!pdf) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">PDF not found</div>
      </div>
    )
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

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {pdf.file_name}
            </h1>
            <p className="text-gray-600">
              {pdf.notes_generation_status === 'completed'
                ? 'Your notes are ready!'
                : 'Generating notes...'}
            </p>
          </div>

          {pdf.notes_generation_status === 'in_progress' && (
            <div className="mb-8">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-indigo-600 h-2.5 rounded-full animate-pulse"></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Please wait while we generate your notes...
              </p>
            </div>
          )}

          {pdf.notes_generation_status === 'completed' && pdf.notes && (
            <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6 prose-li:text-gray-700 prose-li:my-1">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-6 mb-3" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
                  p: ({ node, ...props }) => <p className="my-4 leading-relaxed" {...props} />,
                  ul: ({ node, ...props }) => <ul className="my-4 space-y-2" {...props} />,
                  ol: ({ node, ...props }) => <ol className="my-4 space-y-2" {...props} />,
                  li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                }}
              >
                {pdf.notes}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
} 