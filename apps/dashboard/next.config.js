/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@liteshow/ui', '@liteshow/auth'],

  // Allow dev origins for Cloudflare tunnel
  allowedDevOrigins: ['devpi-3001.shmob.xyz'],

  experimental: {
    // Enable Turbopack filesystem caching for faster dev server restarts
    turbopackFileSystemCacheForDev: true,
  },
}

module.exports = nextConfig
