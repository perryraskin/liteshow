# {{PROJECT_NAME}}

Built with [LiteShow](https://liteshow.io) - AI-first, SEO-optimized, Git-powered CMS

## Deploy Your Site

### Netlify Deployment

1. Go to [Netlify](https://app.netlify.com/start)
2. Click **"Import an existing project"**
3. Select **GitHub** and choose this repository
4. Configure build settings:
   - **Build command:** `pnpm install && pnpm build`
   - **Publish directory:** `dist`
5. Add environment variables (see below)
6. Click **Deploy site**

### Vercel Deployment

1. Go to [Vercel](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select this repository from GitHub
4. Configure project:
   - **Build command:** `pnpm install && pnpm build`
   - **Output directory:** `dist`
5. Add environment variables (see below)
6. Click **Deploy**

After deploying, any content you publish in LiteShow will automatically trigger a rebuild via webhook.

## Environment Variables

**Both environment variables are required for deployment:**

- `TURSO_DATABASE_URL` - Your Turso database URL
- `TURSO_AUTH_TOKEN` - Your Turso auth token

These are provided by LiteShow and connect your site to your content database.

## Local Development

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your configuration
# TURSO_DATABASE_URL={{TURSO_DATABASE_URL}}
# TURSO_AUTH_TOKEN={{TURSO_AUTH_TOKEN}}

# Install and run
pnpm install
pnpm dev
```

Visit http://localhost:4321

## How It Works

This Astro site fetches your published content from your Turso database at build time. LiteShow handles all the database infrastructure and content management - you just publish your content and deploy!

## Project Structure

```
/
├── src/
│   ├── components/
│   │   └── blocks/         # Content block components
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── lib/
│   │   └── content-api.ts  # Turso database client
│   └── pages/
│       ├── index.astro     # Home page
│       ├── [slug].astro    # Dynamic pages
│       └── 404.astro       # Not found page
├── astro.config.mjs
├── package.json
└── netlify.toml            # Netlify config
```
