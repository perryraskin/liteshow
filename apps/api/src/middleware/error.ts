/**
 * Error Handler Middleware
 *
 * Centralized error handling for the API.
 */

import type { Context } from 'hono';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const errorHandler: ErrorHandler = (err, c: Context) => {
  console.error('API Error:', err);

  // Handle Hono HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status
    );
  }

  // Default error response
  const status = 500;
  const message = err.message || 'Internal Server Error';

  return c.json(
    {
      error: message,
      status,
    },
    status
  );
};
