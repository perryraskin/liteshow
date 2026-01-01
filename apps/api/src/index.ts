/**
 * Liteshow API Server
 *
 * Hono-based backend API for Liteshow platform.
 * Handles authentication, project management, and content operations.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env first (defaults), then .env.local (overrides)
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

import projectRoutes from './routes/projects';
import pagesRoutes from './routes/pages';
import blocksRoutes from './routes/blocks';
import healthRoutes from './routes/health';
import authRoutes from './routes/github-auth';
import publicContentRoutes from './routes/public-content';
import githubAppRoutes from './routes/github-app-routes';
import deploymentRoutes from './routes/deployment';
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

// Root route - simple status check
app.get('/', (c) => {
  return c.json({
    service: 'Liteshow API',
    version: '0.1.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// Routes - no /api prefix since entire domain is the API
app.route('/auth', authRoutes);
app.route('/public', publicContentRoutes);
app.route('/projects', projectRoutes);
app.route('/projects', pagesRoutes);
app.route('/projects', blocksRoutes);
app.route('/projects/:projectId/deployment', deploymentRoutes);
// Also mount deployments at /projects/:projectId for GET /deployments route
app.route('/projects/:projectId', deploymentRoutes);
app.route('/github-app', githubAppRoutes);
app.route('/health', healthRoutes);

// Error handler (must be last)
app.onError(errorHandler);

const port = parseInt(process.env.API_PORT || process.env.PORT || '8080');

console.log(`🚀 Liteshow API server starting on 0.0.0.0:${port}`);
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Database: ${process.env.DATABASE_URL ? 'configured' : 'missing'}`);

try {
  serve({
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  });
  console.log(`✅ Server listening on 0.0.0.0:${port}`);
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}
