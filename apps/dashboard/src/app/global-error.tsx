'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            maxWidth: '500px',
            textAlign: 'center',
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
              Something went wrong!
            </h2>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              An unexpected error occurred. Our team has been notified and will look into it.
            </p>
            {error.digest && (
              <p style={{ fontSize: '14px', color: '#999', marginBottom: '16px' }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#000',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
