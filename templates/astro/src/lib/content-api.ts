import { createClient } from '@libsql/client';

// Only create client if env vars exist (they won't exist when building the template itself)
const turso = import.meta.env.TURSO_DATABASE_URL && import.meta.env.TURSO_AUTH_TOKEN
  ? createClient({
      url: import.meta.env.TURSO_DATABASE_URL,
      authToken: import.meta.env.TURSO_AUTH_TOKEN,
    })
  : null;

export interface Block {
  id: string;
  type: string;
  content: Record<string, unknown>;
  order: number;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  blocks: Block[];
}

export async function getPage(slug: string): Promise<Page | null> {
  // Return null if no database client (template build without env vars)
  if (!turso) {
    return null;
  }

  try {
    // Get page
    const pageResult = await turso.execute({
      sql: 'SELECT * FROM pages WHERE slug = ? AND status = ?',
      args: [slug, 'published'],
    });

    if (pageResult.rows.length === 0) {
      return null;
    }

    const pageRow = pageResult.rows[0];

    // Get blocks
    const blocksResult = await turso.execute({
      sql: 'SELECT * FROM blocks WHERE page_id = ? ORDER BY "order" ASC',
      args: [pageRow.id as string],
    });

    const blocks: Block[] = blocksResult.rows.map((row) => ({
      id: row.id as string,
      type: row.type as string,
      content: JSON.parse(row.content as string),
      order: row.order as number,
    }));

    return {
      id: pageRow.id as string,
      title: pageRow.title as string,
      slug: pageRow.slug as string,
      status: pageRow.status as 'draft' | 'published',
      seo_title: pageRow.seo_title as string | undefined,
      seo_description: pageRow.seo_description as string | undefined,
      seo_keywords: pageRow.seo_keywords as string | undefined,
      blocks,
    };
  } catch (error) {
    console.error('Error fetching page:', error);
    return null;
  }
}

export async function getAllPages(): Promise<Page[]> {
  // Return empty array if no database client (template build without env vars)
  if (!turso) {
    return [];
  }

  try {
    const pagesResult = await turso.execute({
      sql: 'SELECT * FROM pages WHERE status = ?',
      args: ['published'],
    });

    const pages: Page[] = [];

    for (const pageRow of pagesResult.rows) {
      const blocksResult = await turso.execute({
        sql: 'SELECT * FROM blocks WHERE page_id = ? ORDER BY "order" ASC',
        args: [pageRow.id as string],
      });

      const blocks: Block[] = blocksResult.rows.map((row) => ({
        id: row.id as string,
        type: row.type as string,
        content: JSON.parse(row.content as string),
        order: row.order as number,
      }));

      pages.push({
        id: pageRow.id as string,
        title: pageRow.title as string,
        slug: pageRow.slug as string,
        status: pageRow.status as 'draft' | 'published',
        seo_title: pageRow.seo_title as string | undefined,
        seo_description: pageRow.seo_description as string | undefined,
        seo_keywords: pageRow.seo_keywords as string | undefined,
        blocks,
      });
    }

    return pages;
  } catch (error) {
    console.error('Error fetching pages:', error);
    return [];
  }
}
