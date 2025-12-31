# GitHub App Quick Start Guide

The GitHub App integration is now fully implemented! Here's how to set it up:

## What's Implemented ✅

1. **GitHub App Installation Flow** - Users can install the LiteShow GitHub App
2. **Repository Selection** - After installation, users select which repo to link
3. **Fine-grained Access** - Users control which repos the app can access
4. **Backend Integration** - Full API support for GitHub App authentication

## Quick Setup (2 Minutes)

### Option 1: Automated Setup Script

```bash
./setup-github-app.sh
```

This script will:
- Prompt you for GitHub App credentials
- Add them to your `.env.local`
- Install required npm packages

### Option 2: Manual Setup

1. **Create GitHub App**: https://github.com/settings/apps/new

   Fill in:
   - **Name**: `liteshow-dev` (or any name you want)
   - **Homepage**: `https://liteshow.io`
   - **Callback URL**: (leave blank, we handle it differently)
   - **Webhook**: Uncheck "Active"

   **Permissions**:
   - Repository permissions → Contents: **Read & write**
   - Repository permissions → Metadata: **Read-only** (auto-selected)
   - User permissions → Email: **Read-only**

   **Install**: Any account

2. **Get Credentials**:
   - App ID (at top of page)
   - Client ID (in "About" section)
   - Client Secret (click "Generate")
   - Private Key (click "Generate" and download .pem file)

3. **Add to `.env.local`**:

   ```bash
   # In apps/api/.env.local
   GITHUB_APP_ID="123456"
   GITHUB_APP_CLIENT_ID="Iv1.abc123def456"
   GITHUB_APP_CLIENT_SECRET="your-secret-here"
   GITHUB_APP_NAME="liteshow-dev"
   GITHUB_APP_PRIVATE_KEY="<base64-encoded-private-key>"
   ```

   To base64 encode your private key:
   ```bash
   base64 -w 0 path/to/your-private-key.pem
   ```

4. **Install npm package**:
   ```bash
   npm install jsonwebtoken @types/jsonwebtoken
   ```

5. **Restart API server**

## How to Test

1. Create a new project with "Link Later"
2. On the project page, click "Setup GitHub"
3. Choose "Connect with GitHub App"
4. You'll be redirected to GitHub to install the app
5. Select repositories to grant access
6. Choose which repository to link
7. Done! Repository is now connected

## User Flow

```
Create Project (Link Later)
    ↓
Click "Setup GitHub"
    ↓
Choose "Connect with GitHub App"
    ↓
Install GitHub App on your account
    ↓
Grant access to specific repositories
    ↓
Select which repository to link
    ↓
Repository connected!
```

## Benefits vs OAuth

| Feature | OAuth | GitHub App |
|---------|-------|------------|
| Repo creation | ✅ Automatic | ❌ Manual |
| Access control | All public or all private | Per-repository |
| Organizations | Limited | Full support |
| Existing repos | ❌ No | ✅ Yes |
| Setup complexity | Simple | Moderate |

## Troubleshooting

### "GitHub App not configured" error

Make sure all environment variables are set:
```bash
grep GITHUB_APP apps/api/.env.local
```

Should show all 5 variables (ID, CLIENT_ID, CLIENT_SECRET, NAME, PRIVATE_KEY).

### "Failed to list installation repositories"

This usually means:
1. The private key is incorrect or not base64 encoded
2. The App ID doesn't match the private key
3. The installation was revoked

### No repositories showing

Users need to grant the app access to repositories:
1. Go to https://github.com/settings/installations
2. Find your LiteShow app
3. Click "Configure"
4. Under "Repository access", select repositories

## Architecture

### Frontend Flow
1. `setup-github/page.tsx` - Main setup page with OAuth vs GitHub App choice
2. User clicks "Connect with GitHub App" → Redirects to GitHub
3. GitHub redirects back with `installation_id`
4. `select-repo/page.tsx` - Shows available repositories
5. User selects repo → API call to link it

### Backend Flow
1. `/github-app/installations/:id/repos` - Lists accessible repositories
2. `/projects/:id/link-github` - Links selected repository
3. Uses JWT + installation token for GitHub API calls

### Database
Projects table stores:
- `githubAuthType`: `'oauth'` or `'github_app'`
- `githubInstallationId`: GitHub App installation ID
- `githubRepoId`: Full repo name (`owner/repo`)

## Next Steps

After setup:
- Test creating a project with "Link Later"
- Test the GitHub App installation flow
- Users can now choose between OAuth (automatic) or GitHub App (existing repos)

## Documentation

Full details in: `/docs/GITHUB_APP_SETUP.md`
