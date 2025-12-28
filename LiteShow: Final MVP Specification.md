# LiteShow: Final MVP Specification

## 1. Core Vision: The AI-First, SEO-Optimized, Git-Powered CMS

LiteShow is a content management system for users who want a hands-off, high-performance web presence. It combines a powerful AI content assistant with a robust, developer-friendly architecture, ensuring every site is perfectly optimized for SEO from day one. The user owns their content, which is version-controlled in their own Git repository.

## 2. Key MVP Features

### 2.1. User Onboarding & Project Setup

1.  **Sign Up with GitHub**: Users will sign up using their GitHub account via **Better Auth**.
2.  **Grant Repository Access**: During onboarding, LiteShow will request permission (`repo` scope) to manage repositories in the user's GitHub account.
3.  **Project Creation & Repo Sync**: When a user creates a new project, LiteShow will:
    a.  Create a dedicated **Turso database** for the project's content.
    b.  Create a new **Git repository** in the user's GitHub account.
    c.  This repository is synced with the Turso database, serving as a human-readable backup.

### 2.2. Block-Based Content Model

All content is a **Page** composed of **Blocks** to provide maximum flexibility for creating both structured landing pages and freeform blog posts.

-   **Page Schema**: A page is a container with a slug, title, status, and an ordered array of block objects.
-   **Block Types**: The MVP will include essential, reusable blocks like `hero`, `features`, `testimonials`, `markdown`, `cta`, and `faq`.

### 2.3. The AI Content Workflow

1.  **Natural Language Requests**: Users interact with an AI agent to manage content.
2.  **AI Block Generation**: The AI generates the appropriate JSON for the requested blocks.
3.  **Preview Changes**: Users see a visual preview of changes before they are applied.
4.  **Approve or Reject**: The user has the final say on all AI-generated changes.

### 2.4. SEO-First Site Generation

1.  **Automated Best Practices**: The public-facing sites will be generated using **Astro**, ensuring best-in-class SEO and performance (sitemaps, structured data, meta tags, image optimization).
2.  **Peak Performance**: Astro's static-first approach guarantees the fastest possible load times.

### 2.5. Activity & Version History

1.  **Unified Activity Feed**: The dashboard shows a chronological feed of all content changes.
2.  **Clear Attribution**: Each entry will clearly attribute the change to the **AI agent** or a **manual Git commit**.

## 3. Technical Architecture

### 3.1. Multi-Tenancy and Domain Handling

LiteShow is a multi-tenant platform where each user's data and site are isolated. This is achieved through a combination of a central metadata database and per-project content databases.

-   **Central Metadata Database (Postgres)**: A primary Postgres database, managed with Prisma, will store all application-level metadata.
-   **Per-Project Content Database (Turso)**: Each user project has its own isolated Turso database containing its pages and blocks.

**Custom Domain Implementation (Wildcard DNS & Dynamic Routing):**

The MVP will use a simple and robust server-side routing method to handle custom domains.

1.  **DNS Configuration**: The user adds their custom domain in their LiteShow dashboard and is instructed to add a `CNAME` record pointing their domain to `sites.liteshow.io`.
2.  **Dynamic Routing Server**: The Astro site generator will be deployed as a long-running server (e.g., on Fly.io or Railway).
3.  **Request Handling Flow**: The server middleware queries the central Postgres database to look up the project associated with the incoming hostname, retrieves the corresponding Turso database URL, and renders the page with the correct content.

### 3.2. Technology Stack Summary

| Component | Technology | Role & Justification |
| :--- | :--- | :--- |
| **Metadata DB** | **Postgres + Prisma** | Central store for user accounts, project info, and domain mappings. |
| **Content DB** | **Turso** | The live source of truth. Provides a managed, per-user SQLite database with global replication for fast reads. |
| **Version Control** | **GitHub** | A human-readable backup and version history. Stores content as flat files (Markdown, JSON). The user owns the repo. |
| **Auth** | **Better Auth** | Handles the GitHub OAuth flow, requesting `repo` scope to manage repositories on the user's behalf. |
| **API Layer** | **FastAPI / Hono** | The central backend that handles user requests, interacts with Turso, orchestrates AI tasks, and syncs changes to GitHub. |
| **Dashboard App** | **Next.js** | Powers the interactive user dashboard (`app.liteshow.io`). Hosted on Vercel. |
| **Site Generator** | **Astro (SSR Mode)** | Generates the fast, SEO-optimized public websites for users. Runs on a server (e.g., Fly.io) to handle dynamic domain routing. |

## 4. Repository Structure & Open-Source Strategy

To support both a hosted SaaS offering and a self-hosted open-source option, the project will be structured as a **monorepo**.

```
/liteshow
├── apps/
│   ├── dashboard/         # Next.js user dashboard (app.liteshow.io)
│   ├── sites/             # Astro site generator (sites.liteshow.io)
│   └── api/               # FastAPI/Hono backend API
├── packages/
│   ├── ui/                # Shared React components (buttons, forms, etc.)
│   ├── auth/              # Better Auth configuration and helpers
│   ├── db/                # Prisma schema and client for Postgres
│   └── config/            # Shared configuration (ESLint, TypeScript)
├── docker-compose.yml     # For self-hosted local development
└── README.md              # Instructions for both SaaS and self-hosting
```

### 4.1. Open-Source Self-Hosting

-   **Clear Documentation**: The `README.md` will provide comprehensive instructions for self-hosting. This includes setting up the required services (Postgres, environment variables for Turso, GitHub OAuth apps, etc.).
-   **Docker Compose**: A `docker-compose.yml` file will be provided to allow users to spin up the entire stack (API, dashboard, site generator, and a local Postgres instance) with a single command for local development and testing.
-   **Configuration via Environment Variables**: All sensitive keys and configuration options will be managed through environment variables, making it easy to configure a self-hosted instance without modifying the code.

### 4.2. Hosted SaaS Version

-   The monorepo structure allows for easy deployment of each application (`dashboard`, `sites`, `api`) to its respective hosting provider (Vercel, Fly.io, etc.).
-   The SaaS version will use managed services for Postgres (e.g., Neon, Supabase) and will have production-ready configurations for logging, monitoring, and scaling.

## 5. Future Roadmap (Post-MVP)

-   **More Content Blocks**: Add pre-built, interactive components like carousels, tabs, and pricing tables.
-   **Google Search Console Integration**: Automatically submit sitemaps and track SEO performance.
-   **Analytics**: Simple, privacy-friendly site analytics.
-   **Theme Marketplace**: A selection of pre-designed, SEO-optimized themes.
