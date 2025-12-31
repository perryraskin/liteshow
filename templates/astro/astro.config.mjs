import { defineConfig } from 'astro/config';

// https://astro.build/config
// Static output works on Netlify, Vercel, Cloudflare Pages, and any static host
export default defineConfig({
  output: 'static',
  site: '{{SITE_URL}}',
});
