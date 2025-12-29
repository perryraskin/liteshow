# LiteShow

> AI-First, SEO-Optimized, Git-Powered CMS

LiteShow is a content management system that combines a powerful AI content assistant with a robust, developer-friendly architecture, ensuring every site is perfectly optimized for SEO from day one.

---

## 🚧 MVP Development Progress

**Current Status**: Phase 1 Complete ✅

### Phase 1: Core Infrastructure & Authentication ✅
- [x] Database setup with Drizzle ORM (PostgreSQL + Turso)
- [x] Better Auth with GitHub OAuth (repo scope)
- [x] Next.js dashboard with Tailwind CSS
- [x] Hono API server with health checks
- [x] Shared UI component library
- [x] TypeScript configuration across monorepo
- [x] All packages build successfully

### Phase 2: Project Management & Content Model 🚧
- [ ] Project creation flow with Turso database provisioning
- [ ] GitHub repository creation for each project
- [ ] Page and block CRUD operations
- [ ] Block types: hero, features, testimonials, markdown, CTA, FAQ
- [ ] Content editor UI with block management
- [ ] Git sync for content changes
- [ ] Activity feed integration

### Phase 3: AI Content Assistant 📋
- [ ] Anthropic Claude API integration
- [ ] Natural language content generation
- [ ] Block generation from AI prompts
- [ ] Preview/approve workflow for AI changes
- [ ] AI chat interface in dashboard
- [ ] Diff view for content changes

### Phase 4: Site Generation & Deployment 📋
- [ ] Astro SSR site generator
- [ ] Dynamic domain routing middleware
- [ ] SEO optimization (meta tags, sitemaps, structured data)
- [ ] Custom domain configuration
- [ ] Domain verification system
- [ ] Production deployment setup (Vercel + Fly.io)

### Phase 5: Activity Feed & Polish 📋
- [ ] Complete activity logging system
- [ ] Activity feed UI with filtering
- [ ] Attribution (AI vs manual changes)
- [ ] Error handling and validation
- [ ] Loading states and optimistic updates
- [ ] Mobile responsiveness
- [ ] Comprehensive testing
- [ ] Documentation completion

**Legend**: ✅ Complete | 🚧 In Progress | 📋 Planned

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed phase breakdown.

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

- **apps/dashboard**: Next.js user dashboard (deployed to Vercel)
- **apps/sites**: Astro site generator (deployed to Fly.io with API)
- **apps/api**: Hono backend API (co-located with sites on Fly.io)
- **packages/ui**: Shared React components
- **packages/auth**: Better Auth configuration
- **packages/db**: Drizzle ORM schema and client
- **packages/config**: Shared configuration

### Deployment Strategy

- **Dashboard**: Deployed to Vercel at `app.liteshow.io`
- **Sites + API**: Co-located in a single Fly.io container at `sites.liteshow.io` for cost optimization

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
