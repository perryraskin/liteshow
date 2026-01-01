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

// GET /public/sites/:slug/pages - Get all published pages for a project
publicContentRoutes.get('/sites/:slug/pages', async (c) => {
  try {
    const projectSlug = c.req.param('slug');
    console.log(`[public-content] Looking for project with slug: ${projectSlug}`);

    // Find project by slug
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, projectSlug),
    });

    if (!project) {
      console.log(`[public-content] Project not found for slug: ${projectSlug}`);
      return c.json({ error: 'Project not found' }, 404);
    }

    console.log(`[public-content] Found project: ${project.id} (${project.name})`);

    // Connect to project's Turso database
    const tursoClient = createClient({
      url: `libsql://${project.tursoDbUrl}`,
      authToken: project.tursoDbToken,
    });

    const projectDb = drizzle(tursoClient, { schema: { pages, blocks } });

    // Fetch all saved pages (ready for deployment)
    const savedPages = await projectDb
      .select()
      .from(pages)
      .where(eq(pages.status, 'saved'));

    return c.json(savedPages);
  } catch (error) {
    console.error('Error fetching published pages:', error);
    return c.json({ error: 'Failed to fetch pages' }, 500);
  }
});

// GET /public/sites/:slug/pages/:pageSlug - Get a specific page with its blocks
publicContentRoutes.get('/sites/:slug/pages/:pageSlug', async (c) => {
  try {
    const projectSlug = c.req.param('slug');
    const pageSlug = c.req.param('pageSlug');
    console.log(`[public-content] Looking for project: ${projectSlug}, page: ${pageSlug}`);

    // Find project by slug
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, projectSlug),
    });

    if (!project) {
      console.log(`[public-content] Project not found for slug: ${projectSlug}`);
      return c.json({ error: 'Project not found' }, 404);
    }

    console.log(`[public-content] Found project: ${project.id} (${project.name})`);

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

    // Only serve saved pages (ready for deployment)
    if (page.status !== 'saved') {
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

// GET /public/sites/:slug/settings - Get site settings (title, favicon, etc.)
publicContentRoutes.get('/sites/:slug/settings', async (c) => {
  try {
    const projectSlug = c.req.param('slug');
    console.log(`[public-content] Fetching settings for project: ${projectSlug}`);

    // Find project by slug
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, projectSlug),
      columns: {
        siteTitle: true,
        siteDescription: true,
        faviconUrl: true,
        slug: true,
        name: true,
      },
    });

    if (!project) {
      console.log(`[public-content] Project not found for slug: ${projectSlug}`);
      return c.json({ error: 'Project not found' }, 404);
    }

    return c.json({
      siteTitle: project.siteTitle || project.name,
      siteDescription: project.siteDescription || `Welcome to ${project.name}`,
      faviconUrl: project.faviconUrl || null,
    });
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return c.json({ error: 'Failed to fetch site settings' }, 500);
  }
});

export default publicContentRoutes;
