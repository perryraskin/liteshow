/**
 * Database utilities for fetching content from project Turso databases
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { pages, blocks } from '@liteshow/db/src/content-schema';

interface ProjectConfig {
  tursoDbUrl: string;
  tursoDbToken: string;
}

/**
 * Get a Turso database client for a specific project
 */
export function getProjectDb(config: ProjectConfig) {
  const tursoClient = createClient({
    url: `libsql://${config.tursoDbUrl}`,
    authToken: config.tursoDbToken,
  });

  return drizzle(tursoClient, { schema: { pages, blocks } });
}

/**
 * Fetch a page and its blocks by slug
 */
export async function getPageBySlug(db: ReturnType<typeof getProjectDb>, slug: string) {
  const pageResults = await db
    .select()
    .from(pages)
    .where(eq(pages.slug, slug))
    .limit(1);

  if (pageResults.length === 0) {
    return null;
  }

  const page = pageResults[0];

  // Get blocks for this page
  const pageBlocks = await db
    .select()
    .from(blocks)
    .where(eq(blocks.pageId, page.id))
    .orderBy((blocks) => blocks.order);

  return {
    ...page,
    blocks: pageBlocks.map(block => ({
      ...block,
      content: typeof block.content === 'string' ? JSON.parse(block.content) : block.content
    })),
  };
}
