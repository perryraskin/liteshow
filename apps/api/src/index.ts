/**
 * LiteShow API Server
 *
 * Hono-based backend API for LiteShow platform.
 * Handles authentication, project management, and content operations.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import 'dotenv/config';

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import healthRoutes from './routes/health';
import { errorHandler } from './middleware/error';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/health', healthRoutes);

// Error handler (must be last)
app.onError(errorHandler);

const port = parseInt(process.env.API_PORT || '8000');

console.log(`🚀 LiteShow API server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
