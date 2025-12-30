/**
 * LiteShow Content API Client
 *
 * Fetches published content from the LiteShow public API
 */

const API_URL = import.meta.env.LITESHOW_API_URL || 'http://localhost:8000';
const PROJECT_SLUG = import.meta.env.LITESHOW_PROJECT_SLUG;

if (!PROJECT_SLUG) {
  throw new Error('LITESHOW_PROJECT_SLUG environment variable is required');
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  hasUnpublishedChanges: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  createdAt: Date | number;
  updatedAt: Date | number;
}

export interface PageWithBlocks extends Page {
  blocks: Array<{
    id: string;
    pageId: string;
    type: string;
    order: number;
    content: any;
    createdAt: Date | number;
    updatedAt: Date | number;
  }>;
}

/**
 * Fetch all published pages for the project
 */
export async function getAllPages(): Promise<Page[]> {
  try {
    const response = await fetch(`${API_URL}/api/public/sites/${PROJECT_SLUG}/pages`);

    if (!response.ok) {
      console.error(`Failed to fetch pages: ${response.status} ${response.statusText}`);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching pages:', error);
    return [];
  }
}

/**
 * Fetch a specific page with its blocks
 */
export async function getPageBySlug(slug: string): Promise<PageWithBlocks | null> {
  try {
    const response = await fetch(`${API_URL}/api/public/sites/${PROJECT_SLUG}/pages/${slug}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error(`Failed to fetch page: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching page:', error);
    return null;
  }
}
