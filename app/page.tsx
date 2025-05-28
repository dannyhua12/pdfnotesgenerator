'use client'

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from './providers/AuthProvider';
import { supabase } from '@/lib/supabase';

// Separate component for success message
function SuccessMessage() {
  const searchParams = useSearchParams();
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      setSuccessMessage(message);
      // Clear the message from the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('message');
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);

  if (!successMessage) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50">
      {successMessage}
    </div>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSignIn = async () => {
    setShowSignIn(true);
    setShowSignUp(false);
    setError('');
  };

  const handleSignUp = async () => {
    setShowSignUp(true);
    setShowSignIn(false);
    setError('');
  };

  const handleGetStarted = () => {
    setShowSignUp(true);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push('/dashboard');
    } catch (err: Error | unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: 'https://pdfnotesgenerator.vercel.app/auth/callback',
        },
      });
      if (error) throw error;
      setSignupSuccess(true);
      setShowSignUp(false);
    } catch (err: Error | unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Suspense fallback={null}>
        <SuccessMessage />
      </Suspense>
      {signupSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50">
          A confirmation email has been sent to {email}. Please check your inbox to complete your registration.
        </div>
      )}
      {/* Navigation Bar */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">PDF Notes Generator</h1>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleSignIn}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={handleSignUp}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center py-24 sm:py-32">
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
            Transform Your PDFs into
            <br />
            <span className="text-blue-600">Smart Study Notes</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-12">
            Upload your study materials and get AI-generated summaries, key points, and flashcards—instantly.
            <br />
            No more scrolling. Just smarter studying.
          </p>
          <button
            onClick={handleGetStarted}
            className="px-8 py-4 bg-blue-500 text-white text-lg rounded-lg hover:bg-blue-600 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-transform"
          >
            Get Started
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 py-16">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Summaries</h3>
            <p className="text-gray-600">AI-powered notes that capture key concepts and important details.</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Instant Generation</h3>
            <p className="text-gray-600">Get your study materials processed and organized in seconds.</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Customizable Format</h3>
            <p className="text-gray-600">Get your notes in the format that works best for you.</p>
          </div>
        </div>
      </main>

      {/* Auth Modals */}
      {showSignIn && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Sign In</h2>
              <button
                onClick={() => setShowSignIn(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      )}

      {showSignUp && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Create Account</h2>
              <button
                onClick={() => setShowSignUp(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Sign Up
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
