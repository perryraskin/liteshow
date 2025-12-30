import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  output: 'server',
  server: {
    port: 4321,
  },
  vite: {
    server: {
      allowedHosts: ['devpi-4321.shmob.xyz'],
    },
  },
});
