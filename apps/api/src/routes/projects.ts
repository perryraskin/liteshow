/**
 * Project Management Routes
 *
 * Handles project CRUD operations, Turso DB provisioning, and GitHub repo creation.
 */

import { Hono } from 'hono';
import { db } from '@liteshow/db';
import { projects, users, activityLogs } from '@liteshow/db';
import { eq, desc } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { pages, blocks } from '@liteshow/db/src/content-schema';
import { syncTemplateToRepo } from '../lib/template-sync';
import { getGitHubTokenForProject } from '../lib/github-token';

const projectRoutes = new Hono();

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

// Helper: Initialize content schema in Turso database
async function initializeContentSchema(dbUrl: string, authToken: string) {
  // Retry logic: Turso databases need a moment to become available after creation
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tursoClient = createClient({
        url: `libsql://${dbUrl}`,
        authToken: authToken,
      });

      // Create pages table
      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS pages (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          has_unpublished_changes INTEGER NOT NULL DEFAULT 0,
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

      // Create page_versions table for versioning
      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS page_versions (
          id TEXT PRIMARY KEY,
          page_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          snapshot TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        )
      `);

      // Migration: Add hasUnpublishedChanges column to existing tables
      try {
        await tursoClient.execute(`
          ALTER TABLE pages ADD COLUMN has_unpublished_changes INTEGER NOT NULL DEFAULT 0
        `);
        console.log('Added hasUnpublishedChanges column to pages table');
      } catch (migrationError: any) {
        // Column might already exist, which is fine
        if (!migrationError.message?.includes('duplicate column name')) {
          console.warn('Migration warning:', migrationError.message);
        }
      }

      console.log('Content schema initialized successfully');
      return; // Success! Exit the retry loop
    } catch (error: any) {
      console.error(`Failed to initialize content schema (attempt ${attempt}/${maxRetries}):`, error.message);

      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('Max retries reached. Database might not be ready yet.');
        throw error;
      }
    }
  }
}

// Helper: Create Turso database
async function createTursoDatabase(slug: string) {
  const tursoApiToken = process.env.TURSO_API_TOKEN;
  const tursoOrg = process.env.TURSO_ORG || 'perryraskin'; // Default org name

  if (!tursoApiToken) {
    throw new Error('TURSO_API_TOKEN not configured');
  }

  try {
    // Create the database
    const createResponse = await fetch(`https://api.turso.tech/v1/organizations/${tursoOrg}/databases`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tursoApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `liteshow-${slug}`,
        group: 'liteshow',
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('Turso create DB error:', error);
      throw new Error(`Failed to create Turso database: ${createResponse.statusText}`);
    }

    const dbData = await createResponse.json() as {
      database: { Name: string; Hostname: string };
    };
    console.log('Turso database created:', dbData);

    // Create an auth token for the database
    const tokenResponse = await fetch(`https://api.turso.tech/v1/organizations/${tursoOrg}/databases/${dbData.database.Name}/auth/tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tursoApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expiration: 'never',
        authorization: 'full-access',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to create Turso auth token: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json() as { jwt: string };

    return {
      url: dbData.database.Hostname,
      token: tokenData.jwt,
    };
  } catch (error) {
    console.error('Turso API error:', error);
    throw error;
  }
}

// Helper: Create GitHub repository
async function createGitHubRepository(slug: string, description: string, accessToken: string, isPrivate: boolean = false) {
  try {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        name: `liteshow-${slug}`,
        description: description || 'Liteshow content repository',
        private: isPrivate,
        auto_init: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('GitHub API error:', error);
      throw new Error(`Failed to create GitHub repository: ${response.statusText}`);
    }

    const repo = await response.json() as { name: string; full_name: string; html_url: string };
    return {
      name: repo.full_name, // Use full_name (owner/repo) instead of just name
      url: repo.html_url,
    };
  } catch (error) {
    console.error('GitHub repository creation error:', error);
    throw error;
  }
}

// Helper: Create deployment configuration files in GitHub repo
async function createDeploymentFiles(
  repoFullName: string,
  projectName: string,
  slug: string,
  tursoDbUrl: string,
  accessToken: string
) {
  try {
    // Get the default branch (usually main)
    const repoResponse = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!repoResponse.ok) {
      throw new Error('Failed to get repository info');
    }

    const repoData = await repoResponse.json() as { default_branch: string };
    const defaultBranch = repoData.default_branch;

    // Files to create
    const files = [
      {
        path: 'README.md',
        content: `# ${projectName}

Built with [Liteshow](https://liteshow.io) - AI-first, Git-powered CMS

## Deploy Your Site

### Netlify Deployment

1. Go to [Netlify](https://app.netlify.com/start)
2. Click **"Import an existing project"**
3. Select **GitHub** and choose this repository
4. Configure build settings:
   - **Build command:** \`pnpm install && pnpm build\`
   - **Publish directory:** \`dist\`
5. Add environment variables (see below)
6. Click **Deploy site**

### Vercel Deployment

1. Go to [Vercel](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select this repository from GitHub
4. Configure project:
   - **Build command:** \`pnpm install && pnpm build\`
   - **Output directory:** \`dist\`
5. Add environment variables (see below)
6. Click **Deploy**

After deploying, any content you publish in Liteshow will automatically trigger a rebuild via webhook.

## Environment Variables

**Both environment variables are required for deployment:**

- \`LITESHOW_PROJECT_SLUG\` - Your project slug: \`${slug}\`
- \`LITESHOW_API_URL\` - Liteshow API endpoint: \`https://api.liteshow.io\`

The site fetches your published content from the Liteshow API at build time.

## Local Development

\`\`\`bash
# Copy environment template
cp .env.example .env

# Edit .env and add your configuration
# LITESHOW_PROJECT_SLUG=${slug}
# LITESHOW_API_URL=https://api.liteshow.io

# Install and run
pnpm install
pnpm dev
\`\`\`

Visit http://localhost:4321

## How It Works

This Astro site fetches your published content from the Liteshow API at build time. Liteshow handles all the database infrastructure - you just manage your content!
`,
      },
      {
        path: 'package.json',
        content: `{
  "name": "liteshow-${slug}",
  "version": "0.1.0",
  "private": true,
  "description": "${projectName} - Built with Liteshow",
  "scripts": {
    "dev": "astro dev --port 4321",
    "build": "astro build",
    "preview": "astro preview",
    "lint": "astro check"
  },
  "dependencies": {
    "@astrojs/tailwind": "^5.1.0",
    "astro": "^5.16.6",
    "marked": "^14.1.3",
    "tailwindcss": "^3.4.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3"
  }
}
`,
      },
      {
        path: 'astro.config.mjs',
        content: `import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
  server: {
    port: 4321,
  },
});
`,
      },
      {
        path: 'tailwind.config.mjs',
        content: `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
`,
      },
      {
        path: '.env.example',
        content: `# Liteshow Configuration
# Get these values from your Liteshow project settings

# Your project's slug (required)
LITESHOW_PROJECT_SLUG=your-project-slug

# Liteshow API URL (optional - defaults to http://localhost:8000)
# For production, this will be set automatically by your hosting platform
# LITESHOW_API_URL=https://api.liteshow.io
`,
      },
      {
        path: 'src/env.d.ts',
        content: `/// <reference path="../.astro/types.d.ts" />`,
      },
      {
        path: 'src/lib/content-api.ts',
        content: `/**
 * Liteshow Content API Client
 *
 * Fetches published content from the Liteshow public API
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

export interface SiteSettings {
  siteTitle: string;
  siteDescription: string;
  faviconUrl: string | null;
}

/**
 * Fetch all published pages for the project
 */
export async function getAllPages(): Promise<Page[]> {
  try {
    const response = await fetch(\`\${API_URL}/public/sites/\${PROJECT_SLUG}/pages\`);

    if (!response.ok) {
      console.error(\`Failed to fetch pages: \${response.status} \${response.statusText}\`);
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
    const response = await fetch(\`\${API_URL}/public/sites/\${PROJECT_SLUG}/pages/\${slug}\`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error(\`Failed to fetch page: \${response.status} \${response.statusText}\`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching page:', error);
    return null;
  }
}

/**
 * Fetch site settings (title, description, favicon)
 */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const response = await fetch(\`\${API_URL}/public/sites/\${PROJECT_SLUG}/settings\`);

    if (!response.ok) {
      console.error(\`Failed to fetch site settings: \${response.status} \${response.statusText}\`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return null;
  }
}
`,
      },
      {
        path: 'src/layouts/BaseLayout.astro',
        content: `---
import type { SiteSettings } from '../lib/content-api';

interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  siteSettings?: SiteSettings | null;
}

const { title, description, ogImage, siteSettings } = Astro.props;

// Format the page title with site title if available
const fullTitle = siteSettings?.siteTitle
  ? \`\${title} - \${siteSettings.siteTitle}\`
  : title;

// Use site description as fallback if page description not provided
const metaDescription = description || siteSettings?.siteDescription;

// Use custom favicon if provided, otherwise default
const faviconUrl = siteSettings?.faviconUrl || '/favicon.svg';
const faviconType = siteSettings?.faviconUrl ? 'image/png' : 'image/svg+xml';
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type={faviconType} href={faviconUrl} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
      rel="stylesheet"
    />

    <title>{fullTitle}</title>
    {metaDescription && <meta name="description" content={metaDescription} />}

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content={fullTitle} />
    {metaDescription && <meta property="og:description" content={metaDescription} />}
    {ogImage && <meta property="og:image" content={ogImage} />}

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content={fullTitle} />
    {metaDescription && <meta property="twitter:description" content={metaDescription} />}
    {ogImage && <meta property="twitter:image" content={ogImage} />}
  </head>
  <body class="antialiased">
    <slot />
  </body>
</html>
`,
      },
      {
        path: 'src/pages/index.astro',
        content: `---
// Index page - render home page content directly or show a default landing
import { getAllPages, getPageBySlug, getSiteSettings } from '../lib/content-api';
import BaseLayout from '../layouts/BaseLayout.astro';
import HeroBlock from '../components/blocks/HeroBlock.astro';
import FeaturesBlock from '../components/blocks/FeaturesBlock.astro';
import TestimonialsBlock from '../components/blocks/TestimonialsBlock.astro';
import MarkdownBlock from '../components/blocks/MarkdownBlock.astro';
import CtaBlock from '../components/blocks/CtaBlock.astro';
import FaqBlock from '../components/blocks/FaqBlock.astro';

// Fetch site settings
const siteSettings = await getSiteSettings();

// Fetch all published pages
const allPages = await getAllPages();

// Try to find a page with slug 'home'
const homePageData = allPages.find(p => p.slug === 'home');
let homePage = null;

// If home page exists, fetch its full content
if (homePageData) {
  homePage = await getPageBySlug('home');
}

const blockComponents: Record<string, any> = {
  hero: HeroBlock,
  features: FeaturesBlock,
  testimonials: TestimonialsBlock,
  markdown: MarkdownBlock,
  cta: CtaBlock,
  faq: FaqBlock,
};
---

{homePage ? (
  <BaseLayout
    title={homePage.title}
    description={homePage.metaDescription || homePage.description || undefined}
    ogImage={homePage.ogImage || undefined}
    siteSettings={siteSettings}
  >
    <main>
      {homePage.blocks.map((block: any) => {
        const Component = blockComponents[block.type];
        if (!Component) {
          console.warn(\`Unknown block type: \${block.type}\`);
          return null;
        }
        return <Component content={block.content} />;
      })}
    </main>
  </BaseLayout>
) : (
  <BaseLayout
    title={siteSettings?.siteTitle || "Welcome"}
    description={siteSettings?.siteDescription}
    siteSettings={siteSettings}
  >
    <main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div class="max-w-4xl mx-auto">
        <div class="text-center mb-12">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {siteSettings?.siteTitle || "Welcome to Your Site"}
          </h1>
          {siteSettings?.siteDescription && (
            <p class="text-lg text-gray-600 dark:text-gray-300">
              {siteSettings.siteDescription}
            </p>
          )}
        </div>

        {allPages.length > 0 ? (
          <div class="space-y-4">
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              Pages
            </h2>
            <div class="grid gap-4 md:grid-cols-2">
              {allPages.map((page: any) => (
                <a
                  href={\`/\${page.slug}\`}
                  class="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
                >
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {page.title}
                  </h3>
                  {page.description && (
                    <p class="text-gray-600 dark:text-gray-300">
                      {page.description}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div class="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <p class="text-lg text-gray-600 dark:text-gray-300 mb-4">
              No pages have been published yet.
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Create and publish pages in your Liteshow dashboard to get started.
            </p>
          </div>
        )}

        <div class="text-center mt-12 text-sm text-gray-500 dark:text-gray-400">
          Built with <span class="font-semibold">Liteshow</span> - AI-first, Git-powered CMS
        </div>
      </div>
    </main>
  </BaseLayout>
)}
`,
      },
      {
        path: 'src/pages/[slug].astro',
        content: `---
import BaseLayout from '../layouts/BaseLayout.astro';
import HeroBlock from '../components/blocks/HeroBlock.astro';
import FeaturesBlock from '../components/blocks/FeaturesBlock.astro';
import TestimonialsBlock from '../components/blocks/TestimonialsBlock.astro';
import MarkdownBlock from '../components/blocks/MarkdownBlock.astro';
import CtaBlock from '../components/blocks/CtaBlock.astro';
import FaqBlock from '../components/blocks/FaqBlock.astro';
import { getAllPages, getPageBySlug, getSiteSettings } from '../lib/content-api';

// Generate static paths at build time
export async function getStaticPaths() {
  // Fetch all published pages from API
  const allPages = await getAllPages();

  return allPages.map(page => ({
    params: { slug: page.slug },
    props: { pageId: page.id },
  }));
}

const { pageId } = Astro.props;
const { slug } = Astro.params;

// Fetch site settings
const siteSettings = await getSiteSettings();

// Fetch page with blocks from API
const page = await getPageBySlug(slug as string);

if (!page) {
  return Astro.redirect('/404');
}

const blockComponents: Record<string, any> = {
  hero: HeroBlock,
  features: FeaturesBlock,
  testimonials: TestimonialsBlock,
  markdown: MarkdownBlock,
  cta: CtaBlock,
  faq: FaqBlock,
};
---

<BaseLayout
  title={page.metaTitle || page.title}
  description={page.metaDescription || page.description || undefined}
  ogImage={page.ogImage || undefined}
  siteSettings={siteSettings}
>
  <main>
    {page.blocks.map((block: any) => {
      const Component = blockComponents[block.type];
      if (!Component) {
        console.warn(\`Unknown block type: \${block.type}\`);
        return null;
      }
      return <Component content={block.content} />;
    })}
  </main>
</BaseLayout>
`,
      },
      {
        path: 'src/pages/404.astro',
        content: `---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="Page Not Found">
  <main class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center px-4">
      <h1 class="text-6xl font-bold text-gray-900 mb-4">404</h1>
      <p class="text-xl text-gray-600 mb-8">Page not found</p>
      <a
        href="/"
        class="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors duration-200"
      >
        Go Home
      </a>
    </div>
  </main>
</BaseLayout>
`,
      },
      {
        path: 'src/components/blocks/HeroBlock.astro',
        content: `---
interface Props {
  content: {
    headline: string;
    subheadline?: string;
    ctaText?: string;
    ctaUrl?: string;
    backgroundImage?: string;
  };
}

const { content } = Astro.props;
const { headline, subheadline, ctaText, ctaUrl, backgroundImage } = content;
---

<section
  class="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 py-20 lg:py-32"
  style={backgroundImage ? \`background-image: url(\${backgroundImage}); background-size: cover; background-position: center;\` : ''}
>
  {backgroundImage && <div class="absolute inset-0 bg-black/40"></div>}

  <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
    <div class="max-w-4xl mx-auto text-center">
      <h1
        class:list={[
          'text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight',
          backgroundImage ? 'text-white' : 'text-gray-900'
        ]}
      >
        {headline}
      </h1>

      {subheadline && (
        <p
          class:list={[
            'text-xl lg:text-2xl mb-10 leading-relaxed',
            backgroundImage ? 'text-gray-100' : 'text-gray-600'
          ]}
        >
          {subheadline}
        </p>
      )}

      {ctaText && ctaUrl && (
        <div class="flex justify-center">
          <a
            href={ctaUrl}
            class="inline-block px-8 py-4 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {ctaText}
          </a>
        </div>
      )}
    </div>
  </div>
</section>
`,
      },
      {
        path: 'src/components/blocks/FeaturesBlock.astro',
        content: `---
interface Props {
  content: {
    title?: string;
    features: Array<{
      icon?: string;
      title: string;
      description: string;
    }>;
  };
}

const { content } = Astro.props;
const { title, features } = content;
---

<section class="py-20 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    {title && (
      <h2 class="text-3xl lg:text-4xl font-bold text-center mb-16 text-gray-900">
        {title}
      </h2>
    )}

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
      {features.map((feature) => (
        <div class="text-center group">
          {feature.icon && (
            <div class="mb-6 flex justify-center">
              <div class="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-200">
                <span class="text-3xl">{feature.icon}</span>
              </div>
            </div>
          )}

          <h3 class="text-xl font-semibold mb-3 text-gray-900">
            {feature.title}
          </h3>

          <p class="text-gray-600 leading-relaxed">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>
`,
      },
      {
        path: 'src/components/blocks/TestimonialsBlock.astro',
        content: `---
interface Props {
  content: {
    title?: string;
    testimonials: Array<{
      quote: string;
      author: string;
      role?: string;
      avatarUrl?: string;
    }>;
  };
}

const { content } = Astro.props;
const { title, testimonials } = content;
---

<section class="py-20 bg-gray-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    {title && (
      <h2 class="text-3xl lg:text-4xl font-bold text-center mb-16 text-gray-900">
        {title}
      </h2>
    )}

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {testimonials.map((testimonial) => (
        <div class="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div class="mb-6">
            <svg class="w-10 h-10 text-blue-500 opacity-50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
          </div>

          <p class="text-gray-700 mb-6 leading-relaxed">
            {testimonial.quote}
          </p>

          <div class="flex items-center">
            {testimonial.avatarUrl && (
              <img
                src={testimonial.avatarUrl}
                alt={testimonial.author}
                class="w-12 h-12 rounded-full mr-4 object-cover"
              />
            )}

            <div>
              <p class="font-semibold text-gray-900">
                {testimonial.author}
              </p>
              {testimonial.role && (
                <p class="text-sm text-gray-500">
                  {testimonial.role}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>
`,
      },
      {
        path: 'src/components/blocks/CtaBlock.astro',
        content: `---
interface Props {
  content: {
    headline: string;
    subheadline?: string;
    buttonText: string;
    buttonUrl: string;
    backgroundColor?: string;
  };
}

const { content } = Astro.props;
const { headline, subheadline, buttonText, buttonUrl, backgroundColor } = content;
---

<section
  class="py-20"
  style={backgroundColor ? \`background-color: \${backgroundColor}\` : ''}
  class:list={[!backgroundColor && 'bg-blue-600']}
>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto text-center">
      <h2 class="text-3xl lg:text-4xl font-bold mb-6 text-white">
        {headline}
      </h2>

      {subheadline && (
        <p class="text-xl mb-10 text-blue-100 leading-relaxed">
          {subheadline}
        </p>
      )}

      <a
        href={buttonUrl}
        class="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-full hover:bg-gray-100 transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
      >
        {buttonText}
      </a>
    </div>
  </div>
</section>
`,
      },
      {
        path: 'src/components/blocks/MarkdownBlock.astro',
        content: `---
import { marked } from 'marked';

interface Props {
  content: {
    markdown: string;
  };
}

const { content } = Astro.props;
const { markdown } = content;

// Parse markdown to HTML
const htmlContent = await marked.parse(markdown || '');
---

<section class="py-16 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto prose prose-lg prose-blue">
      <div set:html={htmlContent} class="text-gray-700 leading-relaxed" />
    </div>
  </div>
</section>

<style>
  .prose {
    max-width: 65ch;
  }

  .prose :global(h2) {
    @apply text-2xl font-bold mb-4 mt-8 text-gray-900;
  }

  .prose :global(h3) {
    @apply text-xl font-semibold mb-3 mt-6 text-gray-900;
  }

  .prose :global(p) {
    @apply mb-4;
  }

  .prose :global(ul), .prose :global(ol) {
    @apply mb-4 ml-6;
  }

  .prose :global(li) {
    @apply mb-2;
  }

  .prose :global(a) {
    @apply text-blue-600 hover:text-blue-700 underline;
  }

  .prose :global(strong) {
    @apply font-semibold text-gray-900;
  }

  .prose :global(code) {
    @apply bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800;
  }

  .prose :global(pre) {
    @apply bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4;
  }

  .prose :global(pre code) {
    @apply bg-transparent p-0;
  }

  .prose :global(blockquote) {
    @apply border-l-4 border-blue-500 pl-4 italic text-gray-600 my-4;
  }
</style>
`,
      },
      {
        path: 'src/components/blocks/FaqBlock.astro',
        content: `---
interface Props {
  content: {
    title?: string;
    faqs: Array<{
      question: string;
      answer: string;
    }>;
  };
}

const { content } = Astro.props;
const { title, faqs } = content;
---

<section class="py-20 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    {title && (
      <h2 class="text-3xl lg:text-4xl font-bold text-center mb-16 text-gray-900">
        {title}
      </h2>
    )}

    <div class="max-w-3xl mx-auto space-y-6">
      {faqs.map((faq) => (
        <div class="bg-gray-50 rounded-2xl p-6 hover:bg-gray-100 transition-colors duration-200">
          <h3 class="text-lg font-semibold mb-3 text-gray-900">
            {faq.question}
          </h3>
          <p class="text-gray-600 leading-relaxed">
            {faq.answer}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>
`,
      },
      {
        path: 'netlify.toml',
        content: `[build]
  command = "corepack enable && pnpm install && pnpm build"
  publish = "dist"
  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF"

[build.environment]
  NODE_VERSION = "20"
  NPM_FLAGS = "--version"
`,
      },
      {
        path: 'vercel.json',
        content: `{
  "buildCommand": "pnpm install && pnpm build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",
  "framework": "astro"
}
`,
      },
      {
        path: '.node-version',
        content: '20',
      },
    ];

    // Create each file
    for (const file of files) {
      const createFileResponse = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${file.path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `Add ${file.path}`,
          content: Buffer.from(file.content).toString('base64'),
          branch: defaultBranch,
        }),
      });

      if (!createFileResponse.ok) {
        const error = await createFileResponse.text();
        console.error(`Failed to create ${file.path}:`, error);
        // Don't throw - continue creating other files
      } else {
        console.log(`Created ${file.path}`);
      }
    }

    console.log('Deployment files created successfully');
  } catch (error) {
    console.error('Failed to create deployment files:', error);
    // Don't throw - this shouldn't block project creation
  }
}

// GET /api/projects - List all projects for the authenticated user
projectRoutes.get('/', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProjects = await db.query.projects.findMany({
      where: eq(projects.userId, user.id),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    return c.json(userProjects);
  } catch (error) {
    console.error('List projects error:', error);
    return c.json({ error: 'Failed to list projects' }, 500);
  }
});

// POST /api/projects - Create a new project
projectRoutes.post('/', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { name, slug, description, githubStrategy, repoVisibility, githubInstallationId, githubRepoId } = body;

    if (!name || !slug) {
      return c.json({ error: 'Name and slug are required' }, 400);
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return c.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, 400);
    }

    // Check if project with same slug exists
    const existing = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
    });

    if (existing) {
      return c.json({ error: 'A project with this slug already exists' }, 409);
    }

    // Determine GitHub auth strategy
    const strategy = githubStrategy || 'link-later';
    let authType: string | null = null;
    let shouldCreateGitHubRepo = false;

    if (strategy === 'create-now') {
      // OAuth: Liteshow creates the repo
      authType = 'oauth';
      shouldCreateGitHubRepo = true;

      // Check if user has the required scope
      const isPrivate = repoVisibility === 'private';
      const requiredScope = isPrivate ? 'hasPrivateRepoScope' : 'hasPublicRepoScope';
      if (!user[requiredScope]) {
        return c.json({
          error: `User does not have ${isPrivate ? 'private' : 'public'} repo access. Please authorize repository access first.`,
          requiresAuth: true,
          requiredScope: isPrivate ? 'repo' : 'public_repo'
        }, 403);
      }
    } else if (strategy === 'link-later') {
      // No GitHub setup yet - will be linked after project creation
      authType = null;
      shouldCreateGitHubRepo = false;
    } else if (strategy === 'github-app') {
      // GitHub App: User links existing repo
      authType = 'github_app';
      shouldCreateGitHubRepo = false;
      if (!githubInstallationId || !githubRepoId) {
        return c.json({ error: 'GitHub App installation ID and repository ID are required' }, 400);
      }
    } else {
      return c.json({ error: 'Invalid githubStrategy. Must be "create-now", "link-later", or "github-app"' }, 400);
    }

    console.log(`Creating project "${name}" (${slug}) for user ${user.id} with strategy: ${strategy}`);

    // Step 1: Create Turso database
    console.log('Creating Turso database...');
    const tursoDb = await createTursoDatabase(slug);

    // Step 1.5: Initialize content schema
    console.log('Initializing content schema...');
    await initializeContentSchema(tursoDb.url, tursoDb.token);

    // Step 2: Create or link GitHub repository (if applicable)
    let githubRepo: { name: string; url: string } | null = null;

    if (shouldCreateGitHubRepo) {
      // Liteshow creates the repository via OAuth
      console.log('Creating GitHub repository...');
      const isPrivate = repoVisibility === 'private';
      githubRepo = await createGitHubRepository(slug, description, user.githubAccessToken!, isPrivate);

      // Create deployment configuration files
      console.log('Creating deployment configuration files...');
      const repoFullName = githubRepo.url.replace('https://github.com/', '');
      await createDeploymentFiles(repoFullName, name, slug, tursoDb.url, user.githubAccessToken!);
    } else if (authType === 'github_app') {
      // GitHub App - repository already exists and is selected by user
      console.log('Linking to existing GitHub repository...');
      // The githubRepoId format is "owner/repo"
      githubRepo = {
        name: githubRepoId.split('/')[1],
        url: `https://github.com/${githubRepoId}`,
      };

      // Note: We could create deployment files here too using the GitHub App token,
      // but for now we'll let users do that manually since they own the repo
    } else {
      // link-later strategy - no GitHub repo yet
      console.log('Skipping GitHub repository setup (will be linked later)');
    }

    // Step 3: Store project in PostgreSQL
    console.log('Storing project metadata...');
    const [newProject] = await db.insert(projects).values({
      userId: user.id,
      name,
      slug,
      description: description || null,
      tursoDbUrl: tursoDb.url,
      tursoDbToken: tursoDb.token,
      githubRepoName: githubRepo?.name || null,
      githubRepoUrl: githubRepo?.url || null,
      githubAuthType: authType,
      githubInstallationId: githubInstallationId || null,
      githubRepoId: githubRepoId || null,
      isPublished: false,
    }).returning();

    console.log(`Project created successfully: ${newProject.id}`);

    return c.json(newProject, 201);
  } catch (error: any) {
    console.error('Create project error:', error);
    return c.json({ error: error.message || 'Failed to create project' }, 500);
  }
});

// GET /api/projects/:id - Get a specific project
projectRoutes.get('/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    return c.json({ error: 'Failed to get project' }, 500);
  }
});

// POST /api/projects/:id/initialize-schema - Initialize content schema for existing project
projectRoutes.post('/:id/initialize-schema', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    console.log(`Initializing content schema for project ${projectId}`);
    await initializeContentSchema(project.tursoDbUrl, project.tursoDbToken);

    return c.json({ success: true, message: 'Content schema initialized' });
  } catch (error) {
    console.error('Initialize schema error:', error);
    return c.json({ error: 'Failed to initialize schema' }, 500);
  }
});

// GET /api/projects/:id/activity - Get activity logs for a project
projectRoutes.get('/:id/activity', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Get activity logs with optional pagination
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const activities = await db.query.activityLogs.findMany({
      where: eq(activityLogs.projectId, projectId),
      orderBy: [desc(activityLogs.createdAt)],
      limit: Math.min(limit, 100), // Max 100 items per request
      offset,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            githubUsername: true,
            avatarUrl: true,
          },
        },
      },
    });

    return c.json({
      activities,
      pagination: {
        limit,
        offset,
        hasMore: activities.length === limit,
      },
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    return c.json({ error: 'Failed to get activity logs' }, 500);
  }
});

// POST /api/projects/:id/link-github - Link GitHub repository to existing project
projectRoutes.post('/:id/link-github', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const body = await c.req.json();
    const { strategy, repoVisibility } = body;

    // Get the project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Check if project already has a GitHub repo
    if (project.githubRepoUrl) {
      return c.json({ error: 'Project already has a GitHub repository linked' }, 400);
    }

    console.log(`Linking GitHub to project ${projectId} with strategy: ${strategy}`);

    if (strategy === 'create-now') {
      // Check if user has the required scope
      const isPrivate = repoVisibility === 'private';
      const requiredScope = isPrivate ? 'hasPrivateRepoScope' : 'hasPublicRepoScope';
      if (!user[requiredScope]) {
        return c.json({
          error: `User does not have ${isPrivate ? 'private' : 'public'} repo access. Please authorize repository access first.`,
          requiresAuth: true,
          requiredScope: isPrivate ? 'repo' : 'public_repo'
        }, 403);
      }

      // Create GitHub repository
      console.log('Creating GitHub repository...');
      const githubRepo = await createGitHubRepository(project.slug, project.description || '', user.githubAccessToken!, isPrivate);

      // Create deployment files
      console.log('Creating deployment files...');
      const repoFullName = githubRepo.url.replace('https://github.com/', '');
      await createDeploymentFiles(repoFullName, project.name, project.slug, project.tursoDbUrl, user.githubAccessToken!);

      // Update project with GitHub info
      await db.update(projects)
        .set({
          githubRepoName: githubRepo.name,
          githubRepoUrl: githubRepo.url,
          githubAuthType: 'oauth',
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      console.log('GitHub repository linked successfully');

      return c.json({
        success: true,
        githubRepoUrl: githubRepo.url,
      });
    } else if (strategy === 'github-app') {
      // GitHub App - link existing repository
      const { githubInstallationId, githubRepoId } = body;

      if (!githubInstallationId || !githubRepoId) {
        return c.json({ error: 'GitHub installation ID and repository ID are required' }, 400);
      }

      console.log(`Linking GitHub App repository: ${githubRepoId}`);

      // Extract repo name and URL from full_name (e.g., "owner/repo")
      const repoName = githubRepoId.split('/')[1];
      const repoUrl = `https://github.com/${githubRepoId}`;

      // Update project with GitHub App info
      await db.update(projects)
        .set({
          githubRepoName: repoName,
          githubRepoUrl: repoUrl,
          githubAuthType: 'github_app',
          githubInstallationId: githubInstallationId,
          githubRepoId: githubRepoId,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      console.log('GitHub App repository linked successfully');

      return c.json({
        success: true,
        githubRepoUrl: repoUrl,
      });
    } else {
      return c.json({ error: 'Invalid strategy' }, 400);
    }
  } catch (error: any) {
    console.error('Link GitHub error:', error);
    return c.json({ error: error.message || 'Failed to link GitHub repository' }, 500);
  }
});

// GET /api/projects/:id/sync-template/status - Check if template sync PR exists
projectRoutes.get('/:id/sync-template/status', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');

    // Get project and verify ownership
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!project.githubRepoUrl || !project.githubRepoName) {
      return c.json({ hasPendingPR: false });
    }

    // Get GitHub token
    const token = await getGitHubTokenForProject(project, user);
    if (!token) {
      return c.json({ hasPendingPR: false });
    }

    // Check for existing sync PR
    const { checkExistingSyncPR } = await import('../lib/template-sync');
    const prUrl = await checkExistingSyncPR(project.githubRepoName, token);

    return c.json({
      hasPendingPR: !!prUrl,
      prUrl: prUrl || null,
    });
  } catch (error: any) {
    console.error('Error checking sync PR status:', error);
    return c.json({ hasPendingPR: false });
  }
});

// POST /api/projects/:id/sync-template - Create PR with template updates
projectRoutes.post('/:id/sync-template', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');

    // Get project and verify ownership
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!project.githubRepoUrl) {
      return c.json({ error: 'GitHub repository not connected. Setup GitHub first.' }, 403);
    }

    // Sync template to repository
    const result = await syncTemplateToRepo(projectId, user.id);

    if (result.existingPrUrl) {
      return c.json(
        {
          error: 'Sync PR already exists',
          prUrl: result.existingPrUrl,
        },
        409
      );
    }

    if (result.upToDate) {
      return c.json({
        success: true,
        upToDate: true,
        message: 'Your template is already up to date',
      });
    }

    return c.json({
      success: true,
      prUrl: result.prUrl,
      branchName: result.branchName,
      filesChanged: result.filesChanged,
    });
  } catch (error: any) {
    console.error('Template sync error:', error);
    return c.json({ error: error.message || 'Failed to sync template' }, 500);
  }
});

// PATCH /api/projects/:id/settings - Update project site settings
projectRoutes.patch('/:id/settings', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const body = await c.req.json();
    const { siteTitle, siteDescription, faviconUrl } = body;

    // Verify project exists and belongs to user
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Update project settings
    await db
      .update(projects)
      .set({
        siteTitle: siteTitle || null,
        siteDescription: siteDescription || null,
        faviconUrl: faviconUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    // Fetch and return updated project
    const updatedProject = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    return c.json(updatedProject);
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

// DELETE /api/projects/:id - Delete a project (Turso database and records)
projectRoutes.delete('/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    console.log(`Deleting project ${projectId} for user ${user.id}`);

    // Store GitHub repo URL to return in response
    const githubRepoUrl = project.githubRepoUrl;

    // Step 1: Delete Turso database
    try {
      const tursoApiToken = process.env.TURSO_API_TOKEN;
      const tursoOrg = process.env.TURSO_ORG || 'perryraskin';
      const dbName = `liteshow-${project.slug}`;

      console.log(`Deleting Turso database: ${dbName}`);

      const deleteTursoResponse = await fetch(
        `https://api.turso.tech/v1/organizations/${tursoOrg}/databases/${dbName}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${tursoApiToken}`,
          },
        }
      );

      if (!deleteTursoResponse.ok && deleteTursoResponse.status !== 404) {
        console.error('Failed to delete Turso database:', await deleteTursoResponse.text());
        // Continue anyway
      } else {
        console.log('Turso database deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting Turso database:', error);
      // Continue anyway
    }

    // Step 2: Delete project from PostgreSQL (cascades to activity logs)
    await db.delete(projects).where(eq(projects.id, projectId));

    console.log(`Project ${projectId} deleted successfully`);

    return c.json({
      success: true,
      message: 'Project deleted successfully',
      githubRepoUrl: githubRepoUrl
    });
  } catch (error: any) {
    console.error('Delete project error:', error);
    return c.json({ error: error.message || 'Failed to delete project' }, 500);
  }
});

export default projectRoutes;
