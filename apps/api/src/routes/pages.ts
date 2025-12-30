/**
 * Pages Management Routes
 *
 * Handles CRUD operations for pages within a project's Turso database.
 */

import { Hono } from 'hono';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, asc } from 'drizzle-orm';
import { db } from '@liteshow/db';
import { projects, users } from '@liteshow/db';
import { pages, blocks } from '@liteshow/db/src/content-schema';
import { randomUUID } from 'crypto';
import { syncPageToGitHub, deletePageFromGitHub } from '../lib/git-sync';

const pagesRoutes = new Hono();

// Middleware to get user from session token
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const [userId] = Buffer.from(token, 'base64').toString().split(':');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  return user;
}

// Helper to initialize content schema in Turso database
async function initializeContentSchema(tursoClient: any) {
  try {
    // Create pages table
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        meta_title TEXT,
        meta_description TEXT,
        og_image TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create blocks table with foreign key to pages
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS blocks (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        type TEXT NOT NULL,
        "order" INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
      )
    `);

    console.log('Content schema initialized/verified');
  } catch (error) {
    console.error('Failed to initialize content schema:', error);
    throw error;
  }
}

// Helper to get Turso database client for a project
async function getProjectTursoClient(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (project.userId !== userId) {
    throw new Error('Forbidden');
  }

  const tursoClient = createClient({
    url: `libsql://${project.tursoDbUrl}`,
    authToken: project.tursoDbToken,
  });

  // Initialize schema if tables don't exist (CREATE TABLE IF NOT EXISTS)
  await initializeContentSchema(tursoClient);

  return {
    client: drizzle(tursoClient, { schema: { pages, blocks } }),
    project,
  };
}

// GET /api/projects/:projectId/pages - List all pages
pagesRoutes.get('/:projectId/pages', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    const { client } = await getProjectTursoClient(projectId, user.id);

    const allPages = await client.select().from(pages).orderBy(asc(pages.createdAt));

    return c.json(allPages);
  } catch (error: any) {
    console.error('List pages error:', error);
    if (error.message === 'Project not found') {
      return c.json({ error: 'Project not found' }, 404);
    }
    if (error.message === 'Forbidden') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: 'Failed to list pages' }, 500);
  }
});

// POST /api/projects/:projectId/pages - Create a new page
pagesRoutes.post('/:projectId/pages', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    const body = await c.req.json();
    const { slug, title, description, status = 'draft', metaTitle, metaDescription, ogImage } = body;

    if (!slug || !title) {
      return c.json({ error: 'Slug and title are required' }, 400);
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return c.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, 400);
    }

    const { client } = await getProjectTursoClient(projectId, user.id);

    // Check if page with same slug exists
    const existingPage = await client.select().from(pages).where(eq(pages.slug, slug)).limit(1);

    if (existingPage.length > 0) {
      return c.json({ error: 'A page with this slug already exists' }, 409);
    }

    const now = new Date();
    const newPage = {
      id: randomUUID(),
      slug,
      title,
      description: description || null,
      status: status || 'draft',
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      ogImage: ogImage || null,
      createdAt: now,
      updatedAt: now,
    };

    await client.insert(pages).values(newPage);

    console.log(`Page created: ${newPage.id} in project ${projectId}`);

    return c.json(newPage, 201);
  } catch (error: any) {
    console.error('Create page error:', error);
    if (error.message === 'Project not found') {
      return c.json({ error: 'Project not found' }, 404);
    }
    if (error.message === 'Forbidden') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: error.message || 'Failed to create page' }, 500);
  }
});

// GET /api/projects/:projectId/pages/:pageId - Get a specific page with blocks
pagesRoutes.get('/:projectId/pages/:pageId', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    const pageId = c.req.param('pageId');
    const { client } = await getProjectTursoClient(projectId, user.id);

    const page = await client.select().from(pages).where(eq(pages.id, pageId)).limit(1);

    if (page.length === 0) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Get blocks for this page
    const pageBlocks = await client
      .select()
      .from(blocks)
      .where(eq(blocks.pageId, pageId))
      .orderBy(asc(blocks.order));

    return c.json({
      ...page[0],
      blocks: pageBlocks,
    });
  } catch (error: any) {
    console.error('Get page error:', error);
    if (error.message === 'Project not found') {
      return c.json({ error: 'Project not found' }, 404);
    }
    if (error.message === 'Forbidden') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: 'Failed to get page' }, 500);
  }
});

// PUT /api/projects/:projectId/pages/:pageId - Update a page
pagesRoutes.put('/:projectId/pages/:pageId', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    const pageId = c.req.param('pageId');
    const body = await c.req.json();
    const { slug, title, description, status, metaTitle, metaDescription, ogImage } = body;

    const { client, project } = await getProjectTursoClient(projectId, user.id);

    // Check if page exists
    const existingPage = await client.select().from(pages).where(eq(pages.id, pageId)).limit(1);

    if (existingPage.length === 0) {
      return c.json({ error: 'Page not found' }, 404);
    }

    const oldStatus = existingPage[0].status;

    // If slug is being changed, check for conflicts
    if (slug && slug !== existingPage[0].slug) {
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return c.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, 400);
      }

      const conflictingPage = await client.select().from(pages).where(eq(pages.slug, slug)).limit(1);

      if (conflictingPage.length > 0) {
        return c.json({ error: 'A page with this slug already exists' }, 409);
      }
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    if (slug !== undefined) updates.slug = slug;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (metaTitle !== undefined) updates.metaTitle = metaTitle;
    if (metaDescription !== undefined) updates.metaDescription = metaDescription;
    if (ogImage !== undefined) updates.ogImage = ogImage;

    await client.update(pages).set(updates).where(eq(pages.id, pageId));

    const updatedPage = await client.select().from(pages).where(eq(pages.id, pageId)).limit(1);

    console.log(`Page updated: ${pageId} in project ${projectId}`);

    // If page status changed to 'published', sync to GitHub
    const newStatus = updatedPage[0].status;
    if (oldStatus !== 'published' && newStatus === 'published') {
      console.log(`Page status changed to published, syncing to GitHub...`);

      try {
        // Fetch blocks for the page
        const pageBlocks = await client
          .select()
          .from(blocks)
          .where(eq(blocks.pageId, pageId))
          .orderBy(asc(blocks.order));

        // Sync to GitHub
        await syncPageToGitHub(
          project,
          {
            page: updatedPage[0],
            blocks: pageBlocks,
          },
          user.githubAccessToken!
        );

        console.log(`Successfully synced page to GitHub`);
      } catch (syncError) {
        console.error('Failed to sync to GitHub:', syncError);
        // Don't fail the update if sync fails - log and continue
        // User can manually trigger sync later if needed
      }
    }

    return c.json(updatedPage[0]);
  } catch (error: any) {
    console.error('Update page error:', error);
    if (error.message === 'Project not found') {
      return c.json({ error: 'Project not found' }, 404);
    }
    if (error.message === 'Forbidden') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: error.message || 'Failed to update page' }, 500);
  }
});

// DELETE /api/projects/:projectId/pages/:pageId - Delete a page
pagesRoutes.delete('/:projectId/pages/:pageId', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    const pageId = c.req.param('pageId');
    const { client, project } = await getProjectTursoClient(projectId, user.id);

    // Check if page exists
    const existingPage = await client.select().from(pages).where(eq(pages.id, pageId)).limit(1);

    if (existingPage.length === 0) {
      return c.json({ error: 'Page not found' }, 404);
    }

    const pageSlug = existingPage[0].slug;
    const wasPublished = existingPage[0].status === 'published';

    // Delete page (blocks will be cascade deleted)
    await client.delete(pages).where(eq(pages.id, pageId));

    console.log(`Page deleted: ${pageId} in project ${projectId}`);

    // If page was published, delete from GitHub
    if (wasPublished) {
      console.log(`Deleting published page from GitHub...`);
      try {
        await deletePageFromGitHub(project, pageSlug, user.githubAccessToken!);
        console.log(`Successfully deleted page from GitHub`);
      } catch (syncError) {
        console.error('Failed to delete from GitHub:', syncError);
        // Don't fail the deletion if GitHub sync fails
      }
    }

    return c.json({ success: true, message: 'Page deleted' });
  } catch (error: any) {
    console.error('Delete page error:', error);
    if (error.message === 'Project not found') {
      return c.json({ error: 'Project not found' }, 404);
    }
    if (error.message === 'Forbidden') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: 'Failed to delete page' }, 500);
  }
});

export default pagesRoutes;
