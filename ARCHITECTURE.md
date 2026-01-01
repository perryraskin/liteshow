# Liteshow Architecture

Living architecture documentation for the Liteshow monorepo. This diagram is updated as features are implemented.

**Last Updated**: 2025-12-31 - GitHub App Integration Complete

## System Overview

```mermaid
graph TB
    subgraph "Frontend Apps"
        Dashboard["Dashboard (Next.js)<br/>app.liteshow.io<br/>Port: 3001"]
        Sites["User Sites (Astro)<br/>Static Generation"]
    end

    subgraph "Backend Services"
        API["API Server (Hono)<br/>api.liteshow.io<br/>Port: 8000"]
    end

    subgraph "Shared Packages"
        DB["@liteshow/db<br/>Drizzle ORM + Schemas"]
        Auth["@liteshow/auth<br/>Better Auth"]
        UI["@liteshow/ui<br/>shadcn components"]
        Config["@liteshow/config<br/>Shared configs"]
    end

    subgraph "Databases"
        Postgres[("PostgreSQL<br/>Metadata DB<br/>Users, Projects, Activity")]
        Turso[("Turso SQLite<br/>Content DBs<br/>Per-Project Isolation")]
    end

    subgraph "External Services"
        GitHubOAuth["GitHub OAuth<br/>User Authentication"]
        GitHubApp["GitHub App<br/>Repository Access"]
        GitHubAPI["GitHub API<br/>Repo Creation & Content Sync"]
        Cloudflare["Cloudflare Tunnel<br/>devpi.shmob.xyz"]
        Vercel["Vercel<br/>Dashboard Hosting"]
        Fly["Fly.io<br/>API Hosting"]
    end

    Dashboard -->|API Requests| API
    Sites -->|Build-time Content Fetch| API

    API --> DB
    API --> Auth
    Dashboard --> Auth
    Dashboard --> UI

    DB -->|Metadata Queries| Postgres
    DB -->|Content Queries| Turso

    API -->|OAuth Flow| GitHubOAuth
    API -->|Installation Tokens| GitHubApp
    API -->|Create Repos & Sync| GitHubAPI

    Dashboard -.->|Deployed| Vercel
    API -.->|Deployed| Fly
    Dashboard -.->|Dev Tunnel| Cloudflare
    API -.->|Dev Tunnel| Cloudflare

    classDef frontend fill:#3b82f6,color:#fff
    classDef backend fill:#10b981,color:#fff
    classDef package fill:#8b5cf6,color:#fff
    classDef database fill:#f59e0b,color:#fff
    classDef external fill:#6366f1,color:#fff

    class Dashboard,Sites frontend
    class API backend
    class DB,Auth,UI,Config package
    class Postgres,Turso database
    class GitHubOAuth,GitHubApp,GitHubAPI,Cloudflare,Vercel,Fly external
```

## Progressive GitHub Permissions Flow

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant API
    participant GitHub
    participant Database

    Note over User,Database: Initial Login (Minimal Scope)

    User->>Dashboard: Click "Login with GitHub"
    Dashboard->>API: GET /auth/github
    API->>GitHub: OAuth Request (scope: user:email)
    GitHub->>User: Authorize?
    User->>GitHub: Approve
    GitHub->>API: Callback with code
    API->>GitHub: Exchange code for token
    GitHub->>API: Access token
    API->>Database: Store user (hasPublicRepoScope: false)
    API->>Dashboard: Redirect with session

    Note over User,Database: Project Creation (Request Repo Scope)

    User->>Dashboard: Create New Project
    Dashboard->>API: POST /projects (OAuth method)
    API->>Database: Check user.hasPublicRepoScope
    Database->>API: false
    API->>Dashboard: 403 {requiresAuth: true, requiredScope: "public_repo"}
    Dashboard->>User: "Grant repository access"
    User->>Dashboard: Click "Authorize"
    Dashboard->>API: GET /auth/github/request-scope?scope=public_repo
    API->>GitHub: OAuth Request (scope: user:email public_repo)
    GitHub->>User: Authorize additional scope?
    User->>GitHub: Approve
    GitHub->>API: Callback with code
    API->>GitHub: Exchange code for token
    GitHub->>API: New access token
    API->>Database: Update user (hasPublicRepoScope: true)
    API->>Dashboard: Redirect to /projects/new

    User->>Dashboard: Create project
    Dashboard->>API: POST /projects
    API->>Database: Check hasPublicRepoScope
    Database->>API: true
    API->>GitHub: Create repository
    GitHub->>API: Repo created
    API->>Database: Store project
    API->>Dashboard: Project created successfully
```

## Database Schema

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ ACTIVITY_LOGS : creates
    PROJECTS ||--o{ ACTIVITY_LOGS : "logged for"
    PROJECTS ||--o{ TURSO_CONTENT_DBS : has

    USERS {
        uuid id PK
        string github_id
        string github_username
        string github_access_token
        boolean has_public_repo_scope
        boolean has_private_repo_scope
        timestamp scopes_granted_at
        timestamp created_at
        timestamp updated_at
    }

    PROJECTS {
        uuid id PK
        uuid user_id FK
        string slug UK
        string turso_db_url
        string turso_db_token
        string github_repo_name "nullable"
        string github_repo_url "nullable"
        string github_auth_type "oauth|github_app"
        string github_installation_id
        string github_repo_id
        boolean is_published
        timestamp created_at
        timestamp updated_at
    }

    ACTIVITY_LOGS {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        string action_type
        jsonb metadata
        timestamp created_at
    }

    TURSO_CONTENT_DBS {
        string name "liteshow-{slug}"
        table pages
        table blocks
        table page_versions
    }
```

## API Routes Structure

```mermaid
graph LR
    subgraph "Authentication"
        A1["/auth/github<br/>OAuth Login"]
        A2["/auth/github/callback<br/>OAuth Callback"]
        A3["/auth/github/request-scope<br/>Progressive Scopes"]
    end

    subgraph "Projects"
        P1["/projects<br/>List/Create"]
        P2["/projects/:id<br/>Get/Delete"]
        P3["/projects/:id/activity<br/>Activity Logs"]
        P4["/projects/:id/link-github<br/>Link GitHub Repository"]
    end

    subgraph "Content Management"
        C1["/projects/:id/pages<br/>Page CRUD"]
        C2["/projects/:id/pages/:pageId/blocks<br/>Block CRUD"]
        C3["/projects/:id/pages/:pageId/versions<br/>Version History"]
    end

    subgraph "GitHub App"
        G1["/github-app/installations/:id/repos<br/>List Installation Repos"]
    end

    subgraph "Public API"
        PU1["/public/sites/:slug/pages<br/>Published Pages"]
        PU2["/public/sites/:slug/pages/:slug<br/>Page Details"]
    end
```

## Monorepo Structure

```
liteshow/
├── apps/
│   ├── api/                    # Hono backend (Fly.io)
│   │   ├── src/
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── lib/            # GitHub App, git-sync
│   │   │   ├── middleware/     # Error handling
│   │   │   └── __tests__/      # Vitest integration tests ✨ NEW
│   │   └── vitest.config.ts    # ✨ NEW
│   │
│   ├── dashboard/              # Next.js admin (Vercel)
│   │   ├── src/app/            # App Router
│   │   └── components/         # React components
│   │
│   └── sites/                  # Astro template (future)
│
├── packages/
│   ├── db/                     # Database layer
│   │   ├── src/
│   │   │   ├── schema.ts       # PostgreSQL schema ✨ UPDATED
│   │   │   ├── content-schema.ts
│   │   │   └── index.ts
│   │   └── migrations/         # SQL migrations ✨ NEW
│   │
│   ├── auth/                   # Better Auth setup
│   ├── ui/                     # Shared UI components
│   └── config/                 # Shared configs
│
└── docs/                       # Documentation
    └── ARCHITECTURE.md         # ✨ NEW - This file!
```

## Authentication Methods

### OAuth Method (Simple)
- **User Journey**: Liteshow creates repo for user
- **Scopes**:
  - Initial: `user:email`
  - On-demand: `public_repo` or `repo`
- **Best For**: Users who want quick setup
- **Implementation**: Standard GitHub OAuth flow

### GitHub App Method (Advanced)
- **User Journey**: User installs app, selects repos
- **Access**: Installation tokens (1-hour validity)
- **Best For**: Organizations, existing repositories
- **Implementation**: JWT generation + installation tokens

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production"
        Vercel["Vercel<br/>app.liteshow.io"]
        Fly["Fly.io<br/>api.liteshow.io"]
    end

    subgraph "Development"
        LocalDash["Local Dashboard<br/>localhost:3001"]
        LocalAPI["Local API<br/>localhost:8000"]
        Tunnel["Cloudflare Tunnel<br/>devpi-3008.shmob.xyz"]
    end

    subgraph "Data Layer"
        Neon["Neon PostgreSQL<br/>Production DB"]
        TursoCloud["Turso Cloud<br/>Content DBs"]
    end

    Vercel --> Fly
    Vercel --> Neon
    Fly --> Neon
    Fly --> TursoCloud

    LocalDash --> LocalAPI
    LocalDash -.-> Tunnel
    LocalAPI -.-> Tunnel
    LocalAPI --> Neon
    LocalAPI --> TursoCloud
```

**Current Deployment Status:**
- ✅ **API**: Deployed to Fly.io at `api.liteshow.io`
- ✅ **Dashboard**: Deployed to Vercel at `liteshow-dashboard.vercel.app`
- ✅ **Development**: Active Cloudflare Tunnel at `devpi-*.shmob.xyz`

## Key Features Implemented

### ✅ Phase 1: Core Infrastructure
- Monorepo setup with Turborepo
- PostgreSQL metadata database
- Turso per-project content databases
- GitHub OAuth authentication

### ✅ Phase 2: Content Management
- Page and block CRUD operations
- Version history and rollback
- Git sync to GitHub repositories
- Activity logging

### ✅ Phase 3: GitHub App Integration (Complete)
- ✅ Minimal initial OAuth scope (`user:email`)
- ✅ Progressive scope requests (`public_repo`, `repo`)
- ✅ GitHub App integration (JWT, installation tokens)
- ✅ Unified token helper (OAuth vs App)
- ✅ Database schema for permission tracking
- ✅ Backend API routes
- ✅ Integration tests (23 passing)
- ✅ Frontend GitHub setup wizard (OAuth vs GitHub App choice)
- ✅ Repository selection UI for GitHub App
- ✅ GitHub App callback and installation flow
- ✅ Environment-based GitHub App configuration

### 📋 Phase 4: Deployment Monitoring (Next)
- Repository webhook setup
- Netlify/Vercel deployment triggers
- Build status tracking

### 📋 Phase 5: AI Content Assistant
- Claude integration for content generation
- SEO optimization suggestions

### 📋 Phase 6: Production Readiness
- Custom domains
- Analytics
- Error monitoring

---

**Note**: This architecture diagram should be updated whenever significant changes are made to the system structure, data flows, or integrations.
