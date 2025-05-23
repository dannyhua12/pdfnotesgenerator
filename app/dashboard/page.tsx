'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'
import DashboardLayout from '../components/DashboardLayout'
import PDFUploader from '../components/PDFUploader'
import Notification from '../components/Notification'

type PDF = Database['public']['Tables']['pdfs']['Row']

export default function Dashboard() {
  const router = useRouter()
  const [pdfs, setPDFs] = useState<PDF[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error'
    show: boolean
  }>({
    message: '',
    type: 'success',
    show: false
  })

  useEffect(() => {
    loadPDFs()
  }, [])

  const loadPDFs = async () => {
    try {
      const supabase = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data, error } = await supabase
        .from('pdfs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setPDFs(data || [])
    } catch (err) {
      console.error('Error loading PDFs:', err)
      setNotification({
        message: 'Failed to load PDFs',
        type: 'error',
        show: true
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your PDFs</h1>
          <button
            onClick={() => router.push('/dashboard/upload')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Upload PDF
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading PDFs...</div>
          </div>
        ) : pdfs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">No PDFs uploaded yet</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pdfs.map((pdf) => (
              <div
                key={pdf.id}
                onClick={() => router.push(`/dashboard/${pdf.id}`)}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer group relative"
              >
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {pdf.file_name}
                </h3>
                <div className="flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const event = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                      });
                      const deleteButton = document.querySelector(`[data-pdf-id="${pdf.id}"]`);
                      if (deleteButton) {
                        deleteButton.dispatchEvent(event);
                      }
                    }}
                    className="text-red-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Notification
          message={notification.message}
          type={notification.type}
          show={notification.show}
          onClose={() => setNotification(prev => ({ ...prev, show: false }))}
        />
      </div>
    </DashboardLayout>
  )
} 