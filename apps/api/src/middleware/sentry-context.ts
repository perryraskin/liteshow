/**
 * Sentry Context Middleware
 *
 * Middleware to add useful context to Sentry error reports
 */

import type { Context, Next } from 'hono'
import { setUser, setContext, captureMessage } from '../lib/sentry'

/**
 * Middleware to add user context to Sentry for authenticated requests
 *
 * Usage:
 * ```typescript
 * app.use('/protected/*', sentryUserContext)
 * ```
 */
export async function sentryUserContext(c: Context, next: Next) {
  // Extract user info from request (adjust based on your auth implementation)
  const authHeader = c.req.header('authorization')

  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '')
      const [userId] = Buffer.from(token, 'base64').toString().split(':')

      if (userId) {
        setUser({
          id: userId,
        })
      }
    } catch (error) {
      // Failed to parse user from token, continue without user context
      console.warn('Failed to extract user context for Sentry:', error)
    }
  }

  await next()
}

/**
 * Middleware to add request timing to Sentry context
 *
 * Tracks how long requests take and adds timing info to error reports
 */
export async function sentryPerformanceContext(c: Context, next: Next) {
  const startTime = Date.now()

  await next()

  const duration = Date.now() - startTime

  // Log slow requests as info to Sentry
  if (duration > 5000) {
    // 5 seconds
    captureMessage(`Slow request: ${c.req.method} ${c.req.path} took ${duration}ms`, 'warning')
  }

  // Add timing context for any errors
  setContext('performance', {
    requestDuration: duration,
    path: c.req.path,
    method: c.req.method,
  })
}

/**
 * Middleware to add project context to Sentry for project-specific routes
 *
 * Usage:
 * ```typescript
 * app.use('/projects/:projectId/*', sentryProjectContext)
 * ```
 */
export async function sentryProjectContext(c: Context, next: Next) {
  const projectId = c.req.param('projectId')

  if (projectId) {
    setContext('project', {
      id: projectId,
    })
  }

  await next()
}
