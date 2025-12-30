/**
 * Public Content API Routes
 *
 * These endpoints are publicly accessible (no authentication required)
 * and serve published content for Astro sites to consume during build time.
 */

import { Hono } from 'hono';
import { db } from '@liteshow/db';
import { projects } from '@liteshow/db';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { pages, blocks } from '@liteshow/db/src/content-schema';

const publicContentRoutes = new Hono();

// GET /api/public/sites/:slug/pages - Get all published pages for a project
publicContentRoutes.get('/sites/:slug/pages', async (c) => {
  try {
    const projectSlug = c.req.param('slug');

    // Find project by slug
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, projectSlug),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Connect to project's Turso database
    const tursoClient = createClient({
      url: `libsql://${project.tursoDbUrl}`,
      authToken: project.tursoDbToken,
    });

    const projectDb = drizzle(tursoClient, { schema: { pages, blocks } });

    // Fetch all published pages
    const publishedPages = await projectDb
      .select()
      .from(pages)
      .where(eq(pages.status, 'published'));

    return c.json(publishedPages);
  } catch (error) {
    console.error('Error fetching published pages:', error);
    return c.json({ error: 'Failed to fetch pages' }, 500);
  }
});

// GET /api/public/sites/:slug/pages/:pageSlug - Get a specific page with its blocks
publicContentRoutes.get('/sites/:slug/pages/:pageSlug', async (c) => {
  try {
    const projectSlug = c.req.param('slug');
    const pageSlug = c.req.param('pageSlug');

    // Find project by slug
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, projectSlug),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Connect to project's Turso database
    const tursoClient = createClient({
      url: `libsql://${project.tursoDbUrl}`,
      authToken: project.tursoDbToken,
    });

    const projectDb = drizzle(tursoClient, { schema: { pages, blocks } });

    // Fetch the page
    const pageResults = await projectDb
      .select()
      .from(pages)
      .where(eq(pages.slug, pageSlug))
      .limit(1);

    if (pageResults.length === 0) {
      return c.json({ error: 'Page not found' }, 404);
    }

    const page = pageResults[0];

    // Only serve published pages
    if (page.status !== 'published') {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Fetch blocks for this page
    const pageBlocks = await projectDb
      .select()
      .from(blocks)
      .where(eq(blocks.pageId, page.id))
      .orderBy(blocks.order);

    // Parse block content
    const parsedBlocks = pageBlocks.map(block => ({
      ...block,
      content: typeof block.content === 'string' ? JSON.parse(block.content) : block.content
    }));

    return c.json({
      ...page,
      blocks: parsedBlocks,
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    return c.json({ error: 'Failed to fetch page' }, 500);
  }
});

export default publicContentRoutes;
