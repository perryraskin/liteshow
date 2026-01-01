import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
// Static output works on Netlify, Vercel, Cloudflare Pages, and any static host
export default defineConfig({
  output: 'static',
  // Site URL is optional - set via SITE_URL environment variable if needed for absolute URLs/sitemaps
  ...(process.env.SITE_URL && { site: process.env.SITE_URL }),
  integrations: [tailwind()],
});
