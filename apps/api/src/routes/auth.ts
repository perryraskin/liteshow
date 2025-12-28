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
authRoutes.all('/*', (c) => auth.handler(c.req.raw));

export default authRoutes;
