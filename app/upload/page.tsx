'use client'

import { useRouter } from 'next/navigation'
import DragDropUpload from '@/app/components/DragDropUpload'
import Notification from '@/app/components/Notification'
import { useState } from 'react'

export default function UploadPage() {
  const router = useRouter()
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error'
    show: boolean
  }>({
    message: '',
    type: 'success',
    show: false
  })

  const handleUploadSuccess = (pdfId: string) => {
    setNotification({
      message: 'PDF uploaded successfully!',
      type: 'success',
      show: true
    })
    router.push(`/${pdfId}?new=true`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Upload Your PDF
            </h1>
            <p className="text-gray-600">
              Drag and drop your PDF file or click to browse
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <DragDropUpload
              onUploadSuccess={handleUploadSuccess}
              onClose={() => router.push('/')}
            />
          </div>
        </div>
      </div>

      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
} 