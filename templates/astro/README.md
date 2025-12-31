# {{PROJECT_NAME}}

Built with [LiteShow](https://liteshow.io) - AI-first, SEO-optimized, Git-powered CMS

## Deploy Your Site

This is a static Astro site that works on **any hosting platform**. Choose your preferred platform below.

### ⚡ Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

1. Click the deploy button above OR go to [Vercel](https://vercel.com/new)
2. Import this repository from GitHub
3. Vercel will auto-detect settings:
   - **Framework:** Astro
   - **Build command:** `pnpm install && pnpm build`
   - **Output directory:** `dist`
4. Add environment variables (see below)
5. Click **Deploy**

### 📦 Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

1. Click the deploy button above OR go to [Netlify](https://app.netlify.com/start)
2. Import this repository from GitHub
3. Netlify will auto-detect settings:
   - **Build command:** `pnpm install && pnpm build`
   - **Publish directory:** `dist`
4. Add environment variables (see below)
5. Click **Deploy site**

### 🚀 Other Platforms

This static site also works on:
- **Cloudflare Pages** - Auto-detects Astro
- **GitHub Pages** - Use `gh-pages` branch
- **AWS S3 + CloudFront** - Upload `dist/` folder
- **Any static host** - Just upload the `dist/` folder

## Environment Variables

Add these in your deployment platform's dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` | Your Turso database URL |
| `TURSO_AUTH_TOKEN` | `eyJ...` | Your Turso auth token |

**Where to get these values:**
1. Go to your LiteShow project settings
2. Copy the database URL and auth token
3. Paste them into your hosting platform's environment variables

**Important:** These values are fetched at **build time**, so you need to trigger a new deployment when you publish content in LiteShow.

## Local Development

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your configuration
# Get these values from your LiteShow project settings
# TURSO_DATABASE_URL=libsql://your-database.turso.io
# TURSO_AUTH_TOKEN=your-token-here

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
