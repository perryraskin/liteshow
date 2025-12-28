/**
 * Authentication Middleware
 *
 * Provides middleware for protecting routes and checking authentication.
 */

import type { Context, Next } from 'hono';
import { auth } from './config';

/**
 * Middleware to require authentication
 * Returns 401 if user is not authenticated
 */
export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Add session to context
  c.set('session', session);
  c.set('user', session.user);

  await next();
}

/**
 * Middleware to optionally get current session
 * Does not return 401, just adds session to context if available
 */
export async function getSession(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (session) {
    c.set('session', session);
    c.set('user', session.user);
  }

  await next();
}
