# Deployment Guide

This guide explains how to deploy your Liteshow sites to GitHub Pages.

## Overview

Liteshow uses GitHub Actions to automatically build and deploy your Astro sites to GitHub Pages. This provides:

- **Free hosting** for public repositories
- **Automatic deployments** on every commit
- **Custom domain support** with HTTPS
- **Real-time deployment status** in the dashboard

## How It Works

1. **Save Content**: Make changes to your pages and blocks in the Liteshow dashboard
2. **Deploy**: Click "Deploy Now" in the Deployment tab
3. **GitHub Actions**: A workflow runs to build your Astro site
4. **GitHub Pages**: Your site goes live at `https://username.github.io/repo-name`

## Deployment Tab Features

### Current Status
Shows your site's deployment status in real-time:
- **Live** (green): Site is successfully deployed
- **Building** (spinning): Deployment in progress
- **Failed** (red): Deployment encountered an error
- **Not Deployed** (gray): No deployments yet

### Deploy Now Button
Manually trigger a deployment at any time. Deployment typically takes 2-3 minutes.

### Auto-Deploy on Save
Enable this to automatically deploy whenever you save content changes. Great for live sites where you want instant updates.

### Custom Domain
Configure your own domain instead of the default GitHub Pages URL:

1. Enter your domain (e.g., `www.example.com`)
2. Save the configuration
3. Add the CNAME DNS record shown in the instructions
4. Wait for DNS propagation (up to 24 hours)

### Deployment History
View your recent deployments with:
- Status badges
- Commit SHA hashes
- Timestamps
- Error messages (if applicable)

## GitHub Actions Workflow

The deployment uses a GitHub Actions workflow file at `.github/workflows/deploy.yml`. This workflow:

1. Checks out your repository
2. Installs Node.js and pnpm
3. Installs dependencies
4. Builds your Astro site
5. Deploys to GitHub Pages

**Important**: The workflow needs the `LITESHOW_API_URL` secret to be set in your repository. Liteshow sets this automatically when creating the project.

## Status Indicator

The deployment status badge appears:
- In the Deployment tab header
- Next to your project name in the project header

This badge updates automatically every 10-15 seconds, so you can watch your deployment progress in real-time.

## Triggering Deployments

### Manual Deployment
Click "Deploy Now" in the Deployment tab to trigger a deployment immediately.

### Auto-Deploy
Enable "Auto-deploy on Save" to automatically deploy whenever you:
- Save a page
- Update blocks
- Change page status

### Git Push
You can also trigger deployments by pushing directly to the `main` branch of your GitHub repository.

## Custom Domains

### Setting Up a Custom Domain

1. Go to the Deployment tab
2. Enter your domain in the "Custom Domain" field
3. Click "Save"
4. Follow the DNS configuration instructions shown

### DNS Configuration

Add a CNAME record to your domain:
- **Type**: CNAME
- **Name**: Your subdomain (e.g., `www` or `blog`)
- **Value**: `username.github.io` (your GitHub Pages URL)

### DNS Propagation

DNS changes can take up to 24 hours to propagate globally. You can check the status using tools like:
- https://dnschecker.org
- https://www.whatsmydns.net

## Troubleshooting

### Deployment Failed

If your deployment fails:

1. Check the deployment history for error messages
2. Visit your GitHub repository's Actions tab to see detailed logs
3. Common issues:
   - Build errors in your Astro site
   - Missing dependencies
   - Invalid API URL secret

### Site Not Updating

If your site isn't showing the latest content:

1. Verify the deployment status is "Live"
2. Clear your browser cache
3. Check if your deployment completed successfully
4. Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Custom Domain Not Working

If your custom domain isn't working:

1. Verify your DNS records are correct
2. Wait for DNS propagation (up to 24 hours)
3. Check that HTTPS is enabled in your GitHub Pages settings
4. Ensure you're using the correct CNAME value

## GitHub Pages Settings

Your repository must have GitHub Pages enabled with:
- **Source**: GitHub Actions (not a branch)
- **Build and deployment**: GitHub Actions workflow

Liteshow configures this automatically when you create a project.

## Deployment Status Polling

The dashboard automatically polls the deployment status every 10-15 seconds when:
- You're viewing the Deployment tab
- You're on the project page (header indicator)

This keeps you informed about deployment progress without manually refreshing.

## API-First Architecture

**Important**: Your Astro site fetches content from the Liteshow API, not directly from the database. This means:

- No database credentials in your GitHub repository
- Consistent data access across dashboard and site
- Simpler deployment configuration
- Better security

The only secret needed is `LITESHOW_API_URL`, which points to the Liteshow API server.

## Next Steps

After deploying your site:

1. **Test your site**: Visit the live URL and verify everything works
2. **Configure custom domain**: Set up your own domain if desired
3. **Enable auto-deploy**: Turn on automatic deployments for instant updates
4. **Monitor deployments**: Check the deployment history regularly

## Support

If you encounter issues:

1. Check the deployment logs in GitHub Actions
2. Review the error messages in deployment history
3. Verify your GitHub Pages settings
4. Ensure your DNS records are correct (for custom domains)
