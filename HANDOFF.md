# Handoff: LiteShow Phase 2.3 Complete - Ready for Phase 3

**Generated**: 2025-12-30 04:35 UTC
**Branch**: main
**Status**: Ready for Next Phase

## Goal

Build LiteShow, an AI-first, Git-powered CMS. Currently completed through Phase 2.3 (Astro frontend rendering). Next step is Phase 3: Deployment Automation - automatically deploy each project to Vercel/Netlify/Cloudflare Pages with environment variables configured.

## Completed

- [x] Phase 1: Core infrastructure (PostgreSQL + Turso, Better Auth, Next.js dashboard, Hono API)
- [x] Phase 2.1: Project creation flow with automated Turso database provisioning and GitHub repo creation
- [x] Phase 2.2: Content management - pages and blocks CRUD with drag-and-drop, block editing UI
- [x] Phase 2.3: Astro SSR frontend rendering content from Turso databases
- [x] All block types implemented: Hero, Features, Testimonials, CTA, Markdown, FAQ
- [x] Beautiful Tailwind components with responsive design
- [x] Cloudflare tunnel configured for local development (devpi-4321.shmob.xyz → localhost:4321)
- [x] Project README and CLAUDE.md documentation updated

## Not Yet Done

- [ ] Phase 3: Deployment automation (GitHub Actions, Vercel/Netlify/Cloudflare Pages deployment)
- [ ] Phase 2.4: Git sync (push content changes to GitHub on publish)
- [ ] Phase 4: AI content assistant (Claude API integration)
- [ ] Phase 5: SEO & domain management
- [ ] Phase 6: Polish & production deployment

## Failed Approaches (Don't Repeat These)

**Attempting to use `output: 'static'` in Astro config**:
- Error: `GetStaticPathsRequired - getStaticPaths() function is required for dynamic routes`
- Why it failed: Database-driven dynamic routes require server-side rendering
- Solution: Changed to `output: 'server'` in `apps/sites/astro.config.mjs`

**Cloudflare tunnel blocking requests initially**:
- Error: `Blocked request. This host ("devpi-4321.shmob.xyz") is not allowed`
- Why it failed: Vite (used by Astro) has allowedHosts security check
- Solution: Added `vite.server.allowedHosts: ['devpi-4321.shmob.xyz']` to Astro config

**Pages showing 404 even though they existed**:
- Issue: Page was found in database but status was `draft` not `published`
- Behavior: Code correctly redirects non-published pages to 404 for security
- Solution: User must publish pages from dashboard UI for them to be visible

**Trying to query PostgreSQL from Node script for credentials**:
- Error: Module not found errors for postgres/drizzle-orm
- Why it failed: Dependencies not in correct scope, overcomplicated approach
- Solution: Added UI card in dashboard to display Turso credentials with copy button

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Pure Tailwind CSS for Astro site (no shadcn) | Better performance, simpler architecture for public sites |
| Separate Turso database per project | Multi-tenant isolation, independent scaling |
| Server-side rendering for Astro | Required for database-driven dynamic routes |
| Cloudflare tunnel for dev testing | Easy remote testing without deploying |
| Inter font from Google Fonts | Modern, professional typography |

## Current State

**Working**:
- Full content management flow: create project → create pages → add blocks → publish → view live
- Dashboard on port 3001 (devpi-3001.shmob.xyz)
- API on port 8000 (devpi-3008.shmob.xyz)
- Astro site on port 4321 (devpi-4321.shmob.xyz)
- All block types render beautifully with Tailwind styling

**Broken**: Nothing currently broken

**Uncommitted Changes**: None (all changes committed and pushed)

## Files to Know

| File | Why It Matters |
|------|----------------|
| `apps/sites/astro.config.mjs` | Astro configuration - has server mode and allowed hosts |
| `apps/sites/src/pages/[slug].astro` | Dynamic page routing - fetches from Turso and renders blocks |
| `apps/sites/src/lib/db.ts` | Database utilities for fetching pages and blocks |
| `apps/sites/src/components/blocks/*.astro` | All 6 block type components |
| `packages/db/src/content-schema.ts` | Content database schema (pages and blocks tables) |
| `apps/dashboard/src/app/dashboard/projects/[id]/page.tsx` | Project detail page with Turso credentials display |
| `apps/api/src/routes/projects.ts` | Project CRUD API including Turso provisioning |
| `/etc/cloudflared/config.yml` | Cloudflare tunnel configuration |
| `README.md` | Up-to-date progress tracking |
| `CLAUDE.md` | Project-specific AI assistant instructions |

## Code Context

**Astro page fetches content from project-specific Turso database**:
```typescript
// apps/sites/src/pages/[slug].astro
const tursoDbUrl = import.meta.env.TURSO_DB_URL;
const tursoDbToken = import.meta.env.TURSO_DB_TOKEN;
const { slug } = Astro.params;

const db = getProjectDb({ tursoDbUrl, tursoDbToken });
const page = await getPageBySlug(db, slug);

// Only published pages are visible
if (!page || page.status !== 'published') {
  return Astro.redirect('/404');
}
```

**Database schema for content**:
```typescript
// packages/db/src/content-schema.ts
export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'), // 'draft' or 'published'
  // ... SEO fields
});

export const blocks = sqliteTable('blocks', {
  id: text('id').primaryKey(),
  pageId: text('page_id').notNull().references(() => pages.id),
  type: text('type').notNull(), // 'hero', 'features', 'testimonials', etc.
  order: integer('order').notNull(),
  content: text('content', { mode: 'json' }).notNull(), // JSON object
});
```

**Block content interfaces**:
```typescript
interface HeroBlockContent {
  headline: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
}

interface FeaturesBlockContent {
  features: Array<{
    icon?: string;
    title: string;
    description: string;
  }>;
}
// See packages/db/src/content-schema.ts for all block types
```

**Project creation API response**:
```json
// POST /api/projects
{
  "id": "uuid",
  "name": "My Project",
  "slug": "my-project",
  "tursoDbUrl": "project-name.turso.io",
  "tursoDbToken": "eyJ...",
  "githubRepoUrl": "https://github.com/username/my-project"
}
```

## Resume Instructions

**To continue development:**

1. **Verify dev servers are running:**
   ```bash
   cd /home/perryraskin/Development/liteshow
   pnpm dev
   ```
   - Dashboard: http://localhost:3001 or https://devpi-3001.shmob.xyz
   - API: http://localhost:8000 or https://devpi-3008.shmob.xyz
   - Astro site: http://localhost:4321 or https://devpi-4321.shmob.xyz

2. **Test the full flow:**
   - Visit dashboard, create a new project (takes ~30s for Turso provisioning)
   - Navigate to project detail page → "Manage Pages"
   - Create a page (e.g., slug: "home")
   - Add blocks (try Hero block with some content)
   - **Important**: Change page status to "published" (not draft!)
   - Visit: https://devpi-4321.shmob.xyz/home
   - Expected: See your content rendered beautifully

3. **Start Phase 3 (Deployment Automation):**
   - Read `CLAUDE.md` phase completion protocol
   - Options to implement:
     - **Option A**: Vercel API integration (recommended - easiest)
     - **Option B**: Netlify API
     - **Option C**: Cloudflare Pages API
   - Key requirements:
     - Auto-deploy when project is created
     - Set TURSO_DB_URL and TURSO_DB_TOKEN as environment variables
     - Return live URL to store in projects table
     - Optional: Redeploy webhook when content is published

## Setup Required

**Environment variables** (already configured):
- Dashboard: `apps/dashboard/.env` - DATABASE_URL, BETTER_AUTH_SECRET, GITHUB_CLIENT_ID/SECRET
- API: `apps/api/.env` - DATABASE_URL, BETTER_AUTH_SECRET, TURSO_ORG_NAME, TURSO_API_TOKEN, GITHUB_ACCESS_TOKEN
- Sites: `apps/sites/.env` - TURSO_DB_URL, TURSO_DB_TOKEN (project-specific)

**Services running**:
- PostgreSQL (main database)
- Cloudflare tunnel (cloudflared.service) - routes *.shmob.xyz to localhost

**Test credentials**:
- GitHub OAuth is configured for authentication
- User must sign in via GitHub to access dashboard

## Multi-Tenant Architecture

**Critical**: Each project is completely isolated:
- Separate Turso SQLite database per project
- Separate GitHub repository per project
- Separate deployment per project (when Phase 3 complete)
- Projects table in PostgreSQL tracks ownership and credentials

**The Astro site is NOT multi-tenant** - it's a template that gets deployed once per project with its own environment variables pointing to that project's Turso database.

## Warnings

- **Don't commit `.env` files** - they contain secrets
- **Turso URLs must use `libsql://` protocol**, not `https://`
- **Astro site requires server mode** - static mode won't work for database-driven content
- **Pages must be published** - draft pages return 404 (this is intentional security)
- **Cloudflare tunnel config** is at `/etc/cloudflared/config.yml` - requires sudo to edit
- **Debug logging in [slug].astro** - remove console.log statements before production
- **pnpm workspace protocol** - use `@liteshow/*` imports, not relative paths across packages

## Next Steps Recommendation

**Phase 3: Deployment Automation** is the logical next step because:
1. Users can create projects and content, but can't share them publicly yet
2. Currently requires manual `.env` setup per project (not scalable)
3. Vercel API is straightforward to integrate
4. Provides immediate value - instant live URLs

**Suggested approach**:
1. Add Vercel API integration to `apps/api/src/routes/projects.ts`
2. On project creation: call Vercel API to create deployment
3. Pass TURSO_DB_URL and TURSO_DB_TOKEN as environment variables
4. Store deployment URL in projects table
5. Display live URL in dashboard

See `README.md` Phase 3 checklist for full requirements.
