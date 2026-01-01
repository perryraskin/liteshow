# Liteshow Sites - Astro Frontend

Public-facing Astro site that renders content from Liteshow projects.

## Features

- 🚀 **Fast Static Sites** - Astro generates optimized static HTML
- 🎨 **Beautiful Design** - Modern Tailwind CSS components
- 📦 **Block-Based Content** - Renders Hero, Features, Testimonials, CTA, FAQ, and Markdown blocks
- 🔒 **Published Content Only** - Only shows published pages
- 📱 **Responsive** - Mobile-first design

## Block Components

- **Hero**: Large banner with headline, subheadline, and CTA button
- **Features**: Grid of feature cards with icons
- **Testimonials**: Customer reviews with avatars
- **CTA**: Call-to-action section with button
- **Markdown**: Rich text content with styling
- **FAQ**: Frequently asked questions

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your project's Turso database credentials:
   ```env
   TURSO_DB_URL=your-project.turso.io
   TURSO_DB_TOKEN=your-turso-token
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Visit `http://localhost:4321` to see your site

## Development

```bash
pnpm dev
```

## Build for Production

```bash
pnpm build
```

The static site will be generated in the `dist/` directory.

## Deployment

Deploy the `dist/` directory to any static hosting provider:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- AWS S3 + CloudFront

## Page Routes

- `/` - Redirects to `/home` or `/index` if they exist
- `/[slug]` - Any page with a matching slug in the database
- `/404` - Not found page
