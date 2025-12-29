/**
 * Authentication Routes
 *
 * Handles GitHub OAuth and session management via Better Auth.
 */

import { Hono } from 'hono';
import { auth } from '@liteshow/auth';

const authRoutes = new Hono();

// Better Auth handles all auth endpoints automatically
// Mount the Better Auth handler
authRoutes.all('/*', async (c) => {
  console.log('Auth route hit:', c.req.method, c.req.url);
  console.log('Auth route path:', c.req.path);
  console.log('Request raw URL:', c.req.raw.url);
  try {
    const response = await auth.handler(c.req.raw);
    console.log('Auth handler response status:', response?.status);
    return response;
  } catch (error) {
    console.error('Auth handler error:', error);
    throw error;
  }
});

export default authRoutes;
