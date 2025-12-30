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
async function createGitHubRepository(slug: string, description: string, accessToken: string) {
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
        description: description || 'LiteShow content repository',
        private: false,
        auto_init: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('GitHub API error:', error);
      throw new Error(`Failed to create GitHub repository: ${response.statusText}`);
    }

    const repo = await response.json() as { name: string; html_url: string };
    return {
      name: repo.name,
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

Built with [LiteShow](https://liteshow.io) - AI-first, Git-powered CMS

## Quick Deploy

Choose your preferred hosting platform:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/${repoFullName}#LITESHOW_PROJECT_SLUG=${slug}&LITESHOW_API_URL=https://api.liteshow.io)

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/${repoFullName}&env=LITESHOW_PROJECT_SLUG,LITESHOW_API_URL&envDescription=Required%20environment%20variables)

**Your project slug:** \`${slug}\` (copy and paste when prompted during deployment)

After deploying, any content you publish in LiteShow will automatically trigger a rebuild.

## Manual Setup

If you prefer manual setup:

1. Import this repo in your hosting platform
2. Set build command: \`pnpm install && pnpm build\`
3. Set publish directory: \`dist\`
4. Add these **required** environment variables:
   - \`LITESHOW_PROJECT_SLUG\` = \`${slug}\`
   - \`LITESHOW_API_URL\` = \`https://api.liteshow.io\`

## Environment Variables

**Both environment variables are required for deployment:**

- \`LITESHOW_PROJECT_SLUG\` - Your project slug: \`${slug}\`
- \`LITESHOW_API_URL\` - LiteShow API endpoint: \`https://api.liteshow.io\`

The site fetches your published content from the LiteShow API at build time.

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

This Astro site fetches your published content from the LiteShow API at build time. LiteShow handles all the database infrastructure - you just manage your content!
`,
      },
      {
        path: 'package.json',
        content: `{
  "name": "liteshow-${slug}",
  "version": "0.1.0",
  "private": true,
  "description": "${projectName} - Built with LiteShow",
  "scripts": {
    "dev": "astro dev --port 4321",
    "build": "astro build",
    "preview": "astro preview",
    "lint": "astro check"
  },
  "dependencies": {
    "@astrojs/tailwind": "^5.1.0",
    "astro": "^5.16.6",
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
        content: `# LiteShow Configuration
# Get these values from your LiteShow project settings

# Your project's slug (required)
LITESHOW_PROJECT_SLUG=your-project-slug

# LiteShow API URL (optional - defaults to http://localhost:8000)
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
    const response = await fetch(\`\${API_URL}/api/public/sites/\${PROJECT_SLUG}/pages\`);

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
    const response = await fetch(\`\${API_URL}/api/public/sites/\${PROJECT_SLUG}/pages/\${slug}\`);

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
`,
      },
      {
        path: 'src/layouts/BaseLayout.astro',
        content: `---
interface Props {
  title: string;
  description?: string;
  ogImage?: string;
}

const { title, description, ogImage } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
      rel="stylesheet"
    />

    <title>{title}</title>
    {description && <meta name="description" content={description} />}

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    {description && <meta property="og:description" content={description} />}
    {ogImage && <meta property="og:image" content={ogImage} />}

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content={title} />
    {description && <meta property="twitter:description" content={description} />}
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
// Index page - redirect to home or show a default landing
import { getAllPages } from '../lib/content-api';
import BaseLayout from '../layouts/BaseLayout.astro';

// Fetch all published pages
const allPages = await getAllPages();

// Try to find a page with slug 'home' or 'index'
const homePage = allPages.find(p => p.slug === 'home');
if (homePage) {
  return Astro.redirect('/home');
}

const indexPage = allPages.find(p => p.slug === 'index');
if (indexPage) {
  return Astro.redirect('/index');
}

// If no home/index page, redirect to first published page
if (allPages.length > 0) {
  return Astro.redirect('/' + allPages[0].slug);
}

// Otherwise show a placeholder
---

<BaseLayout title="Welcome" description="Welcome to your site">
  <main class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
    <div class="text-center p-8">
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        Welcome to Your Site
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-300 mb-8">
        No pages have been published yet. Create and publish pages in your LiteShow dashboard to get started.
      </p>
      <div class="text-sm text-gray-500 dark:text-gray-400">
        Built with <span class="font-semibold">LiteShow</span> - AI-first, Git-powered CMS
      </div>
    </div>
  </main>
</BaseLayout>
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
import { getAllPages, getPageBySlug } from '../lib/content-api';

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
interface Props {
  content: {
    markdown: string;
  };
}

const { content } = Astro.props;
const { markdown } = content;
---

<section class="py-16 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto prose prose-lg prose-blue">
      <div set:html={markdown} class="text-gray-700 leading-relaxed" />
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
  command = "pnpm install && pnpm build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

# Redirect root to home page
[[redirects]]
  from = "/"
  to = "/home"
  status = 302

# Catch-all 404
[[redirects]]
  from = "/*"
  to = "/404"
  status = 404
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
    const { name, slug, description, githubAuthType, githubInstallationId, githubRepoId, isPrivate } = body;

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

    // Validate GitHub auth configuration
    const authType = githubAuthType || 'oauth';
    if (authType === 'oauth') {
      // Check if user has the required scope
      const requiredScope = isPrivate ? 'hasPrivateRepoScope' : 'hasPublicRepoScope';
      if (!user[requiredScope]) {
        return c.json({
          error: `User does not have ${isPrivate ? 'private' : 'public'} repo access. Please authorize repository access first.`,
          requiresAuth: true,
          requiredScope: isPrivate ? 'repo' : 'public_repo'
        }, 403);
      }
    } else if (authType === 'github_app') {
      if (!githubInstallationId || !githubRepoId) {
        return c.json({ error: 'GitHub App installation ID and repository ID are required' }, 400);
      }
    } else {
      return c.json({ error: 'Invalid githubAuthType. Must be "oauth" or "github_app"' }, 400);
    }

    console.log(`Creating project "${name}" (${slug}) for user ${user.id} with ${authType} auth`);

    // Step 1: Create Turso database
    console.log('Creating Turso database...');
    const tursoDb = await createTursoDatabase(slug);

    // Step 1.5: Initialize content schema
    console.log('Initializing content schema...');
    await initializeContentSchema(tursoDb.url, tursoDb.token);

    // Step 2: Create or link GitHub repository
    let githubRepo;
    if (authType === 'oauth') {
      // LiteShow creates the repository
      console.log('Creating GitHub repository...');
      githubRepo = await createGitHubRepository(slug, description, user.githubAccessToken!);

      // Create deployment configuration files
      console.log('Creating deployment configuration files...');
      const repoFullName = githubRepo.url.replace('https://github.com/', '');
      await createDeploymentFiles(repoFullName, name, slug, tursoDb.url, user.githubAccessToken!);
    } else {
      // GitHub App - repository already exists and is selected by user
      // We need to fetch the repository details to get the URL
      console.log('Linking to existing GitHub repository...');
      // The githubRepoId format is "owner/repo"
      githubRepo = {
        name: githubRepoId.split('/')[1],
        url: `https://github.com/${githubRepoId}`,
      };

      // Note: We could create deployment files here too using the GitHub App token,
      // but for now we'll let users do that manually since they own the repo
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
      githubRepoName: githubRepo.name,
      githubRepoUrl: githubRepo.url,
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
