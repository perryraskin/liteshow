# LiteShow

> AI-First, SEO-Optimized, Git-Powered CMS

LiteShow is a content management system that combines a powerful AI content assistant with a robust, developer-friendly architecture, ensuring every site is perfectly optimized for SEO from day one.

---

## 🚧 MVP Development Progress

**Current Status**: Phase 3.2 Complete ✅ | API Deployed to Production 🚀

### Phase 1: Core Infrastructure & Authentication ✅
- [x] Database setup with Drizzle ORM (PostgreSQL + Turso)
- [x] Better Auth with GitHub OAuth (repo scope)
- [x] Next.js dashboard with Tailwind CSS
- [x] Hono API server with health checks
- [x] Shared UI component library
- [x] TypeScript configuration across monorepo
- [x] All packages build successfully

### Phase 2.1: Project Creation Flow ✅
- [x] Project creation form with validation
- [x] Automated Turso database provisioning per project
- [x] GitHub repository creation with initial commit
- [x] Database schema initialization (pages and blocks tables)
- [x] Project detail page with configuration display

### Phase 2.2: Content Management ✅
- [x] Page CRUD operations (create, read, update, delete)
- [x] Block CRUD operations with drag-and-drop ordering
- [x] Block types: hero, features, testimonials, markdown, CTA, FAQ
- [x] Content editor UI with block management
- [x] Block editing with JSON content forms
- [x] Draft/published status workflow
- [x] shadcn/ui components with dark mode

### Phase 2.3: Astro Frontend ✅
- [x] Astro SSR site with server-side rendering
- [x] Dynamic routing via [slug].astro
- [x] Beautiful block components with Tailwind CSS
- [x] Database integration (fetch from project Turso)
- [x] Published-only page visibility
- [x] Responsive mobile-first design
- [x] Inter font and modern UI styling

### Phase 2.4: Remaining Content Features ✅
- [x] Git sync for content changes (push to GitHub on publish)
- [x] Activity feed integration
- [x] Content versioning (snapshots on update, history, restore)
- [x] Draft/publish workflow (unpublished changes indicator, explicit publish)
- [x] Novel editor integration for markdown blocks and blog pages

### Phase 3: Deployment Setup ✅
- [x] Public content API for fetching published content
- [x] Complete Astro site auto-generated in GitHub repos
- [x] All 6 block components (Hero, Features, Testimonials, CTA, Markdown, FAQ)
- [x] Static site generation (SSG) for optimal performance
- [x] Automated deployment config files (netlify.toml, vercel.json, package.json)
- [x] "Deploy to X" buttons in README for one-click setup
- [x] Astro site fetches content from API at build time (no database credentials needed)
- [x] Simplified deployment with env vars (LITESHOW_PROJECT_SLUG, LITESHOW_API_URL)
- [x] Auto-deploy on publish via platform Git integration (no GitHub Actions needed)

### Phase 3.1: Dependency Updates & Cleanup ✅
- [x] Updated Next.js 14 → 16, React 18 → 19
- [x] Updated Astro 4 → 5 with Node adapter
- [x] Updated Drizzle ORM 0.29 → 0.45
- [x] Updated Hono 4.0 → 4.11
- [x] Fixed all dependency conflicts
- [x] Cleaned up outdated documentation files
- [x] Verified all builds and deployments working

### Phase 3.2: API Production Deployment ✅
- [x] Deployed LiteShow API to Fly.io at `liteshow-api.fly.dev`
- [x] Configured custom domain `api.liteshow.io` (SSL pending)
- [x] Set up GitHub integration for automated deployments
- [x] Implemented lazy database initialization for improved startup
- [x] Routes simplified (no `/api` prefix needed)
- [x] Health checks and monitoring configured
- [x] Multi-stage Docker build with tsx runtime
- [x] Environment variables secured in Fly.io secrets

### Phase 3.3: GitHub App Integration & Deployment Monitoring 📋
- [ ] Create LiteShow GitHub App with deployment permissions
- [ ] User installs GitHub App to grant deployment access
- [ ] Monitor GitHub Deployments API for all platforms (Netlify, Vercel, Cloudflare Pages)
- [ ] Display deployment status in dashboard (Building / Success / Failed / Not Deployed)
- [ ] Show deployment history with timestamps and commit SHAs
- [ ] Quick link to deployed site from dashboard
- [ ] Support for multiple deployments (preview/production)

### Phase 3.5: Advanced Deployment Options 📋
- [ ] Self-hosting mode (direct Turso connection for users who want full control)
- [ ] SQLite database export/download feature
- [ ] Option to BYO database (bring your own Turso/SQLite instance)
- [ ] Migration tool to export project and all content
- [ ] Documentation for running LiteShow infrastructure yourself

### Phase 4: AI Content Assistant 📋
- [ ] Anthropic Claude API integration
- [ ] Natural language content generation
- [ ] Block generation from AI prompts
- [ ] Preview/approve workflow for AI changes
- [ ] AI chat interface in dashboard
- [ ] Diff view for content changes

### Phase 5: SEO & Domain Management 📋
- [ ] SEO optimization (meta tags, sitemaps, structured data)
- [ ] Custom domain configuration
- [ ] Domain verification system
- [ ] SSL certificate management
- [ ] Analytics integration

### Phase 6: Polish & Production 📋
- [ ] Complete activity logging system
- [ ] Activity feed UI with filtering
- [ ] Error handling and validation improvements
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Documentation completion
- [ ] Production deployment

**Legend**: ✅ Complete | 🚧 In Progress | 📋 Planned

---

## Features

- **AI-Powered Content Creation**: Natural language interface for content management
- **Block-Based Content Model**: Flexible, reusable content blocks
- **SEO-First**: Built with Astro for best-in-class performance and SEO
- **Git-Backed**: All content version-controlled in your own GitHub repository
- **Multi-Tenant**: Each project gets its own isolated database
- **Custom Domains**: Easy custom domain configuration

## Architecture

This is a monorepo containing:

- **apps/dashboard**: Next.js user dashboard (to be deployed to Vercel)
- **apps/sites**: Astro site generator (user sites deployed to Netlify/Vercel/Cloudflare Pages)
- **apps/api**: Hono backend API (deployed to Fly.io)
- **packages/ui**: Shared React components
- **packages/auth**: Better Auth configuration
- **packages/db**: Drizzle ORM schema and client
- **packages/config**: Shared configuration

### Deployment Strategy

- **API**: Production deployment at `api.liteshow.io` (Fly.io)
  - Automated deployments via GitHub integration
  - Lazy database initialization for fast startup
  - Health monitoring and auto-scaling
  - Environment variables managed via Fly.io secrets

- **Dashboard**: Ready for Vercel deployment at `app.liteshow.io`
  - All API calls updated to work without `/api` prefix
  - Vercel configuration and deployment guide included
  - See `apps/dashboard/VERCEL_DEPLOYMENT.md` for setup instructions

- **User Sites**: Auto-generated Astro sites deployed to user's choice of:
  - Netlify (recommended)
  - Vercel
  - Cloudflare Pages
  - Any static host

### Production API

The LiteShow API is live and accessible at:
- **Primary**: `https://liteshow-api.fly.dev/`
- **Custom Domain**: `https://api.liteshow.io/` (SSL certificate provisioning)

**Available Endpoints:**
- `GET /` - API status and version
- `GET /health` - Health check endpoint
- `GET /public/:projectSlug/pages` - Fetch all published pages
- `GET /public/:projectSlug/pages/:slug` - Fetch specific page with blocks
- Authentication and project management endpoints (authenticated)

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL database (choose one):
  - **Option A**: Managed database (Neon, Supabase, Railway) - **Recommended for easy setup**
  - **Option B**: Docker Compose (local PostgreSQL)
  - **Option C**: Local PostgreSQL installation
- Turso account (for content databases)
- GitHub OAuth App

### Quick Start (Managed Database - Recommended)

This is the easiest way to get started without managing a database server:

1. **Create a managed PostgreSQL database:**
   - [Neon](https://neon.tech) (free tier available) - Recommended
   - [Supabase](https://supabase.com) (free tier available)
   - [Railway](https://railway.app) (free trial)

2. **Clone and install:**
   ```bash
   git clone https://github.com/perryraskin/liteshow.git
   cd liteshow
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your DATABASE_URL from Neon/Supabase
   ```

4. **Create a Turso database:**
   ```bash
   # Install Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash

   # Sign up and create a database
   turso auth signup
   turso db create liteshow
   turso db tokens create liteshow
   ```

5. **Create a GitHub OAuth App:**
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - Create new OAuth App
   - Homepage URL: `http://localhost:3000`
   - Callback URL: `http://localhost:8000/api/auth/callback/github`
   - Add Client ID and Secret to `.env`

6. **Run database migrations:**
   ```bash
   cd packages/db
   pnpm db:push
   cd ../..
   ```

7. **Start development servers:**
   ```bash
   pnpm dev
   ```

   This will start:
   - Dashboard: http://localhost:3000
   - API: http://localhost:8000

### Local Setup with Docker

If you prefer to run everything locally including the database:

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d

# Follow steps 2-7 above
```

See the [Self-Hosting Guide](./docs/self-hosting.md) for detailed instructions.

## Documentation

- [Architecture Overview](./docs/architecture.md)
- [Content Model](./docs/content-model.md)
- [AI Workflow](./docs/ai-workflow.md)
- [Deployment](./docs/deployment.md)

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.
