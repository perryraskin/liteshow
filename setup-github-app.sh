#!/bin/bash

# GitHub App Setup Helper Script
# This script helps you configure your GitHub App credentials

echo "🚀 GitHub App Setup for LiteShow"
echo "================================"
echo ""

# Check if .env.local exists
if [ ! -f "apps/api/.env.local" ]; then
  echo "❌ Error: apps/api/.env.local not found"
  exit 1
fi

echo "📝 Please create your GitHub App at: https://github.com/settings/apps/new"
echo ""
echo "Use these settings:"
echo "  - GitHub App name: liteshow (or liteshow-dev for testing)"
echo "  - Homepage URL: https://liteshow.io"
echo "  - Callback URL: https://devpi-3008.shmob.xyz/dashboard/projects/[id]/setup-github/select-repo"
echo "  - Webhook: Unchecked (disabled)"
echo "  - Repository permissions: Contents (Read & write), Metadata (Read-only)"
echo "  - User permissions: Email addresses (Read-only)"
echo "  - Where can this GitHub App be installed?: Any account"
echo ""
echo "After creating the app, you'll need:"
echo "  1. App ID (shown at top of app page)"
echo "  2. Client ID (in About section)"
echo "  3. Client Secret (generate a new one)"
echo "  4. Private Key (.pem file - download it)"
echo ""
echo "Press Enter when you have these values ready..."
read

# Prompt for values
echo ""
echo "Enter your GitHub App credentials:"
echo ""

read -p "App ID: " APP_ID
read -p "Client ID: " CLIENT_ID
read -p "Client Secret: " CLIENT_SECRET
read -p "App Name (e.g., 'liteshow' or 'liteshow-dev'): " APP_NAME
read -p "Private Key file path: " PRIVATE_KEY_PATH

if [ ! -f "$PRIVATE_KEY_PATH" ]; then
  echo "❌ Error: Private key file not found at $PRIVATE_KEY_PATH"
  exit 1
fi

# Read and base64 encode the private key
PRIVATE_KEY_BASE64=$(base64 -w 0 "$PRIVATE_KEY_PATH")

# Append to .env.local
echo "" >> apps/api/.env.local
echo "# GitHub App Configuration" >> apps/api/.env.local
echo "GITHUB_APP_ID=\"$APP_ID\"" >> apps/api/.env.local
echo "GITHUB_APP_CLIENT_ID=\"$CLIENT_ID\"" >> apps/api/.env.local
echo "GITHUB_APP_CLIENT_SECRET=\"$CLIENT_SECRET\"" >> apps/api/.env.local
echo "GITHUB_APP_NAME=\"$APP_NAME\"" >> apps/api/.env.local
echo "GITHUB_APP_PRIVATE_KEY=\"$PRIVATE_KEY_BASE64\"" >> apps/api/.env.local

echo ""
echo "✅ GitHub App credentials added to apps/api/.env.local"
echo ""
echo "📦 Installing required npm package..."
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken

echo ""
echo "🔄 Please restart your API server for changes to take effect"
echo ""
echo "Next steps:"
echo "  1. Restart: cd apps/api && pnpm dev"
echo "  2. Install the app on your GitHub account:"
echo "     https://github.com/apps/$APP_NAME/installations/new"
echo "  3. Test by creating a project with 'Link Later', then 'Setup GitHub' -> 'Connect with GitHub App'"
echo ""
echo "Done! 🎉"
