#!/bin/bash
# Simple dev script - just copies .env.dev and runs servers

cp apps/api/.env.dev apps/api/.env
cp apps/dashboard/.env.dev apps/dashboard/.env

echo "Starting servers with .env.dev configuration..."
echo "Dashboard: https://devpi-3001.shmob.xyz"
echo "API: https://devpi-3008.shmob.xyz"
echo ""

# Use npx to run pnpm commands
npx pnpm dev
