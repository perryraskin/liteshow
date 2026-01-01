# GitHub Actions Workflow for GitHub Pages Deployment

This document describes the GitHub Actions workflow that needs to be added to the Astro site template in the `liteshowcms/templates` repository.

## File Location

Create this file in the templates repository:
```
liteshowcms/templates/astro/.github/workflows/deploy.yml
```

## Workflow Content

```yaml
name: Deploy to GitHub Pages

on:
  # Trigger on push to main branch
  push:
    branches: [main]

  # Allow manual trigger from Actions tab
  workflow_dispatch:

# Sets permissions for GitHub Pages deployment
permissions:
  contents: read
  pages: write
  id-token: write

# Allow one concurrent deployment
concurrency:
  group: "pages"
  cancel-in-progress: true

env:
  BUILD_PATH: "." # Astro site location

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install
        working-directory: ${{ env.BUILD_PATH }}

      - name: Build with Astro
        env:
          PUBLIC_API_URL: ${{ secrets.LITESHOW_API_URL }}
        run: pnpm build
        working-directory: ${{ env.BUILD_PATH }}

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ${{ env.BUILD_PATH }}/dist

  deploy:
    name: Deploy
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Required Repository Secrets

When projects are created, the following secret must be configured in the GitHub repository:

1. **LITESHOW_API_URL** - The URL of the Liteshow API (e.g., `https://api.liteshow.com`)

This is automatically set by Liteshow when creating the GitHub repository. The Astro site will fetch all content from the API rather than connecting directly to the database.

## GitHub Pages Configuration

The repository must have GitHub Pages enabled with:
- **Source**: GitHub Actions
- **Branch**: Not applicable (using Actions)

This is automatically configured by Liteshow when setting up the repository.

## Workflow Triggers

The workflow runs automatically on:
1. **Push to main branch** - Any commit to main triggers a new deployment
2. **Manual trigger** - Can be triggered from GitHub Actions tab
3. **Auto-deploy on save** - When enabled in Liteshow, saving content triggers a commit which triggers deployment

## Implementation Notes

### For Template Repository
- Add this workflow file to `liteshowcms/templates/astro/.github/workflows/deploy.yml`
- The workflow will be included when new projects are created

### For API Integration (Future Enhancement)
To implement full deployment automation:

1. **Trigger deployments from API**:
```typescript
// In apps/api/src/lib/github-pages.ts
import { Octokit } from '@octokit/rest';

async function triggerDeployment(owner: string, repo: string, token: string) {
  const octokit = new Octokit({ auth: token });

  // Trigger workflow_dispatch event
  await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: 'deploy.yml',
    ref: 'main',
  });
}
```

2. **Monitor deployment status**:
```typescript
async function getDeploymentStatus(owner: string, repo: string, token: string) {
  const octokit = new Octokit({ auth: token });

  // Get latest workflow run
  const { data } = await octokit.actions.listWorkflowRuns({
    owner,
    repo,
    workflow_id: 'deploy.yml',
    per_page: 1,
  });

  return data.workflow_runs[0]?.status;
}
```

3. **Auto-deploy on save**:
- When user saves a page with `autoDeployOnSave` enabled
- Commit changes to GitHub (already implemented in git-sync.ts)
- The commit automatically triggers the workflow
- No additional API call needed!

## Testing

To test the workflow:

1. Create a new project in Liteshow
2. Connect it to a GitHub repository
3. Enable GitHub Pages in repository settings (Source: GitHub Actions)
4. Push the template files including the workflow
5. Make a commit to main branch
6. Check the Actions tab to see the deployment progress
7. Visit the GitHub Pages URL to see the deployed site

## Architecture Notes

The Astro site fetches all content from the Liteshow API rather than connecting directly to Turso:

- **API-First**: Site makes API calls to fetch pages, blocks, and metadata
- **No Direct DB Access**: Turso credentials stay secure in the API layer
- **Simple Secrets**: Only needs the API URL, not database credentials
- **Consistent Access**: All data access goes through the same API as the dashboard

## Benefits

- **Automatic builds** - Every commit triggers a fresh build
- **Secure by default** - No database credentials in GitHub repos
- **Deploy previews** - Can be extended to deploy PR previews
- **Status tracking** - GitHub Actions provides detailed logs
- **Free hosting** - GitHub Pages is free for public repos
