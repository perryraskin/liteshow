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

import projectRoutes from './routes/projects';
import pagesRoutes from './routes/pages';
import blocksRoutes from './routes/blocks';
import healthRoutes from './routes/health';
import authRoutes from './routes/github-auth';
import publicContentRoutes from './routes/public-content';
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

// Routes - no /api prefix since entire domain is the API
app.route('/auth', authRoutes);
app.route('/public', publicContentRoutes);
app.route('/projects', projectRoutes);
app.route('/projects', pagesRoutes);
app.route('/projects', blocksRoutes);
app.route('/health', healthRoutes);

// Error handler (must be last)
app.onError(errorHandler);

const port = parseInt(process.env.API_PORT || process.env.PORT || '8080');

console.log(`🚀 LiteShow API server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});
