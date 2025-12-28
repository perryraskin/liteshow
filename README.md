# LiteShow

> AI-First, SEO-Optimized, Git-Powered CMS

LiteShow is a content management system that combines a powerful AI content assistant with a robust, developer-friendly architecture, ensuring every site is perfectly optimized for SEO from day one.

## Features

- **AI-Powered Content Creation**: Natural language interface for content management
- **Block-Based Content Model**: Flexible, reusable content blocks
- **SEO-First**: Built with Astro for best-in-class performance and SEO
- **Git-Backed**: All content version-controlled in your own GitHub repository
- **Multi-Tenant**: Each project gets its own isolated database
- **Custom Domains**: Easy custom domain configuration

## Architecture

This is a monorepo containing:

- **apps/dashboard**: Next.js user dashboard
- **apps/sites**: Astro site generator
- **apps/api**: FastAPI/Hono backend API
- **packages/ui**: Shared React components
- **packages/auth**: Better Auth configuration
- **packages/db**: Prisma schema and client
- **packages/config**: Shared configuration

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL (for metadata)
- Turso account (for content databases)
- GitHub OAuth App

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Run database migrations
pnpm db:push

# Start development servers
pnpm dev
```

## Self-Hosting

LiteShow can be self-hosted using Docker Compose:

```bash
docker-compose up -d
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
