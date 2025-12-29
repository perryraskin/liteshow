# Self-Hosting Guide

This guide covers different ways to self-host LiteShow, from the easiest managed approach to full local control.

## Table of Contents

- [Option 1: Managed Database (Recommended)](#option-1-managed-database-recommended)
- [Option 2: Docker Compose](#option-2-docker-compose)
- [Option 3: Manual Setup](#option-3-manual-setup)
- [Environment Variables](#environment-variables)
- [Production Deployment](#production-deployment)

---

## Option 1: Managed Database (Recommended)

This is the easiest and most cost-effective way to self-host LiteShow. You only need to manage the application servers while using managed services for databases.

### Services You'll Need

1. **Metadata Database** (choose one):
   - [Neon](https://neon.tech) - Serverless PostgreSQL (Free tier: 10 GB storage)
   - [Supabase](https://supabase.com) - PostgreSQL + extras (Free tier: 500 MB database)
   - [Railway](https://railway.app) - PostgreSQL (Free trial, then ~$5/month)

2. **Content Database**:
   - [Turso](https://turso.tech) - Edge SQLite database (Free tier: 9 GB storage)

3. **Application Hosting**:
   - [Vercel](https://vercel.com) - Dashboard (Next.js) (Free tier available)
   - [Fly.io](https://fly.io) - API + Sites (Astro/Hono) (~$5-10/month)

### Step-by-Step Setup

#### 1. Set Up Neon Database

```bash
# Go to https://neon.tech and create a free account
# Create a new project
# Copy the connection string (it looks like this):
# postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb
```

#### 2. Set Up Turso Database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Sign up (or login)
turso auth signup

# Create a database
turso db create liteshow

# Get the database URL
turso db show liteshow --url

# Create an auth token
turso db tokens create liteshow

# Save both the URL and token for your .env file
```

#### 3. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - Application name: `LiteShow (Self-Hosted)`
   - Homepage URL: `https://your-domain.com` (or `http://localhost:3000` for local)
   - Authorization callback URL: `https://your-api-domain.com/api/auth/callback/github`
4. Save the Client ID and generate a Client Secret

#### 4. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/perryraskin/liteshow.git
cd liteshow

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env
```

Edit `.env`:

```bash
# Neon database URL
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb"

# GitHub OAuth credentials
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"

# Turso database (this is a placeholder - each project will have its own)
TURSO_API_TOKEN="your_turso_auth_token"

# Generate a random secret for Better Auth
AUTH_SECRET="your_random_secret_here"
BETTER_AUTH_URL="https://your-api-domain.com"

# App URLs (update these with your actual domains)
NEXT_PUBLIC_APP_URL="https://your-dashboard-domain.com"
NEXT_PUBLIC_API_URL="https://your-api-domain.com"
API_PORT="8000"

# Anthropic API key for AI features
ANTHROPIC_API_KEY="your_anthropic_api_key"
```

#### 5. Run Database Migrations

```bash
cd packages/db
pnpm db:push
cd ../..
```

#### 6. Test Locally

```bash
pnpm dev
```

Visit http://localhost:3000 to verify everything works.

#### 7. Deploy to Production

**Deploy Dashboard to Vercel:**

```bash
cd apps/dashboard
vercel
# Follow the prompts
```

**Deploy API + Sites to Fly.io:**

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Create Fly app
fly launch

# Deploy
fly deploy
```

### Monthly Cost Estimate

- **Neon (database)**: $0 (free tier)
- **Turso (content)**: $0 (free tier, upgrades at scale)
- **Vercel (dashboard)**: $0 (free tier)
- **Fly.io (api + sites)**: ~$5-10/month (shared-cpu-1x)

**Total**: $5-10/month for everything

---

## Option 2: Docker Compose

Run everything locally including the PostgreSQL database.

### Prerequisites

- Docker and Docker Compose installed
- Git
- Node.js 18+ and pnpm 8+ (for development)

### Setup

```bash
# Clone repository
git clone https://github.com/perryraskin/liteshow.git
cd liteshow

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env

# Edit .env with your GitHub OAuth credentials and other settings
# For local Docker setup, DATABASE_URL is already configured

# Start PostgreSQL
docker-compose up -d

# Wait for PostgreSQL to be ready (check with)
docker-compose ps

# Run migrations
cd packages/db
pnpm db:push
cd ../..

# Start development servers
pnpm dev
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove all data (WARNING: deletes database)
docker-compose down -v
```

---

## Option 3: Manual Setup

Install and manage all services manually.

### Prerequisites

- PostgreSQL 14+ installed and running
- Node.js 18+ and pnpm 8+ installed
- Git

### Setup

```bash
# Create PostgreSQL database
createdb liteshow

# Or via psql:
psql -c "CREATE DATABASE liteshow;"

# Clone and setup project
git clone https://github.com/perryraskin/liteshow.git
cd liteshow
pnpm install

# Configure .env (use your local PostgreSQL URL)
cp .env.example .env

# Edit DATABASE_URL in .env:
# DATABASE_URL="postgresql://username:password@localhost:5432/liteshow"

# Run migrations
cd packages/db
pnpm db:push
cd ../..

# Start development
pnpm dev
```

---

## Environment Variables

Here's a complete reference of all environment variables:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | Yes | `Iv1.abc123...` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret | Yes | `abc123...` |
| `TURSO_API_TOKEN` | Turso authentication token | Yes | `eyJhbGc...` |
| `AUTH_SECRET` | Random secret for session encryption | Yes | Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | URL of your API server | Yes | `http://localhost:8000` or `https://api.yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | URL of dashboard | Yes | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | URL of API (public) | Yes | `http://localhost:8000` |
| `API_PORT` | Port for API server | No | `8000` (default) |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features | Yes | `sk-ant-...` |

---

## Production Deployment

### Security Checklist

Before deploying to production:

- [ ] Use HTTPS for all services
- [ ] Set strong, unique `AUTH_SECRET`
- [ ] Never commit `.env` files
- [ ] Enable database backups
- [ ] Set up monitoring (error tracking, uptime)
- [ ] Configure proper CORS origins
- [ ] Review GitHub OAuth callback URLs
- [ ] Enable rate limiting (if needed)
- [ ] Set up logging and analytics

### Recommended Architecture

For production self-hosting:

```
[Users]
   ↓
[Cloudflare/CDN] → [Vercel] → Dashboard (app.yourdomain.com)
   ↓
[Fly.io] → API + Sites (api.yourdomain.com)
   ↓
[Neon] → Metadata Database
[Turso] → Content Databases (per-project)
```

### Custom Domains

1. **Dashboard (Vercel)**:
   - Go to Vercel project settings
   - Add custom domain
   - Configure DNS as instructed

2. **API/Sites (Fly.io)**:
   - Configure custom domain in `fly.toml`
   - Add DNS records pointing to Fly.io
   - Fly.io handles SSL automatically

### Monitoring

Consider setting up:

- **Uptime monitoring**: [UptimeRobot](https://uptimerobot.com) (free)
- **Error tracking**: [Sentry](https://sentry.io) (free tier)
- **Analytics**: [Plausible](https://plausible.io) or [Umami](https://umami.is)

---

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Test connection
psql $DATABASE_URL

# If using Neon, make sure to append ?sslmode=require
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

### GitHub OAuth Not Working

- Verify callback URL matches exactly
- Check that GitHub OAuth app is not suspended
- Ensure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correct
- Confirm `BETTER_AUTH_URL` points to your API server

### Database Migration Errors

```bash
# Reset migrations (WARNING: deletes all data)
cd packages/db
rm -rf migrations/
pnpm db:push

# Check Drizzle configuration
cat drizzle.config.ts
```

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/perryraskin/liteshow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/perryraskin/liteshow/discussions)
- **Documentation**: [Main README](../README.md)

---

## Next Steps

After self-hosting:

1. Create your first project
2. Connect a custom domain
3. Generate content with AI
4. Explore the codebase and customize
5. Contribute back improvements!
