/**
 * Project Routes
 *
 * Handles project CRUD operations.
 * (To be fully implemented in Phase 2)
 */

import { Hono } from 'hono';
import { requireAuth } from '@liteshow/auth';

type Variables = {
  user: any;
  session: any;
};

const projects = new Hono<{ Variables: Variables }>();

// Protect all project routes with authentication
projects.use('*', requireAuth);

// List all projects for authenticated user
projects.get('/', async (c) => {
  const user = c.get('user');

  return c.json({
    message: 'Projects endpoint (Phase 2)',
    userId: user?.id,
    projects: [],
  });
});

// Get a specific project
projects.get('/:id', async (c) => {
  const id = c.req.param('id');

  return c.json({
    message: 'Get project endpoint (Phase 2)',
    projectId: id,
  });
});

// Create a new project
projects.post('/', async (c) => {
  return c.json({
    message: 'Create project endpoint (Phase 2)',
  });
});

// Update a project
projects.patch('/:id', async (c) => {
  const id = c.req.param('id');

  return c.json({
    message: 'Update project endpoint (Phase 2)',
    projectId: id,
  });
});

// Delete a project
projects.delete('/:id', async (c) => {
  const id = c.req.param('id');

  return c.json({
    message: 'Delete project endpoint (Phase 2)',
    projectId: id,
  });
});

export default projects;
