/**
 * Content API Client
 *
 * Fetches published content from the Liteshow API.
 * This runs at build time to generate static pages.
 */

const API_URL = import.meta.env.LITESHOW_API_URL || 'https://api.liteshow.io';
const PROJECT_SLUG = import.meta.env.LITESHOW_PROJECT_SLUG;

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

export interface SiteSettings {
  siteTitle: string | null;
  siteDescription: string | null;
  faviconUrl: string | null;
}

/**
 * Fetch a specific published page by slug
 */
export async function getPage(slug: string): Promise<Page | null> {
  // Return null if no project slug configured (template build)
  if (!PROJECT_SLUG) {
    console.warn('[content-api] No LITESHOW_PROJECT_SLUG configured - returning null');
    return null;
  }

  try {
    const url = `${API_URL}/public/sites/${PROJECT_SLUG}/pages/${slug}`;
    console.log(`[content-api] Fetching page: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[content-api] Page not found: ${slug}`);
        return null;
      }
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }

    const page = await response.json();
    return page as Page;
  } catch (error) {
    console.error(`[content-api] Error fetching page "${slug}":`, error);
    return null;
  }
}

/**
 * Fetch all published pages for this project
 */
export async function getAllPages(): Promise<Page[]> {
  // Return empty array if no project slug configured (template build)
  if (!PROJECT_SLUG) {
    console.warn('[content-api] No LITESHOW_PROJECT_SLUG configured - returning empty array');
    return [];
  }

  try {
    const url = `${API_URL}/public/sites/${PROJECT_SLUG}/pages`;
    console.log(`[content-api] Fetching all pages: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch pages: ${response.statusText}`);
    }

    const pages = await response.json();

    // Fetch blocks for each page
    const pagesWithBlocks = await Promise.all(
      pages.map(async (page: Page) => {
        const fullPage = await getPage(page.slug);
        return fullPage || page;
      })
    );

    return pagesWithBlocks;
  } catch (error) {
    console.error('[content-api] Error fetching pages:', error);
    return [];
  }
}

/**
 * Fetch site settings (title, description, favicon)
 */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  // Return null if no project slug configured (template build)
  if (!PROJECT_SLUG) {
    console.warn('[content-api] No LITESHOW_PROJECT_SLUG configured - returning null');
    return null;
  }

  try {
    const url = `${API_URL}/public/sites/${PROJECT_SLUG}/settings`;
    console.log(`[content-api] Fetching site settings: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch site settings: ${response.statusText}`);
    }

    const settings = await response.json();
    return settings as SiteSettings;
  } catch (error) {
    console.error('[content-api] Error fetching site settings:', error);
    return null;
  }
}
