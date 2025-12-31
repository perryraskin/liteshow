/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@liteshow/ui', '@liteshow/auth'],

  experimental: {
    // Enable Turbopack filesystem caching for faster dev server restarts
    turbopackFileSystemCacheForDev: true,
  },
}

module.exports = nextConfig
