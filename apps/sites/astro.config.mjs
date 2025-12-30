import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [tailwind()],
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  server: {
    port: 4321,
  },
  vite: {
    server: {
      allowedHosts: ['devpi-4321.shmob.xyz'],
    },
  },
});
