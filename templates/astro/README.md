# {{PROJECT_NAME}}

Built with [Liteshow](https://liteshow.io) - AI-first, SEO-optimized, Git-powered CMS

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
- **GitHub Pages** - 1-click deployment coming soon!
- **AWS S3 + CloudFront** - Upload `dist/` folder
- **Any static host** - Just upload the `dist/` folder

## Environment Variables

Add these in your deployment platform's dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `LITESHOW_API_URL` | `https://api.liteshow.io` | Liteshow API URL (use default unless custom) |
| `LITESHOW_PROJECT_SLUG` | `your-project-slug` | Your project slug from Liteshow |

**Where to get these values:**
1. Go to your Liteshow project settings
2. Find your project slug in the deployment section
3. Add these environment variables to your hosting platform

**Important:** Content is fetched from the API at **build time**, so you need to trigger a new deployment when you publish content in Liteshow.

## Local Development

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your configuration
# Get your project slug from your Liteshow project settings
# LITESHOW_API_URL=https://api.liteshow.io
# LITESHOW_PROJECT_SLUG=your-project-slug

# Install and run
pnpm install
pnpm dev
```

Visit http://localhost:4321

## How It Works

This Astro site fetches your published content from the Liteshow API at build time. The API securely connects to your project's database and serves your content - you just publish your content and deploy!

## Project Structure

```
/
├── src/
│   ├── components/
│   │   └── blocks/         # Content block components
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── lib/
│   │   └── content-api.ts  # Liteshow API client
│   └── pages/
│       ├── index.astro     # Home page
│       ├── [slug].astro    # Dynamic pages
│       └── 404.astro       # Not found page
├── astro.config.mjs
├── package.json
└── netlify.toml            # Netlify config
```
