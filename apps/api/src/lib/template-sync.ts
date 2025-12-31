import { db } from '@liteshow/db';
import { projects, users } from '@liteshow/db';
import { eq } from 'drizzle-orm';
import { getGitHubTokenForProject } from './github-token';

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
}

/**
 * Get template files for a project
 * This reuses the template generation logic from createDeploymentFiles
 */
export function getTemplateFiles(projectName: string, slug: string, tursoDbUrl: string): TemplateFile[] {
  const files: TemplateFile[] = [];

  // README.md
  files.push({
    path: 'README.md',
    content: `# ${projectName}

Built with [LiteShow](https://liteshow.io) - AI-First, Git-Powered CMS

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

This Astro site fetches your published content from the LiteShow API at build time. LiteShow handles all the database infrastructure - you just manage your content!
`,
  });

  // package.json
  files.push({
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
    content: `# LiteShow Configuration
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
  command = "pnpm install && pnpm build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
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
    const response = await fetch(\`\${LITESHOW_API_URL}/public/\${PROJECT_SLUG}/pages\`);
    if (!response.ok) {
      console.error('Failed to fetch pages:', response.statusText);
      return [];
    }
    const data = await response.json();
    return data.pages || [];
  } catch (error) {
    console.error('Error fetching pages:', error);
    return [];
  }
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  try {
    const response = await fetch(\`\${LITESHOW_API_URL}/public/\${PROJECT_SLUG}/pages/\${slug}\`);
    if (!response.ok) {
      console.error(\`Failed to fetch page \${slug}:\`, response.statusText);
      return null;
    }
    const data = await response.json();
    return data.page;
  } catch (error) {
    console.error(\`Error fetching page \${slug}:\`, error);
    return null;
  }
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const response = await fetch(\`\${LITESHOW_API_URL}/public/\${PROJECT_SLUG}/settings\`);
    if (!response.ok) {
      console.error('Failed to fetch site settings:', response.statusText);
      return null;
    }
    const data = await response.json();
    return data.settings;
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

const pageDescription = description || siteSettings?.siteDescription || 'Built with LiteShow';
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
              Create and publish pages in your LiteShow dashboard to get started.
            </p>
          </div>
        )}

        <div class="text-center mt-12 text-sm text-gray-500 dark:text-gray-400">
          Built with <span class="font-semibold">LiteShow</span> - AI-first, Git-powered CMS
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
    title: string;
    subtitle?: string;
    ctaText?: string;
    ctaUrl?: string;
  };
}

const { content } = Astro.props;
const { title, subtitle, ctaText, ctaUrl } = content;
---

<section class="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20 lg:py-32">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-4xl lg:text-6xl font-bold mb-6">
        {title}
      </h1>
      {subtitle && (
        <p class="text-xl lg:text-2xl mb-8 text-blue-100">
          {subtitle}
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
    title: string;
    description?: string;
    ctaText: string;
    ctaUrl: string;
  };
}

const { content } = Astro.props;
const { title, description, ctaText, ctaUrl } = content;
---

<section class="py-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
    <h2 class="text-3xl lg:text-5xl font-bold mb-6">
      {title}
    </h2>
    {description && (
      <p class="text-xl mb-8 text-blue-100 max-w-2xl mx-auto">
        {description}
      </p>
    )}
    <a
      href={ctaUrl}
      class="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg text-lg"
    >
      {ctaText}
    </a>
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
      changedFiles.push({
        path: templateFile.path,
        content: templateFile.content,
      });
    } else {
      // File exists - check if content changed
      if (templateFile.content.trim() !== repoFile.content.trim()) {
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
    const [owner, repo] = repoFullName.split('/');
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/pulls?state=open&head=${owner}:liteshow/template-sync`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (response.ok) {
      const pulls: any = await response.json();
      if (pulls.length > 0) {
        return pulls[0].html_url;
      }
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
    throw new Error(`Failed to get base branch ref: ${refResponse.statusText}`);
  }

  const refData: any = await refResponse.json();
  const baseSha = refData.object.sha;

  // Create new branch
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
    throw new Error(`Failed to create branch: ${createResponse.statusText}`);
  }

  return branchName;
}

/**
 * Update files in the sync branch
 */
export async function updateFilesInBranch(
  repoFullName: string,
  branchName: string,
  changedFiles: ChangedFile[],
  token: string
): Promise<void> {
  for (const file of changedFiles) {
    const content = Buffer.from(file.content).toString('base64');

    const body: any = {
      message: `Update ${file.path}`,
      content,
      branch: branchName,
    };

    if (file.oldSha) {
      body.sha = file.oldSha;
    }

    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/contents/${file.path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update ${file.path}: ${error}`);
    }
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
  const title = '🔄 Sync with Latest LiteShow Template';
  const body = `# 🔄 Template Sync: Latest LiteShow Updates

This PR updates your site with the latest LiteShow template improvements.

## Files Changed

${changeLog}

## Review Checklist

- [ ] Review changes to config files (package.json, astro.config.mjs)
- [ ] Check for conflicts with your customizations
- [ ] Test locally before merging
- [ ] Merge when ready or close if unwanted

## Need Help?

Questions? [Contact LiteShow Support](https://liteshow.io/support)

---
🤖 Generated by LiteShow Template Sync`;

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
    const error = await response.text();
    throw new Error(`Failed to create PR: ${error}`);
  }

  const data: any = await response.json();
  return data.html_url;
}

/**
 * Main function to sync template to a project's repository
 */
export async function syncTemplateToRepo(
  projectId: string,
  userId: string
): Promise<SyncResult> {
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

  // Get repo full name (owner/repo)
  const repoFullName = project.githubRepoName;
  console.log('Syncing template for repo:', {
    projectId,
    repoFullName,
    githubAuthType: project.githubAuthType,
    hasToken: !!token,
  });

  // Check if sync PR already exists
  const existingPrUrl = await checkExistingSyncPR(repoFullName, token);
  if (existingPrUrl) {
    return {
      success: false,
      existingPrUrl,
    };
  }

  // Get template files
  const templateFiles = getTemplateFiles(
    project.name,
    project.slug,
    project.tursoDbUrl
  );

  // Fetch existing files from repo
  const repoPaths = templateFiles.map((f) => f.path);
  const repoFiles = await fetchRepoFiles(repoFullName, repoPaths, token);

  // Detect changed files
  const changedFiles = detectChangedFiles(templateFiles, repoFiles);

  if (changedFiles.length === 0) {
    throw new Error('No template changes detected');
  }

  // Get default branch
  const repoResponse = await fetch(
    `https://api.github.com/repos/${repoFullName}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!repoResponse.ok) {
    const errorBody = await repoResponse.text();
    console.error('GitHub API error fetching repo info:', {
      status: repoResponse.status,
      statusText: repoResponse.statusText,
      repoFullName,
      body: errorBody,
    });
    throw new Error(`Failed to fetch repository info: ${repoResponse.status} ${repoResponse.statusText} - ${errorBody}`);
  }

  const repoData: any = await repoResponse.json();
  const baseBranch = repoData.default_branch || 'main';

  // Create sync branch
  const branchName = await createSyncBranch(repoFullName, baseBranch, token);

  // Update files in branch
  await updateFilesInBranch(repoFullName, branchName, changedFiles, token);

  // Generate changelog
  const changeLog = changedFiles
    .map((f) => `- \`${f.path}\`${f.oldSha ? ' (updated)' : ' (new)'}`)
    .join('\n');

  // Create PR
  const prUrl = await createPullRequest(
    repoFullName,
    branchName,
    baseBranch,
    changedFiles.length,
    changeLog,
    token
  );

  return {
    success: true,
    prUrl,
    branchName,
    filesChanged: changedFiles.length,
  };
}
