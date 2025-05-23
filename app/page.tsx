'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

export default function Home() {
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session)
    })
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="text-lg font-bold">PDF Notes Generator</div>
        <div className="flex gap-2">
          <button
            className="text-gray-700 hover:text-blue-600 px-4 py-2 rounded"
            onClick={() => router.push('/signin')}
          >
            Sign In
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => router.push('/signup')}
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero section */}
      <section className="flex flex-col items-center justify-center text-center py-24 px-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-4">
          Transform Your PDFs into <br />
          <span className="text-blue-600">Smart Study Notes</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          Upload your study materials and get AI-generated summaries, key points, and flashcards—instantly.<br />
          No more scrolling. Just smarter studying.
        </p>
        <button
          className="mt-8 px-8 py-3 bg-blue-600 text-white rounded shadow hover:bg-blue-700 text-lg font-semibold"
          onClick={() => router.push(loggedIn ? '/dashboard' : '/signin')}
        >
          Get Started
        </button>
      </section>

      {/* Features section */}
      <section className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 py-12 px-4">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <div className="bg-blue-100 text-blue-600 rounded-full p-3 mb-4">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" /></svg>
          </div>
          <h3 className="font-semibold text-lg mb-2">Smart Summaries</h3>
          <p className="text-gray-500 text-center">AI-powered notes that capture key concepts and important details.</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <div className="bg-blue-100 text-blue-600 rounded-full p-3 mb-4">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
          </div>
          <h3 className="font-semibold text-lg mb-2">Instant Generation</h3>
          <p className="text-gray-500 text-center">Get your study materials processed and organized in seconds.</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <div className="bg-blue-100 text-blue-600 rounded-full p-3 mb-4">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          </div>
          <h3 className="font-semibold text-lg mb-2">Customizable Format</h3>
          <p className="text-gray-500 text-center">Get your notes in the format that works best for you.</p>
        </div>
      </section>
    </div>
  )
}
