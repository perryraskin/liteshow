import { db } from '@liteshow/db';
import { projects, users } from '@liteshow/db';
import { eq } from 'drizzle-orm';
import { getGitHubTokenForProject } from './github-token';
import { promises as fs } from 'fs';
import path from 'path';

export interface TemplateFile {
  path: string;
  content: string;
}

export interface RepoFile {
  path: string;
  content: string;
  sha: string;
}

export interface ChangedFile {
  path: string;
  content: string;
  oldSha?: string;
}

export interface SyncResult {
  success: boolean;
  prUrl?: string;
  existingPrUrl?: string;
  branchName?: string;
  filesChanged?: number;
  upToDate?: boolean;
}

/**
 * Recursively read all files from a directory
 */
async function readDirectoryRecursive(dir: string, baseDir: string = dir): Promise<{ relativePath: string; content: string }[]> {
  const files: { relativePath: string; content: string }[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively read subdirectories
      const subFiles = await readDirectoryRecursive(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      // Skip certain files
      if (entry.name === '.gitignore' || entry.name === 'pnpm-lock.yaml' || entry.name === 'package-lock.json') {
        continue;
      }

      // Read file content
      const content = await fs.readFile(fullPath, 'utf-8');
      const relativePath = path.relative(baseDir, fullPath);
      files.push({ relativePath, content });
    }
  }

  return files;
}

/**
 * Replace template variables in content
 */
function replaceTemplateVariables(
  content: string,
  variables: {
    PROJECT_NAME: string;
    PROJECT_SLUG: string;
    TURSO_DATABASE_URL: string;
    TURSO_AUTH_TOKEN: string;
    SITE_URL: string;
  }
): string {
  let result = content;

  // Replace all template variables
  result = result.replace(/\{\{PROJECT_NAME\}\}/g, variables.PROJECT_NAME);
  result = result.replace(/\{\{PROJECT_SLUG\}\}/g, variables.PROJECT_SLUG);
  result = result.replace(/\{\{TURSO_DATABASE_URL\}\}/g, variables.TURSO_DATABASE_URL);
  result = result.replace(/\{\{TURSO_AUTH_TOKEN\}\}/g, variables.TURSO_AUTH_TOKEN);
  result = result.replace(/\{\{SITE_URL\}\}/g, variables.SITE_URL);

  return result;
}

/**
 * Get template files for a project by fetching from GitHub at runtime
 * No API redeployment needed when templates change!
 */
export async function getTemplateFiles(projectName: string, slug: string, tursoDbUrl: string, tursoAuthToken?: string): Promise<TemplateFile[]> {
  const GITHUB_REPO = 'liteshowcms/templates';
  const GITHUB_BRANCH = 'main';
  const TEMPLATE_DIR = 'astro';

  console.log(`Fetching template files from GitHub: ${GITHUB_REPO}/${TEMPLATE_DIR}`);

  // Fetch the file tree from GitHub API
  const treeUrl = `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`;
  const treeResponse = await fetch(treeUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Liteshow-API',
    },
  });

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch template tree: ${treeResponse.statusText}`);
  }

  const treeData: any = await treeResponse.json();

  // Filter files that are in the astro directory
  const templateFiles = treeData.tree.filter((item: any) =>
    item.type === 'blob' &&
    item.path.startsWith(`${TEMPLATE_DIR}/`) &&
    !item.path.includes('.gitignore') &&
    !item.path.includes('pnpm-lock.yaml') &&
    !item.path.includes('package-lock.json') &&
    !item.path.includes('node_modules/')
  );

  console.log(`Found ${templateFiles.length} template files`);

  // Template variables to replace
  const variables = {
    PROJECT_NAME: projectName,
    PROJECT_SLUG: slug,
    TURSO_DATABASE_URL: `libsql://${tursoDbUrl}`,
    TURSO_AUTH_TOKEN: tursoAuthToken || '{{TURSO_AUTH_TOKEN}}',
    SITE_URL: '{{SITE_URL}}', // Will be set by deployment platform
  };

  // Fetch each file's content from raw.githubusercontent.com
  const files: TemplateFile[] = [];
  for (const file of templateFiles) {
    // Remove the template directory prefix from the path
    const relativePath = file.path.replace(`${TEMPLATE_DIR}/`, '');

    // Fetch raw file content
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${file.path}`;
    const contentResponse = await fetch(rawUrl);

    if (!contentResponse.ok) {
      console.error(`Failed to fetch ${file.path}: ${contentResponse.statusText}`);
      continue;
    }

    const content = await contentResponse.text();

    files.push({
      path: relativePath,
      content: replaceTemplateVariables(content, variables),
    });
  }

  console.log(`Successfully fetched and processed ${files.length} template files`);
  return files;
}

/**
 * DEPRECATED: Old string-based template function
 * Keeping for reference during migration
 */
export function getTemplateFilesOld(projectName: string, slug: string, tursoDbUrl: string): TemplateFile[] {
  const files: TemplateFile[] = [];

  // README.md
  files.push({
    path: 'README.md',
    content: `# ${projectName}

Built with [Liteshow](https://liteshow.io) - AI-First, Git-Powered CMS

## Quick Start

\`\`\`bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env and add:
# LITESHOW_PROJECT_SLUG=${slug}
# LITESHOW_API_URL=https://api.liteshow.io

# Run locally
pnpm dev
\`\`\`

Visit http://localhost:4321

## Deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=YOUR_REPO_URL)

### Environment Variables

Set these in your deployment platform:

- \`LITESHOW_PROJECT_SLUG\`: \`${slug}\`
- \`LITESHOW_API_URL\`: \`https://api.liteshow.io\`

## How It Works

This Astro site fetches your published content from the Liteshow API at build time. Liteshow handles all the database infrastructure - you just manage your content!
`,
  });

  // package.json
  files.push({
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
  });

  // astro.config.mjs
  files.push({
    path: 'astro.config.mjs',
    content: `import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
});
`,
  });

  // tailwind.config.mjs
  files.push({
    path: 'tailwind.config.mjs',
    content: `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
  });

  // .env.example
  files.push({
    path: '.env.example',
    content: `# Liteshow Configuration
LITESHOW_PROJECT_SLUG=${slug}
LITESHOW_API_URL=https://api.liteshow.io

# Or use local API for development:
# LITESHOW_API_URL=http://localhost:8000
`,
  });

  // .node-version
  files.push({
    path: '.node-version',
    content: `20
`,
  });

  // netlify.toml
  files.push({
    path: 'netlify.toml',
    content: `[build]
  command = "corepack enable && pnpm install && pnpm build"
  publish = "dist"
  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF"

[build.environment]
  NODE_VERSION = "20"
  NPM_FLAGS = "--version"
`,
  });

  // vercel.json
  files.push({
    path: 'vercel.json',
    content: `{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install"
}
`,
  });

  // src/env.d.ts
  files.push({
    path: 'src/env.d.ts',
    content: `/// <reference types="astro/client" />
`,
  });

  // src/lib/content-api.ts
  files.push({
    path: 'src/lib/content-api.ts',
    content: `const LITESHOW_API_URL = import.meta.env.LITESHOW_API_URL || 'https://api.liteshow.io';
const PROJECT_SLUG = import.meta.env.LITESHOW_PROJECT_SLUG;

export interface Page {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  blocks: any[];
}

export interface SiteSettings {
  siteTitle: string | null;
  siteDescription: string | null;
  faviconUrl: string | null;
}

export async function getAllPages(): Promise<Page[]> {
  try {
    const response = await fetch(\`\${LITESHOW_API_URL}/public/sites/\${PROJECT_SLUG}/pages\`);
    if (!response.ok) {
      console.error('Failed to fetch pages:', response.statusText);
      return [];
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching pages:', error);
    return [];
  }
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  try {
    const response = await fetch(\`\${LITESHOW_API_URL}/public/sites/\${PROJECT_SLUG}/pages/\${slug}\`);
    if (!response.ok) {
      console.error(\`Failed to fetch page \${slug}:\`, response.statusText);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(\`Error fetching page \${slug}:\`, error);
    return null;
  }
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const response = await fetch(\`\${LITESHOW_API_URL}/public/sites/\${PROJECT_SLUG}/settings\`);
    if (!response.ok) {
      console.error('Failed to fetch site settings:', response.statusText);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return null;
  }
}
`,
  });

  // src/layouts/BaseLayout.astro
  files.push({
    path: 'src/layouts/BaseLayout.astro',
    content: `---
import { getSiteSettings } from '../lib/content-api';

interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  siteSettings?: any;
}

const { title, description, ogImage, siteSettings } = Astro.props;

const fullTitle = siteSettings?.siteTitle
  ? \`\${title} - \${siteSettings.siteTitle}\`
  : title;

const pageDescription = description || siteSettings?.siteDescription || 'Built with Liteshow';
const faviconUrl = siteSettings?.faviconUrl;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{fullTitle}</title>
    <meta name="description" content={pageDescription} />

    {/* Open Graph */}
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={pageDescription} />
    {ogImage && <meta property="og:image" content={ogImage} />}
    <meta property="og:type" content="website" />

    {/* Twitter Card */}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={fullTitle} />
    <meta name="twitter:description" content={pageDescription} />
    {ogImage && <meta name="twitter:image" content={ogImage} />}

    {/* Favicon */}
    {faviconUrl && <link rel="icon" type="image/png" href={faviconUrl} />}

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body class="font-sans antialiased">
    <slot />
  </body>
</html>

<style is:global>
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
</style>
`,
  });

  // src/pages/index.astro
  files.push({
    path: 'src/pages/index.astro',
    content: `---
// Index page - render home page content directly or show a page list
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
  });

  // src/pages/[slug].astro
  files.push({
    path: 'src/pages/[slug].astro',
    content: `---
import { getAllPages, getPageBySlug, getSiteSettings } from '../lib/content-api';
import BaseLayout from '../layouts/BaseLayout.astro';
import HeroBlock from '../components/blocks/HeroBlock.astro';
import FeaturesBlock from '../components/blocks/FeaturesBlock.astro';
import TestimonialsBlock from '../components/blocks/TestimonialsBlock.astro';
import MarkdownBlock from '../components/blocks/MarkdownBlock.astro';
import CtaBlock from '../components/blocks/CtaBlock.astro';
import FaqBlock from '../components/blocks/FaqBlock.astro';

export async function getStaticPaths() {
  const pages = await getAllPages();
  return pages.map(page => ({
    params: { slug: page.slug },
  }));
}

const { slug } = Astro.params;
const page = await getPageBySlug(slug!);
const siteSettings = await getSiteSettings();

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
  title={page.title}
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
  });

  // src/pages/404.astro
  files.push({
    path: 'src/pages/404.astro',
    content: `---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getSiteSettings } from '../lib/content-api';

const siteSettings = await getSiteSettings();
---

<BaseLayout title="Page Not Found" siteSettings={siteSettings}>
  <main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
    <div class="text-center">
      <h1 class="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
      <p class="text-xl text-gray-600 dark:text-gray-300 mb-8">Page not found</p>
      <a
        href="/"
        class="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go Home
      </a>
    </div>
  </main>
</BaseLayout>
`,
  });

  // Block components
  const blockComponents = [
    {
      name: 'HeroBlock',
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
const { headline, subheadline, ctaText, ctaUrl } = content;
---

<section class="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20 lg:py-32">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-4xl lg:text-6xl font-bold mb-6">
        {headline}
      </h1>
      {subheadline && (
        <p class="text-xl lg:text-2xl mb-8 text-blue-100">
          {subheadline}
        </p>
      )}
      {ctaText && ctaUrl && (
        <a
          href={ctaUrl}
          class="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg"
        >
          {ctaText}
        </a>
      )}
    </div>
  </div>
</section>
`,
    },
    {
      name: 'FeaturesBlock',
      content: `---
interface Props {
  content: {
    title?: string;
    features: Array<{
      title: string;
      description: string;
      icon?: string;
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
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {features.map((feature) => (
        <div class="p-6 bg-gray-50 rounded-2xl hover:shadow-lg transition-shadow duration-200">
          {feature.icon && (
            <div class="text-4xl mb-4">{feature.icon}</div>
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
      name: 'TestimonialsBlock',
      content: `---
interface Props {
  content: {
    title?: string;
    testimonials: Array<{
      quote: string;
      author: string;
      role?: string;
      avatar?: string;
    }>;
  };
}

const { content } = Astro.props;
const { title, testimonials } = content;
---

<section class="py-20 bg-gradient-to-br from-gray-50 to-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    {title && (
      <h2 class="text-3xl lg:text-4xl font-bold text-center mb-16 text-gray-900">
        {title}
      </h2>
    )}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {testimonials.map((testimonial) => (
        <div class="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200">
          <p class="text-gray-700 mb-6 leading-relaxed italic">
            "{testimonial.quote}"
          </p>
          <div class="flex items-center">
            {testimonial.avatar && (
              <img
                src={testimonial.avatar}
                alt={testimonial.author}
                class="w-12 h-12 rounded-full mr-4"
              />
            )}
            <div>
              <div class="font-semibold text-gray-900">{testimonial.author}</div>
              {testimonial.role && (
                <div class="text-sm text-gray-600">{testimonial.role}</div>
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
      name: 'MarkdownBlock',
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
      name: 'CtaBlock',
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
      name: 'FaqBlock',
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
          <h3 class="text-xl font-semibold mb-3 text-gray-900">
            {faq.question}
          </h3>
          <p class="text-gray-700 leading-relaxed">
            {faq.answer}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>
`,
    },
  ];

  for (const block of blockComponents) {
    files.push({
      path: `src/components/blocks/${block.name}.astro`,
      content: block.content,
    });
  }

  return files;
}

/**
 * Fetch existing files from GitHub repository
 */
export async function fetchRepoFiles(
  repoFullName: string,
  paths: string[],
  token: string
): Promise<RepoFile[]> {
  const files: RepoFile[] = [];

  for (const path of paths) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/contents/${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        files.push({
          path,
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
          sha: data.sha,
        });
      }
    } catch (error) {
      // File doesn't exist or error fetching - skip it
      console.log(`Skipping file ${path}: not found in repo`);
    }
  }

  return files;
}

/**
 * Detect which files have changed between template and repo
 */
export function detectChangedFiles(
  templateFiles: TemplateFile[],
  repoFiles: RepoFile[]
): ChangedFile[] {
  const changedFiles: ChangedFile[] = [];

  for (const templateFile of templateFiles) {
    const repoFile = repoFiles.find((f) => f.path === templateFile.path);

    if (!repoFile) {
      // File doesn't exist in repo - it's new
      console.log(`  NEW: ${templateFile.path}`);
      changedFiles.push({
        path: templateFile.path,
        content: templateFile.content,
      });
    } else {
      // File exists - check if content changed
      const templateContent = templateFile.content.trim();
      const repoContent = repoFile.content.trim();

      if (templateContent !== repoContent) {
        console.log(`  CHANGED: ${templateFile.path}`);
        // Show first difference for key files
        if (templateFile.path === 'README.md' || templateFile.path.includes('deploy.yml')) {
          console.log(`    Template length: ${templateContent.length}, Repo length: ${repoContent.length}`);
          console.log(`    First 100 chars (template): ${templateContent.substring(0, 100)}`);
          console.log(`    First 100 chars (repo): ${repoContent.substring(0, 100)}`);
        }
        changedFiles.push({
          path: templateFile.path,
          content: templateFile.content,
          oldSha: repoFile.sha,
        });
      }
    }
  }

  return changedFiles;
}

/**
 * Check if a sync PR already exists
 */
export async function checkExistingSyncPR(
  repoFullName: string,
  token: string
): Promise<string | null> {
  try {
    // Get all open PRs and filter for template-sync branches
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/pulls?state=open`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (response.ok) {
      const pulls: any = await response.json();
      console.log('Checking for sync PR in repo:', repoFullName);
      console.log('Found open PRs:', pulls.map((pr: any) => ({ number: pr.number, branch: pr.head.ref, title: pr.title })));

      // Find PRs with branch name starting with liteshow/template-sync
      const syncPR = pulls.find((pr: any) =>
        pr.head.ref.startsWith('liteshow/template-sync')
      );

      if (syncPR) {
        console.log('Found sync PR:', syncPR.html_url);
        return syncPR.html_url;
      }
      console.log('No sync PR found');
    } else {
      console.error('Failed to fetch PRs:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error checking for existing PR:', error);
  }

  return null;
}

/**
 * Create a new sync branch in the repository
 */
export async function createSyncBranch(
  repoFullName: string,
  baseBranch: string,
  token: string
): Promise<string> {
  const branchName = `liteshow/template-sync-${Date.now()}`;

  // Get the SHA of the base branch
  const refResponse = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/ref/heads/${baseBranch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!refResponse.ok) {
    const errorBody = await refResponse.text();
    console.error('GitHub API error fetching base branch:', {
      status: refResponse.status,
      statusText: refResponse.statusText,
      repoFullName,
      baseBranch,
      body: errorBody,
    });

    // Only 401/403 are auth issues. 404 means branch doesn't exist
    if (refResponse.status === 401 || refResponse.status === 403) {
      const error = new Error(`GitHub authentication required. Unable to access repository (status ${refResponse.status}). Please re-authenticate with GitHub.`);
      (error as any).code = 'GITHUB_AUTH_REQUIRED';
      (error as any).requiresReauth = true;
      throw error;
    }

    throw new Error(`Failed to get base branch ref: ${refResponse.status} ${refResponse.statusText} - ${errorBody}`);
  }

  const refData: any = await refResponse.json();
  const baseSha = refData.object.sha;

  console.log('Base branch ref fetched successfully:', {
    repoFullName,
    baseBranch,
    baseSha,
    refType: refData.object.type,
  });

  // Create new branch
  console.log('Attempting to create branch:', {
    url: `https://api.github.com/repos/${repoFullName}/git/refs`,
    branchName,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  const createResponse = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/refs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    }
  );

  if (!createResponse.ok) {
    const errorBody = await createResponse.text();
    console.error('GitHub API error creating branch:', {
      status: createResponse.status,
      statusText: createResponse.statusText,
      repoFullName,
      branchName,
      body: errorBody,
    });

    // Parse the error to see if it's actually auth-related
    let parsedError;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {}

    // Only treat as auth error if it's genuinely auth/permission related
    // 404 might mean the SHA doesn't exist, not auth issue
    if (createResponse.status === 401 || createResponse.status === 403) {
      const error = new Error(`GitHub authentication required. Unable to access repository (status ${createResponse.status}). Please re-authenticate with GitHub.`);
      (error as any).code = 'GITHUB_AUTH_REQUIRED';
      (error as any).requiresReauth = true;
      throw error;
    }

    // For 404, show the actual GitHub error message
    const errorMsg = parsedError?.message || errorBody;
    throw new Error(`Failed to create branch: ${createResponse.status} ${createResponse.statusText} - ${errorMsg}`);
  }

  const branchData: any = await createResponse.json();
  console.log('✅ Branch created successfully:', {
    ref: branchData.ref,
    sha: branchData.object?.sha,
    url: branchData.url,
  });

  // Verify branch exists immediately after creation
  console.log('Verifying branch exists...');
  const verifyResponse = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/ref/heads/${branchName}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );
  console.log(`Branch verification: ${verifyResponse.status} ${verifyResponse.statusText}`);
  if (!verifyResponse.ok) {
    const errorBody = await verifyResponse.text();
    console.error('Branch verification failed:', errorBody);
  }

  return branchName;
}

/**
 * Sync template files using git clone approach
 * This clones the repo, creates a branch, applies changes, and pushes
 * Much more reliable than the GitHub API approach
 */
async function syncTemplateWithGitClone(
  repoFullName: string,
  baseBranch: string,
  changedFiles: ChangedFile[],
  token: string
): Promise<string> {
  const branchName = `liteshow/template-sync-${Date.now()}`;
  const tempDir = `/tmp/liteshow-sync-${Date.now()}`;

  console.log('\n=== SYNCING TEMPLATE WITH GIT CLONE ===');
  console.log('Repository:', repoFullName);
  console.log('Base branch:', baseBranch);
  console.log('Files to update:', changedFiles.length);
  console.log('Temp directory:', tempDir);
  console.log('Branch name:', branchName);

  try {
    // 1. Clone the repository with token authentication
    console.log('\n[1/6] Cloning repository...');
    const cloneUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;

    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const execFile = promisify((await import('child_process')).execFile);

    // Clone with shallow depth for faster cloning
    await execFile('git', [
      'clone',
      '--depth', '1',
      '--single-branch',
      '--branch', baseBranch,
      cloneUrl,
      tempDir
    ]);
    console.log('✅ Repository cloned successfully');

    // 2. Configure git user (required for commits)
    console.log('\n[2/6] Configuring git user...');
    await execFile('git', ['config', 'user.name', 'Liteshow Bot'], { cwd: tempDir });
    await execFile('git', ['config', 'user.email', 'bot@liteshow.io'], { cwd: tempDir });
    console.log('✅ Git user configured');

    // 3. Create and checkout new branch
    console.log('\n[3/6] Creating new branch...');
    await execFile('git', ['checkout', '-b', branchName], { cwd: tempDir });
    console.log(`✅ Branch '${branchName}' created and checked out`);

    // 4. Write template files to disk
    console.log('\n[4/6] Writing template files...');
    for (const file of changedFiles) {
      const filePath = path.join(tempDir, file.path);
      const fileDir = path.dirname(filePath);

      // Create directory if it doesn't exist
      await fs.mkdir(fileDir, { recursive: true });

      // Write file content
      await fs.writeFile(filePath, file.content, 'utf8');
      console.log(`  ✓ ${file.path}`);
    }
    console.log(`✅ ${changedFiles.length} files written`);

    // 5. Git add, commit
    console.log('\n[5/6] Committing changes...');
    await execFile('git', ['add', '.'], { cwd: tempDir });

    const commitMessage = `chore: sync with latest Liteshow template\n\nUpdated ${changedFiles.length} file(s):\n${changedFiles.map(f => `- ${f.path}`).join('\n')}`;
    await execFile('git', ['commit', '-m', commitMessage], { cwd: tempDir });
    console.log('✅ Changes committed');

    // 6. Push to remote
    console.log('\n[6/6] Pushing to remote...');
    await execFile('git', ['push', 'origin', branchName], { cwd: tempDir });
    console.log('✅ Branch pushed to remote');

    console.log('\n✅ Template sync completed successfully!');
    return branchName;

  } finally {
    // Clean up temp directory
    console.log('\n🧹 Cleaning up temp directory...');
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('✅ Temp directory cleaned up');
    } catch (error) {
      console.error('⚠️  Failed to clean up temp directory:', error);
      // Non-fatal - continue execution
    }
  }
}

/**
 * OLD IMPLEMENTATION - Update files in the sync branch using GitHub Git Data API
 * This creates blobs → tree → commit → updates ref in a single atomic operation
 * DEPRECATED: Replaced with git clone approach due to mysterious 404 errors
 */
export async function updateFilesInBranch(
  repoFullName: string,
  branchName: string,
  changedFiles: ChangedFile[],
  token: string
): Promise<void> {
  // Get the branch ref to find the latest commit SHA
  const refResponse = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/ref/heads/${branchName}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!refResponse.ok) {
    const errorBody = await refResponse.text();

    // Only 401/403 are auth issues
    if (refResponse.status === 401 || refResponse.status === 403) {
      const error = new Error(`GitHub authentication required. Unable to access repository (status ${refResponse.status}). Please re-authenticate with GitHub.`);
      (error as any).code = 'GITHUB_AUTH_REQUIRED';
      (error as any).requiresReauth = true;
      throw error;
    }

    throw new Error(`Failed to get branch ref: ${errorBody}`);
  }

  const refData: any = await refResponse.json();
  const baseCommitSha = refData.object.sha;

  // Get the base commit to find its tree SHA
  const commitResponse = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/commits/${baseCommitSha}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!commitResponse.ok) {
    const errorBody = await commitResponse.text();

    // Only 401/403 are auth issues
    if (commitResponse.status === 401 || commitResponse.status === 403) {
      const error = new Error(`GitHub authentication required. Unable to access repository (status ${commitResponse.status}). Please re-authenticate with GitHub.`);
      (error as any).code = 'GITHUB_AUTH_REQUIRED';
      (error as any).requiresReauth = true;
      throw error;
    }

    throw new Error(`Failed to get commit: ${errorBody}`);
  }

  const commitData: any = await commitResponse.json();
  const baseTreeSha = commitData.tree.sha;

  console.log('Retrieved base commit and tree:', {
    repoFullName,
    branchName,
    baseCommitSha,
    baseTreeSha,
    commitUrl: commitData.html_url,
  });

  // SKIP blob creation - use inline content in tree instead
  // GitHub allows us to provide content directly in tree items
  const tree: any[] = [];
  console.log(`\n=== CREATING TREE WITH INLINE CONTENT ===`);
  console.log(`Total changed files: ${changedFiles.length}`);
  console.log(`Using inline content instead of pre-created blobs`);

  for (const file of changedFiles) {
    console.log(`\nPreparing tree item for: ${file.path}`);
    console.log(`  Content length: ${file.content.length} bytes`);

    const treeItem = {
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: file.content, // Provide content directly instead of SHA
    };
    console.log(`  Tree item:`, JSON.stringify({ ...treeItem, content: `${file.content.substring(0, 50)}...` }, null, 2));
    tree.push(treeItem);
  }

  console.log(`\n✅ Prepared ${tree.length} tree items with inline content`);

  // Create a new tree with all the changed files
  console.log(`\n=== CREATING TREE ===`);
  console.log(`Repo: ${repoFullName}`);
  console.log(`Base tree SHA: ${baseTreeSha}`);
  console.log(`Number of tree items: ${tree.length}`);

  // Use base_tree to preserve existing files
  const treePayload: any = {
    base_tree: baseTreeSha,
    tree,
  };

  console.log(`\nTree payload (with inline content):`, JSON.stringify({
    base_tree: treePayload.base_tree,
    tree: tree.map(item => ({ ...item, content: item.content ? `${item.content.substring(0, 30)}...` : undefined }))
  }, null, 2));
  console.log(`\nPOST https://api.github.com/repos/${repoFullName}/git/trees`);

  const treeResponse = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/trees`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(treePayload),
    }
  );

  if (!treeResponse.ok) {
    const errorBody = await treeResponse.text();

    console.error('GitHub tree creation failed!', {
      status: treeResponse.status,
      statusText: treeResponse.statusText,
      errorBody,
      payloadSent: JSON.stringify(treePayload, null, 2),
      headers: {
        'x-ratelimit-remaining': treeResponse.headers.get('x-ratelimit-remaining'),
        'x-oauth-scopes': treeResponse.headers.get('x-oauth-scopes'),
      }
    });

    // Only 401/403 are auth issues
    if (treeResponse.status === 401 || treeResponse.status === 403) {
      const error = new Error(`GitHub authentication required. Unable to access repository (status ${treeResponse.status}). Please re-authenticate with GitHub.`);
      (error as any).code = 'GITHUB_AUTH_REQUIRED';
      (error as any).requiresReauth = true;
      throw error;
    }

    throw new Error(`Failed to create tree: ${errorBody}`);
  }

  const treeData: any = await treeResponse.json();

  // Create a single commit with all changes
  const newCommitResponse = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/commits`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore: sync with latest Liteshow template\n\nUpdated ${changedFiles.length} file(s):\n${changedFiles.map(f => `- ${f.path}`).join('\n')}`,
        tree: treeData.sha,
        parents: [baseCommitSha],
      }),
    }
  );

  if (!newCommitResponse.ok) {
    const errorBody = await newCommitResponse.text();

    // Only 401/403 are auth issues
    if (newCommitResponse.status === 401 || newCommitResponse.status === 403) {
      const error = new Error(`GitHub authentication required. Unable to access repository (status ${newCommitResponse.status}). Please re-authenticate with GitHub.`);
      (error as any).code = 'GITHUB_AUTH_REQUIRED';
      (error as any).requiresReauth = true;
      throw error;
    }

    throw new Error(`Failed to create commit: ${errorBody}`);
  }

  const newCommitData: any = await newCommitResponse.json();

  // Update the branch ref to point to the new commit
  const updateRefResponse = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branchName}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sha: newCommitData.sha,
      }),
    }
  );

  if (!updateRefResponse.ok) {
    const errorBody = await updateRefResponse.text();

    // Only 401/403 are auth issues
    if (updateRefResponse.status === 401 || updateRefResponse.status === 403) {
      const error = new Error(`GitHub authentication required. Unable to access repository (status ${updateRefResponse.status}). Please re-authenticate with GitHub.`);
      (error as any).code = 'GITHUB_AUTH_REQUIRED';
      (error as any).requiresReauth = true;
      throw error;
    }

    throw new Error(`Failed to update ref: ${errorBody}`);
  }
}

/**
 * Create a pull request with the sync changes
 */
export async function createPullRequest(
  repoFullName: string,
  branchName: string,
  baseBranch: string,
  filesChanged: number,
  changeLog: string,
  token: string
): Promise<string> {
  const title = '🔄 Sync with Latest Liteshow Template';
  const body = `# 🔄 Template Sync: Latest Liteshow Updates

This PR updates your site with the latest Liteshow template improvements.

## Files Changed

${changeLog}

## Review Checklist

- [ ] Review changes to config files (package.json, astro.config.mjs)
- [ ] Check for conflicts with your customizations
- [ ] Test locally before merging
- [ ] Merge when ready or close if unwanted

## Need Help?

Questions? [Contact Liteshow Support](https://liteshow.io/support)

---
🤖 Generated by Liteshow Template Sync`;

  const response = await fetch(
    `https://api.github.com/repos/${repoFullName}/pulls`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: baseBranch,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();

    // Only 401/403 are auth issues
    if (response.status === 401 || response.status === 403) {
      const error = new Error(`GitHub authentication required. Unable to access repository (status ${response.status}). Please re-authenticate with GitHub.`);
      (error as any).code = 'GITHUB_AUTH_REQUIRED';
      (error as any).requiresReauth = true;
      throw error;
    }

    throw new Error(`Failed to create PR: ${errorBody}`);
  }

  const data: any = await response.json();
  return data.html_url;
}

/**
 * Main function: Sync template files to a project's GitHub repository
 * Uses local git clones to compare - no API caching issues!
 */
export async function syncTemplateToRepo(
  projectId: string,
  userId: string
): Promise<SyncResult> {
  const tempBaseDir = `/tmp/liteshow-template-sync-${Date.now()}`;

  try {
    // Get project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project || project.userId !== userId) {
      throw new Error('Project not found');
    }

    if (!project.githubRepoUrl || !project.githubRepoName) {
      throw new Error('GitHub repository not connected');
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get GitHub token
    const token = await getGitHubTokenForProject(project, user);
    if (!token) {
      throw new Error('Failed to get GitHub token');
    }

    const repoFullName = project.githubRepoName;

    console.log('\n=== TEMPLATE SYNC WITH LOCAL GIT COMPARISON ===');
    console.log('Project:', projectId);
    console.log('Repository:', repoFullName);
    console.log('Temp dir:', tempBaseDir);

    // Check if sync PR already exists via API (lightweight check)
    const existingPrUrl = await checkExistingSyncPR(repoFullName, token);
    if (existingPrUrl) {
      console.log('Existing sync PR found:', existingPrUrl);
      return {
        success: false,
        existingPrUrl,
      };
    }

    const { promisify } = await import('util');
    const execFile = promisify((await import('child_process')).execFile);

    // 1. Clone templates repo
    console.log('\n[1/4] Cloning templates repository...');
    const templatesDir = `${tempBaseDir}/templates`;
    await execFile('git', [
      'clone',
      '--depth', '1',
      '--single-branch',
      '--branch', 'main',
      'https://github.com/liteshowcms/templates.git',
      templatesDir
    ]);
    console.log('✅ Templates repo cloned');

    // 2. Clone user's repo
    console.log('\n[2/4] Cloning user repository...');
    const userRepoDir = `${tempBaseDir}/user-repo`;
    const cloneUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;

    await execFile('git', [
      'clone',
      '--depth', '1',
      '--single-branch',
      cloneUrl,
      userRepoDir
    ]);
    console.log('✅ User repo cloned');

    // Get default branch name
    const { stdout: branchOutput } = await execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: userRepoDir });
    const baseBranch = branchOutput.trim();
    console.log('Base branch:', baseBranch);

    // 3. Process template files with variable replacement
    console.log('\n[3/4] Processing template files...');
    const templateSourceDir = `${templatesDir}/astro`;
    const variables = {
      PROJECT_NAME: project.name,
      PROJECT_SLUG: project.slug,
      TURSO_DATABASE_URL: `libsql://${project.tursoDbUrl}`,
      TURSO_AUTH_TOKEN: project.tursoDbToken || '{{TURSO_AUTH_TOKEN}}',
      SITE_URL: '{{SITE_URL}}',
    };

    // Get list of template files
    const { stdout: filesOutput } = await execFile('find', ['.', '-type', 'f'], { cwd: templateSourceDir });
    const templateFiles = filesOutput
      .split('\n')
      .filter(f => f &&
        !f.includes('.git/') &&        // Exclude .git/ directory but include .github/
        !f.includes('node_modules') &&
        !f.includes('.gitignore') &&
        !f.includes('pnpm-lock.yaml') &&
        !f.includes('package-lock.json')
      )
      .map(f => f.replace('./', ''));

    console.log(`Found ${templateFiles.length} template files`);

    // Copy and process each file
    for (const file of templateFiles) {
      const sourcePath = `${templateSourceDir}/${file}`;
      const destPath = `${userRepoDir}/${file}`;

      const content = await fs.readFile(sourcePath, 'utf8');
      const processedContent = replaceTemplateVariables(content, variables);

      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, processedContent, 'utf8');
    }
    console.log('✅ Files processed');

    // 4. Check for changes using git
    console.log('\n[4/4] Checking for changes...');
    await execFile('git', ['add', '.'], { cwd: userRepoDir });

    const { stdout: statusOutput } = await execFile('git', ['status', '--porcelain'], { cwd: userRepoDir });

    if (!statusOutput.trim()) {
      console.log('✅ No changes - template is up to date');
      return {
        success: true,
        upToDate: true,
      };
    }

    console.log('\n📝 Changes detected:');
    console.log(statusOutput);

    // Show diff summary
    try {
      const { stdout: diffOutput } = await execFile('git', ['diff', '--cached', '--stat'], { cwd: userRepoDir });
      console.log('\nDiff summary:');
      console.log(diffOutput);
    } catch (e) {
      // Ignore diff errors
    }

    // Create branch and push
    const branchName = `liteshow/template-sync-${Date.now()}`;
    console.log('\n[5/5] Creating branch and pushing...');

    await execFile('git', ['config', 'user.name', 'Liteshow Bot'], { cwd: userRepoDir });
    await execFile('git', ['config', 'user.email', 'bot@liteshow.io'], { cwd: userRepoDir });
    await execFile('git', ['checkout', '-b', branchName], { cwd: userRepoDir });

    const commitMessage = `chore: sync with latest Liteshow template\n\nUpdated from liteshowcms/templates`;
    await execFile('git', ['commit', '-m', commitMessage], { cwd: userRepoDir });
    await execFile('git', ['push', 'origin', branchName], { cwd: userRepoDir });

    console.log('✅ Branch pushed');

    // Count changed files for changelog
    const changedFilesList = statusOutput.trim().split('\n');
    const changeLog = changedFilesList
      .map(line => {
        const parts = line.trim().split(/\s+/);
        const status = parts[0];
        const file = parts[1];
        if (status.includes('M')) return `- \`${file}\` (updated)`;
        if (status.includes('A')) return `- \`${file}\` (new)`;
        if (status.includes('D')) return `- \`${file}\` (removed)`;
        return `- \`${file}\``;
      })
      .join('\n');

    // Create PR
    const prUrl = await createPullRequest(
      repoFullName,
      branchName,
      baseBranch,
      changedFilesList.length,
      changeLog,
      token
    );

    console.log('\n✅ Template sync complete!');
    console.log('PR URL:', prUrl);

    return {
      success: true,
      prUrl,
      branchName,
      filesChanged: changedFilesList.length,
    };

  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');
    try {
      await fs.rm(tempBaseDir, { recursive: true, force: true });
      console.log('✅ Cleanup complete');
    } catch (error) {
      console.error('⚠️  Cleanup failed:', error);
    }
  }
}
