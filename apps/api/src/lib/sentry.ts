/**
 * Sentry Error Tracking Configuration
 *
 * Initializes Sentry for error monitoring and performance tracking
 * in the Liteshow API.
 */

import * as Sentry from '@sentry/node'

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('⚠️  SENTRY_DSN not configured - error tracking disabled')
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Set the environment (production, staging, development)
    environment: process.env.NODE_ENV || 'development',

    // Set a release version for tracking
    release: process.env.API_VERSION || '0.1.0',

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Send default PII data (IP addresses, user info)
    sendDefaultPii: true,

    // Capture unhandled rejections
    integrations: [
      Sentry.captureConsoleIntegration({
        levels: ['error'],
      }),
    ],

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }

      return event
    },
  })

  console.log('✅ Sentry error tracking initialized')
}

/**
 * Capture an exception and send it to Sentry
 */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  console.error('Error captured by Sentry:', error)

  if (context) {
    Sentry.setContext('additional', context)
  }

  Sentry.captureException(error)
}

/**
 * Capture a message and send it to Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level)
}

/**
 * Add user context to Sentry events
 */
export function setUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user)
}

/**
 * Clear user context from Sentry
 */
export function clearUser() {
  Sentry.setUser(null)
}

/**
 * Set additional context for Sentry events
 */
export function setContext(key: string, data: Record<string, unknown>) {
  Sentry.setContext(key, data)
}

export { Sentry }
