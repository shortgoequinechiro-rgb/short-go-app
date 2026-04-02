'use client'

import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[#0e1e38] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4v2m0 4v2M9 3H3v18h18V3h-6zm0 0h6V1H9v2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-center text-gray-600 text-sm mb-4">
              We encountered an unexpected error. Please try again or return to the dashboard.
            </p>
            {error.message && (
              <p className="text-center text-gray-500 text-xs mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                {error.message}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => reset()}
              className="w-full bg-[#0e1e38] hover:bg-[#1a2a4a] text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Try Again
            </button>
            <Link
              href="/dashboard"
              className="block w-full text-center bg-blue-50 hover:bg-blue-100 text-[#0e1e38] font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
