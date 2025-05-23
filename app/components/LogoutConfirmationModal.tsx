'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'
import Notification from './Notification'

type LogoutConfirmationModalProps = {
  isOpen: boolean
  onClose: () => void
}

type NotificationState = {
  message: string
  type: 'success' | 'error'
  show: boolean
}

export default function LogoutConfirmationModal({ isOpen, onClose }: LogoutConfirmationModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState<NotificationState>({
    message: '',
    type: 'success',
    show: false
  })

  if (!isOpen) return null

  const handleLogout = async () => {
    setLoading(true)

    try {
      const supabase = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { error } = await supabase.auth.signOut()

      if (error) throw error

      setNotification({
        message: 'Logged out successfully',
        type: 'success',
        show: true
      })

      router.push('/')
    } catch (err) {
      console.error('Error logging out:', err)
      setNotification({
        message: 'Failed to log out',
        type: 'error',
        show: true
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-xl font-bold mb-4">Confirm Logout</h2>
        <p className="text-gray-600 mb-6">
          Are you sure you want to log out?
        </p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? 'Logging out...' : 'Logout'}
          </button>
        </div>

        <Notification
          message={notification.message}
          type={notification.type}
          show={notification.show}
          onClose={() => setNotification((prev: NotificationState) => ({ ...prev, show: false }))}
        />
      </div>
    </div>
  )
} 