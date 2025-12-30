/**
 * Blocks Management Routes
 *
 * Handles CRUD operations for blocks within pages in a project's Turso database.
 */

import { Hono } from 'hono';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, asc } from 'drizzle-orm';
import { db } from '@liteshow/db';
import { projects, users } from '@liteshow/db';
import { pages, blocks } from '@liteshow/db/src/content-schema';
import { randomUUID } from 'crypto';
import { syncPageToGitHub } from '../services/git-sync';

const blocksRoutes = new Hono();

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

  return {
    client: drizzle(tursoClient, { schema: { pages, blocks } }),
    project,
  };
}

// Helper to sync page to GitHub after changes
async function syncPageAfterChange(
  client: any,
  project: any,
  user: any,
  pageId: string,
  commitMessage: string
) {
  try {
    // Get page data
    const pageData = await client.select().from(pages).where(eq(pages.id, pageId)).limit(1);
    if (pageData.length === 0) return;

    // Get all blocks for this page
    const pageBlocks = await client
      .select()
      .from(blocks)
      .where(eq(blocks.pageId, pageId))
      .orderBy(asc(blocks.order));

    // Sync to GitHub
    await syncPageToGitHub(
      pageData[0],
      pageBlocks,
      {
        repoUrl: project.githubRepoUrl,
        accessToken: user.githubAccessToken!,
        authorName: user.githubUsername,
        authorEmail: user.githubEmail || `${user.githubUsername}@users.noreply.github.com`,
      },
      commitMessage
    );

    console.log(`Synced page ${pageId} to GitHub`);
  } catch (error) {
    console.error('Failed to sync to GitHub:', error);
    // Don't throw - Git sync is optional and shouldn't fail the main operation
  }
}

// POST /api/projects/:projectId/pages/:pageId/blocks - Create a new block
blocksRoutes.post('/:projectId/pages/:pageId/blocks', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    const pageId = c.req.param('pageId');
    const body = await c.req.json();
    const { type, content, order } = body;

    if (!type || !content) {
      return c.json({ error: 'Type and content are required' }, 400);
    }

    const { client, project } = await getProjectTursoClient(projectId, user.id);

    // Check if page exists
    const page = await client.select().from(pages).where(eq(pages.id, pageId)).limit(1);

    if (page.length === 0) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // If order not provided, add to end
    let blockOrder = order;
    if (blockOrder === undefined) {
      const existingBlocks = await client
        .select()
        .from(blocks)
        .where(eq(blocks.pageId, pageId))
        .orderBy(asc(blocks.order));

      blockOrder = existingBlocks.length > 0 ? existingBlocks[existingBlocks.length - 1].order + 1 : 0;
    }

    const now = new Date();
    const newBlock = {
      id: randomUUID(),
      pageId,
      type,
      content: JSON.stringify(content),
      order: blockOrder,
      createdAt: now,
      updatedAt: now,
    };

    await client.insert(blocks).values(newBlock);

    console.log(`Block created: ${newBlock.id} in page ${pageId}`);

    // Sync to GitHub
    await syncPageAfterChange(client, project, user, pageId, `Add ${type} block to ${page[0].slug}`);

    return c.json(newBlock, 201);
  } catch (error: any) {
    console.error('Create block error:', error);
    if (error.message === 'Project not found') {
      return c.json({ error: 'Project not found' }, 404);
    }
    if (error.message === 'Forbidden') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: error.message || 'Failed to create block' }, 500);
  }
});

// PUT /api/projects/:projectId/pages/:pageId/blocks/:blockId - Update a block
blocksRoutes.put('/:projectId/pages/:pageId/blocks/:blockId', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    const pageId = c.req.param('pageId');
    const blockId = c.req.param('blockId');
    const body = await c.req.json();
    const { type, content, order } = body;

    const { client, project } = await getProjectTursoClient(projectId, user.id);

    // Check if block exists
    const existingBlock = await client.select().from(blocks).where(eq(blocks.id, blockId)).limit(1);

    if (existingBlock.length === 0) {
      return c.json({ error: 'Block not found' }, 404);
    }

    // Verify block belongs to the specified page
    if (existingBlock[0].pageId !== pageId) {
      return c.json({ error: 'Block does not belong to this page' }, 400);
    }

    // Get page info for commit message
    const page = await client.select().from(pages).where(eq(pages.id, pageId)).limit(1);

    const updates: any = {
      updatedAt: new Date(),
    };

    if (type !== undefined) updates.type = type;
    if (content !== undefined) updates.content = JSON.stringify(content);
    if (order !== undefined) updates.order = order;

    await client.update(blocks).set(updates).where(eq(blocks.id, blockId));

    const updatedBlock = await client.select().from(blocks).where(eq(blocks.id, blockId)).limit(1);

    console.log(`Block updated: ${blockId} in page ${pageId}`);

    // Sync to GitHub
    if (page.length > 0) {
      await syncPageAfterChange(client, project, user, pageId, `Update ${existingBlock[0].type} block in ${page[0].slug}`);
    }

    return c.json(updatedBlock[0]);
  } catch (error: any) {
    console.error('Update block error:', error);
    if (error.message === 'Project not found') {
      return c.json({ error: 'Project not found' }, 404);
    }
    if (error.message === 'Forbidden') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: error.message || 'Failed to update block' }, 500);
  }
});

// DELETE /api/projects/:projectId/pages/:pageId/blocks/:blockId - Delete a block
blocksRoutes.delete('/:projectId/pages/:pageId/blocks/:blockId', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    const pageId = c.req.param('pageId');
    const blockId = c.req.param('blockId');

    const { client, project } = await getProjectTursoClient(projectId, user.id);

    // Check if block exists
    const existingBlock = await client.select().from(blocks).where(eq(blocks.id, blockId)).limit(1);

    if (existingBlock.length === 0) {
      return c.json({ error: 'Block not found' }, 404);
    }

    // Verify block belongs to the specified page
    if (existingBlock[0].pageId !== pageId) {
      return c.json({ error: 'Block does not belong to this page' }, 400);
    }

    // Get page info for commit message
    const page = await client.select().from(pages).where(eq(pages.id, pageId)).limit(1);

    // Delete block
    await client.delete(blocks).where(eq(blocks.id, blockId));

    console.log(`Block deleted: ${blockId} from page ${pageId}`);

    // Sync to GitHub
    if (page.length > 0) {
      await syncPageAfterChange(client, project, user, pageId, `Delete ${existingBlock[0].type} block from ${page[0].slug}`);
    }

    return c.json({ success: true, message: 'Block deleted' });
  } catch (error: any) {
    console.error('Delete block error:', error);
    if (error.message === 'Project not found') {
      return c.json({ error: 'Project not found' }, 404);
    }
    if (error.message === 'Forbidden') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: 'Failed to delete block' }, 500);
  }
});

// POST /api/projects/:projectId/pages/:pageId/blocks/reorder - Reorder blocks
blocksRoutes.post('/:projectId/pages/:pageId/blocks/reorder', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    const pageId = c.req.param('pageId');
    const body = await c.req.json();
    const { blockIds } = body; // Array of block IDs in the new order

    if (!Array.isArray(blockIds)) {
      return c.json({ error: 'blockIds must be an array' }, 400);
    }

    const { client } = await getProjectTursoClient(projectId, user.id);

    // Check if page exists
    const page = await client.select().from(pages).where(eq(pages.id, pageId)).limit(1);

    if (page.length === 0) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Update order for each block
    for (let i = 0; i < blockIds.length; i++) {
      await client
        .update(blocks)
        .set({ order: i, updatedAt: new Date() })
        .where(eq(blocks.id, blockIds[i]));
    }

    console.log(`Blocks reordered in page ${pageId}`);

    return c.json({ success: true, message: 'Blocks reordered' });
  } catch (error: any) {
    console.error('Reorder blocks error:', error);
    if (error.message === 'Project not found') {
      return c.json({ error: 'Project not found' }, 404);
    }
    if (error.message === 'Forbidden') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ error: error.message || 'Failed to reorder blocks' }, 500);
  }
});

export default blocksRoutes;
