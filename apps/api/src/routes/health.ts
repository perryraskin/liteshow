/**
 * Health Check Routes
 *
 * Simple health check endpoint for monitoring.
 */

import { Hono } from 'hono';

const health = new Hono();

health.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'liteshow-api',
  });
});

export default health;
