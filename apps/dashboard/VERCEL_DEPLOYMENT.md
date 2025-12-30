# Vercel Deployment Guide for LiteShow Dashboard

## Prerequisites

- Vercel account
- GitHub repository connected to Vercel
- Production API running at `api.liteshow.io`

## Setup Steps

### 1. Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your `liteshow` GitHub repository
4. Select the `apps/dashboard` directory as the root directory

### 2. Configure Build Settings

Vercel should auto-detect Next.js. Verify these settings:

- **Framework Preset**: Next.js
- **Root Directory**: `apps/dashboard`
- **Build Command**: `cd ../.. && pnpm install && pnpm --filter @liteshow/dashboard build`
- **Output Directory**: `.next` (default)
- **Install Command**: `pnpm install`

### 3. Environment Variables

Add the following environment variables in Vercel Dashboard (Settings → Environment Variables):

#### Required Variables

```bash
# Database (Neon PostgreSQL)
DATABASE_URL="your_neon_connection_string"

# GitHub OAuth
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"

# Turso (for project content databases)
TURSO_API_TOKEN="your_turso_api_token"
TURSO_ORG="your_turso_org_name"

# Better Auth
AUTH_SECRET="your_auth_secret_key"
BETTER_AUTH_URL="https://api.liteshow.io/auth"

# App URLs (PRODUCTION - will be updated after deployment)
NEXT_PUBLIC_APP_URL="https://app.liteshow.io"
NEXT_PUBLIC_API_URL="https://api.liteshow.io"

# AI Provider (Anthropic Claude)
ANTHROPIC_API_KEY="your_anthropic_api_key"
```

**Note**: Replace all placeholder values with your actual credentials from your local `.env` file.

**Important Notes:**
- `BETTER_AUTH_URL` points to the production API
- `NEXT_PUBLIC_API_URL` should be `https://api.liteshow.io` (no /api suffix)
- `NEXT_PUBLIC_APP_URL` will be your Vercel deployment URL initially, then update to `https://app.liteshow.io` after adding custom domain

### 4. Deploy

1. Click "Deploy" in Vercel
2. Wait for the build to complete
3. Verify the deployment works at the generated Vercel URL (e.g., `liteshow-dashboard.vercel.app`)

### 5. Add Custom Domain

1. Go to Project Settings → Domains
2. Add custom domain: `app.liteshow.io`
3. Configure DNS records as instructed by Vercel:
   - Add a CNAME record pointing `app` to `cname.vercel-dns.com`
4. Wait for SSL certificate to provision (usually 1-2 minutes)

### 6. Update Environment Variables (Post-Deployment)

After adding the custom domain, update this environment variable:

```bash
NEXT_PUBLIC_APP_URL="https://app.liteshow.io"
```

Then redeploy for the change to take effect.

### 7. Update GitHub OAuth Callback

Update your GitHub OAuth App callback URL to include the production domain:

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Edit your LiteShow OAuth App
3. Update Authorization callback URL to: `https://api.liteshow.io/auth/callback/github`

## Troubleshooting

### Build Fails with "Module not found"

- Ensure the build command includes `cd ../.. && pnpm install` to install monorepo dependencies
- Verify all workspace packages are properly linked

### Authentication Not Working

- Check that `BETTER_AUTH_URL` is set to `https://api.liteshow.io/auth`
- Verify `NEXT_PUBLIC_API_URL` is set to `https://api.liteshow.io` (no /api suffix)
- Ensure GitHub OAuth callback URL matches the production API URL

### Database Connection Issues

- Verify `DATABASE_URL` is correct and the Neon database is accessible
- Check that the connection string includes `sslmode=require`

## Monitoring

- View deployment logs in Vercel Dashboard
- Check runtime logs in Vercel Dashboard → Deployments → [Select deployment] → Logs
- Monitor API health at `https://api.liteshow.io/health`
