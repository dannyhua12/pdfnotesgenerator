'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'
import FlashcardList from '@/app/components/FlashcardList'
import CreateFlashcardForm from '@/app/components/CreateFlashcardForm'

export default function FlashcardsPage() {
  const router = useRouter()
  const params = useParams()
  const pdfId = params.pdfId as string
  const [pdf, setPdf] = useState<{ file_name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPDF = async () => {
      try {
        const supabase = createBrowserClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Check session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        // Fetch PDF details
        const { data: pdfData, error: pdfError } = await supabase
          .from('pdfs')
          .select('file_name')
          .eq('id', pdfId)
          .eq('user_id', session.user.id)
          .single()

        if (pdfError || !pdfData) {
          router.push('/dashboard')
          return
        }

        setPdf(pdfData)
      } catch (err) {
        console.error('Error fetching PDF:', err)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchPDF()
  }, [pdfId, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    )
  }

  if (!pdf) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Flashcards for {pdf.file_name}
          </h1>
          <p className="text-gray-600">
            Create and review flashcards to help you study this document.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Flashcard Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Create New Flashcard
            </h2>
            <CreateFlashcardForm
              pdfId={pdfId}
              onSuccess={() => {
                // The FlashcardList component will automatically refresh
                // when the flashcards change
              }}
            />
          </div>

          {/* Flashcards List */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Your Flashcards
            </h2>
            <FlashcardList pdfId={pdfId} />
          </div>
        </div>
      </div>
    </div>
  )
} 