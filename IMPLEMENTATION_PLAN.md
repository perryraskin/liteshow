# LiteShow Implementation Plan

## Overview

This document outlines the phased implementation approach for the LiteShow MVP. Each phase builds upon the previous one, with clear milestones and deliverables.

---

## Phase 1: Core Infrastructure & Authentication (Foundation)

**Goal**: Set up the foundational architecture with authentication, database schemas, and basic application scaffolding.

**Estimated Scope**: 2-3 weeks for full implementation

### 1.1 Database Setup & Schema Design

**Tasks:**
- [ ] Set up Drizzle ORM with PostgreSQL for central metadata database
- [ ] Design and implement Drizzle schema for:
  - Users (linked to GitHub accounts)
  - Projects (one per user site)
  - Domains (custom domain mappings)
  - Activity logs
- [ ] Create initial migrations with Drizzle Kit
- [ ] Set up Turso client utilities for per-project content databases
- [ ] Design content database schema (Pages, Blocks) with Drizzle

**Files to Create:**
- `packages/db/src/schema.ts`
- `packages/db/src/index.ts`
- `packages/db/src/turso-client.ts`
- `packages/db/drizzle.config.ts`
- `packages/db/migrations/*`

**Deliverable**: Working database setup with migrations, ready for data operations.

---

### 1.2 Authentication System (Better Auth + GitHub OAuth)

**Tasks:**
- [ ] Set up Better Auth in `packages/auth`
- [ ] Configure GitHub OAuth provider
- [ ] Request `repo` scope for repository management
- [ ] Create authentication middleware
- [ ] Set up session management
- [ ] Create user registration/onboarding flow

**Files to Create:**
- `packages/auth/src/index.ts`
- `packages/auth/src/config.ts`
- `packages/auth/src/middleware.ts`
- Environment variables for GitHub OAuth credentials

**Deliverable**: Working GitHub OAuth authentication flow.

---

### 1.3 Dashboard Application (Next.js)

**Tasks:**
- [ ] Set up Next.js 14 with App Router
- [ ] Configure Tailwind CSS for styling
- [ ] Create authentication pages (login, callback)
- [ ] Create main dashboard layout
- [ ] Set up protected routes
- [ ] Create empty dashboard views (to be filled in later phases)
- [ ] Integrate with `@liteshow/auth` package

**Files to Create:**
- `apps/dashboard/app/layout.tsx`
- `apps/dashboard/app/page.tsx`
- `apps/dashboard/app/login/page.tsx`
- `apps/dashboard/app/dashboard/layout.tsx`
- `apps/dashboard/app/dashboard/page.tsx`
- `apps/dashboard/tailwind.config.js`
- `apps/dashboard/next.config.js`

**Deliverable**: Working dashboard with authentication, accessible at `localhost:3000`.

---

### 1.4 API Layer (Hono)

**Tasks:**
- [ ] Set up Hono API server
- [ ] Create API routes structure
- [ ] Set up CORS and middleware
- [ ] Create authentication middleware
- [ ] Set up error handling
- [ ] Create health check endpoint
- [ ] Integrate with `@liteshow/db` package

**Files to Create:**
- `apps/api/src/index.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/middleware/error.ts`
- `apps/api/package.json` (update with Hono dependencies)

**Deliverable**: API server running at `localhost:8000` with basic routes.

---

### 1.5 Shared UI Components

**Tasks:**
- [ ] Set up shared UI package structure
- [ ] Create basic button component
- [ ] Create form input components
- [ ] Create card/container components
- [ ] Set up Storybook (optional, for development)
- [ ] Configure Tailwind for shared components

**Files to Create:**
- `packages/ui/src/button.tsx`
- `packages/ui/src/input.tsx`
- `packages/ui/src/card.tsx`
- `packages/ui/src/index.ts`
- `packages/ui/tailwind.config.js`

**Deliverable**: Reusable UI component library.

---

### Phase 1 Success Criteria

✅ User can sign up/login with GitHub
✅ Database schemas are defined and migrations run
✅ Dashboard loads and shows authenticated user info
✅ API server responds to health checks
✅ All three apps can run concurrently with `pnpm dev`
✅ TypeScript types are shared across packages

---

## Phase 2: Project Management & Content Model

**Goal**: Enable users to create projects and manage content using the block-based model.

### 2.1 Project Creation Flow

**Tasks:**
- [ ] Create "New Project" UI in dashboard
- [ ] Implement API endpoint to create projects
- [ ] Create Turso database for each new project
- [ ] Initialize Git repository in user's GitHub account
- [ ] Store project metadata in Postgres
- [ ] Create project settings page

**Deliverable**: Users can create projects with isolated databases.

---

### 2.2 Content Management (Pages & Blocks)

**Tasks:**
- [ ] Implement CRUD API endpoints for pages
- [ ] Implement CRUD API endpoints for blocks
- [ ] Create page list view in dashboard
- [ ] Create page editor UI
- [ ] Implement block type components (hero, features, markdown, CTA, FAQ, testimonials)
- [ ] Create block preview components
- [ ] Implement drag-and-drop reordering (optional for MVP)

**Deliverable**: Users can create and edit pages with blocks.

---

### 2.3 Git Sync (Basic)

**Tasks:**
- [ ] Create GitHub repository helper functions
- [ ] Implement sync function to push content as Markdown/JSON
- [ ] Create commit messages for content changes
- [ ] Set up basic sync on save

**Deliverable**: Content changes are synced to user's GitHub repo.

---

### Phase 2 Success Criteria

✅ User can create a new project
✅ User can create/edit/delete pages
✅ User can add/remove/reorder blocks
✅ Changes sync to GitHub repository
✅ Activity feed shows recent changes

---

## Phase 3: AI Content Assistant

**Goal**: Implement the AI-powered content workflow using Claude API.

### 3.1 AI Agent Integration

**Tasks:**
- [ ] Set up Anthropic Claude API client
- [ ] Create AI agent system prompts
- [ ] Implement natural language content request parser
- [ ] Create block generation functions
- [ ] Implement preview/approve workflow
- [ ] Create AI chat interface in dashboard

**Deliverable**: Users can generate content blocks via AI.

---

### 3.2 Content Preview & Approval

**Tasks:**
- [ ] Create preview modal for AI-generated changes
- [ ] Implement diff view (before/after)
- [ ] Add approve/reject actions
- [ ] Handle partial approvals (specific blocks)

**Deliverable**: Users can review and approve AI changes before applying.

---

### Phase 3 Success Criteria

✅ User can request content via natural language
✅ AI generates appropriate blocks
✅ User can preview changes before applying
✅ Approved changes are saved and synced to Git

---

## Phase 4: Site Generation & Deployment

**Goal**: Generate and serve public-facing websites with custom domain support.

### 4.1 Astro Site Generator

**Tasks:**
- [ ] Set up Astro in SSR mode
- [ ] Create dynamic middleware for domain routing
- [ ] Query Postgres for project/domain mappings
- [ ] Connect to correct Turso database per request
- [ ] Create page renderer
- [ ] Create block components (matching dashboard previews)
- [ ] Implement SEO meta tags, sitemaps, structured data

**Deliverable**: Sites render correctly with SEO optimization.

---

### 4.2 Custom Domain Configuration

**Tasks:**
- [ ] Create domain settings UI in dashboard
- [ ] Implement domain verification
- [ ] Create CNAME instructions for users
- [ ] Set up wildcard DNS routing
- [ ] Test multi-tenant domain handling

**Deliverable**: Users can configure custom domains.

---

### 4.3 Deployment Setup

**Tasks:**
- [ ] Set up Vercel deployment for dashboard (app.liteshow.io)
- [ ] Set up Fly.io deployment with co-located Astro sites + API (sites.liteshow.io)
- [ ] Create Dockerfile for Fly.io container (sites + api together)
- [ ] Configure environment variables for production
- [ ] Set up managed Postgres (Neon/Supabase)
- [ ] Document deployment process

**Deliverable**: All apps can be deployed to production.

**Note**: The API and Sites apps are co-located in a single Fly.io container for cost optimization and simplified deployment. The Astro SSR server handles domain routing and the API handles backend logic.

---

### Phase 4 Success Criteria

✅ Public sites render correctly
✅ Custom domains work
✅ SEO tags are properly generated
✅ Sites load fast (Lighthouse score >90)
✅ Production deployment is successful

---

## Phase 5: Activity Feed & Polish

**Goal**: Complete the MVP with activity tracking and final polish.

### 5.1 Activity Feed

**Tasks:**
- [ ] Implement activity logging in API
- [ ] Create activity feed UI component
- [ ] Show AI-generated vs manual changes
- [ ] Link activities to Git commits
- [ ] Add filtering and search

**Deliverable**: Complete activity history visible in dashboard.

---

### 5.2 Final Polish

**Tasks:**
- [ ] Error handling and validation across all apps
- [ ] Loading states and optimistic updates
- [ ] Empty states and onboarding improvements
- [ ] Mobile responsiveness
- [ ] Documentation (README, API docs, user guides)
- [ ] Testing (unit tests, integration tests)

**Deliverable**: Production-ready MVP.

---

## Phase 5 Success Criteria

✅ Activity feed is complete and functional
✅ All user-facing errors are handled gracefully
✅ Documentation is complete
✅ Application is tested and stable
✅ MVP is ready for beta users

---

## Post-MVP: Future Enhancements

- More block types (carousels, tabs, pricing tables)
- Google Search Console integration
- Analytics dashboard
- Theme marketplace
- Team collaboration features
- Advanced AI capabilities (image generation, SEO suggestions)
- Webhook integrations

---

## Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Frontend Framework** | Next.js 14 (App Router) | Modern React framework, great DX, Vercel deployment |
| **Site Generator** | Astro (SSR mode) | Best-in-class SEO and performance, SSR for multi-tenancy |
| **API Framework** | Hono | Lightweight, fast, TypeScript-first, edge-ready |
| **Metadata DB** | PostgreSQL + Drizzle ORM | Robust, scalable, excellent TypeScript support, lightweight |
| **Content DB** | Turso (SQLite) + Drizzle | Per-tenant isolation, global replication, cost-effective |
| **Auth** | Better Auth | Modern, flexible, GitHub OAuth support |
| **Monorepo Tool** | Turborepo + pnpm | Fast builds, great caching, efficient dependency management |
| **Styling** | Tailwind CSS | Utility-first, consistent, fast development |
| **AI Provider** | Anthropic Claude | Best for content generation, long context windows |
| **Deployment** | Vercel (Dashboard) + Fly.io (Sites+API) | Optimal for Next.js, cost-effective co-location |

---

## Development Workflow

1. **Branch Strategy**: Feature branches off `main`, PR for review
2. **Commit Convention**: Conventional commits (feat, fix, docs, etc.)
3. **Testing**: Write tests for critical paths (auth, content CRUD, AI)
4. **Code Review**: All changes reviewed before merge
5. **Deployment**: Automatic preview deployments, manual production deploys

---

## Environment Setup Checklist

Before starting Phase 1, ensure you have:

- [ ] Node.js 18+ installed
- [ ] pnpm 8+ installed
- [ ] PostgreSQL running (local or Docker)
- [ ] GitHub OAuth app created (development credentials)
- [ ] Turso account created
- [ ] Anthropic API key obtained
- [ ] All environment variables configured in `.env`

---

## Ready to Start Phase 1?

Once you approve this plan, we'll begin with Phase 1.1: Database Setup & Schema Design.
