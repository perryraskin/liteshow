# GitHub App Setup Guide

This guide will help you create and configure a GitHub App for Liteshow.

## Step 1: Create GitHub App

1. Go to https://github.com/settings/apps
2. Click "New GitHub App"
3. Fill in the following details:

### Basic Information
- **GitHub App name**: `Liteshow` (or `Liteshow Dev` for testing)
- **Homepage URL**: `https://liteshow.io` (or your dev URL)
- **Callback URL**: `https://api.liteshow.io/auth/github-app/callback` (or `https://devpi-3008.shmob.xyz/auth/github-app/callback` for local dev)
- **Setup URL** (optional): Leave blank
- **Webhook**: Uncheck "Active" (we'll enable this later for automatic deployments)

### Permissions

**Repository permissions:**
- Contents: Read and write (to push content files)
- Metadata: Read-only (required)

**User permissions:**
- Email addresses: Read-only (to identify the user)

### Where can this GitHub App be installed?
- Select "Any account" (allows users to install on personal accounts or organizations)

## Step 2: Generate Private Key

After creating the app:
1. Scroll down to "Private keys"
2. Click "Generate a private key"
3. Save the downloaded `.pem` file securely

## Step 3: Get App Credentials

From your GitHub App page, note these values:
- **App ID**: Found at the top of the page
- **Client ID**: In the "About" section
- **Client Secret**: Click "Generate a new client secret"

## Step 4: Add to Environment Variables

### For Local Development (.env.local):

```bash
# GitHub App Configuration
GITHUB_APP_ID="your-app-id"
GITHUB_APP_CLIENT_ID="your-client-id"
GITHUB_APP_CLIENT_SECRET="your-client-secret"
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...your private key content...
-----END RSA PRIVATE KEY-----"
```

**Note**: For the private key, you can either:
- Paste the entire key content as shown above (including BEGIN/END lines)
- Or use a file path: `GITHUB_APP_PRIVATE_KEY_PATH="/path/to/private-key.pem"`

### For Production (.env.production):

Same variables, but use production URLs:
- Callback URL: `https://api.liteshow.io/auth/github-app/callback`

## Step 5: Install the App

After setup:
1. Go to your GitHub App page
2. Click "Install App" in the left sidebar
3. Select your account
4. Choose "Only select repositories" and pick a test repo
5. Click "Install"

## Step 6: Test the Installation

1. In Liteshow, create a new project with "Link Later"
2. Click "Setup GitHub"
3. Choose "Connect with GitHub App"
4. You should be redirected to install/configure the app

## Troubleshooting

### "GitHub App not configured" error
- Make sure all environment variables are set in `.env.local`
- Restart your API server after adding env vars

### "Callback URL mismatch" error
- Verify the callback URL in your GitHub App matches your environment
- For local dev: `https://devpi-3008.shmob.xyz/auth/github-app/callback`
- For production: `https://api.liteshow.io/auth/github-app/callback`

### "Permission denied" errors
- Check that your app has "Contents: Read and write" permission
- Users must grant access to the specific repository

## Next Steps

Once configured, users can:
1. Create their own repository (public or private)
2. Install the Liteshow GitHub App
3. Grant access to specific repositories
4. Connect those repositories to Liteshow projects
