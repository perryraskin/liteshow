/**
 * Error Handler Middleware
 *
 * Centralized error handling for the API.
 * Integrates with Sentry for error tracking.
 */

import type { Context } from 'hono';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { captureException, setContext } from '../lib/sentry';

export const errorHandler: ErrorHandler = (err, c: Context) => {
  console.error('API Error:', err);

  // Add request context to Sentry
  setContext('request', {
    method: c.req.method,
    url: c.req.url,
    path: c.req.path,
    headers: {
      'user-agent': c.req.header('user-agent'),
      'content-type': c.req.header('content-type'),
    },
  });

  // Handle Hono HTTP exceptions
  if (err instanceof HTTPException) {
    // Only capture 5xx errors to Sentry (not 4xx client errors)
    if (err.status >= 500) {
      captureException(err, {
        httpStatus: err.status,
        path: c.req.path,
      });
    }

    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status
    );
  }

  // Default error response - always capture unexpected errors
  const status = 500;
  const message = err.message || 'Internal Server Error';

  captureException(err, {
    httpStatus: status,
    path: c.req.path,
    type: 'unhandled_error',
  });

  return c.json(
    {
      error: message,
      status,
    },
    status
  );
};
