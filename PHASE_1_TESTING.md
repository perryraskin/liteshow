# Phase 1 Testing Checklist

This document provides step-by-step instructions to test Phase 1 (Core Infrastructure & Authentication).

---

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] pnpm 8+ installed
- [ ] Git repository cloned
- [ ] Dependencies installed (`pnpm install`)

---

## Step 1: Choose Your Database Option

### Option A: Neon (Recommended - Easiest)

- [ ] Go to [neon.tech](https://neon.tech)
- [ ] Sign up for a free account
- [ ] Create a new project
- [ ] Copy the connection string (looks like: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb`)
- [ ] Save it for the `.env` file in Step 3

### Option B: Docker (Local Development)

- [ ] Ensure Docker is installed and running
- [ ] Start PostgreSQL container:
  ```bash
  docker-compose up -d
  ```
- [ ] Verify it's running:
  ```bash
  docker-compose ps
  ```
- [ ] You should see `liteshow-postgres` with status "Up"

---

## Step 2: Create GitHub OAuth App

- [ ] Go to [GitHub Developer Settings](https://github.com/settings/developers)
- [ ] Click **"OAuth Apps"** in the left sidebar
- [ ] Click **"New OAuth App"**
- [ ] Fill in the form:
  - **Application name**: `LiteShow Local Dev` (or any name you prefer)
  - **Homepage URL**: `http://localhost:3000`
  - **Application description**: (optional) `Local development for LiteShow CMS`
  - **Authorization callback URL**: `http://localhost:8000/api/auth/callback/github`
- [ ] Click **"Register application"**
- [ ] Copy the **Client ID** (you'll need this for `.env`)
- [ ] Click **"Generate a new client secret"**
- [ ] Copy the **Client Secret** immediately (it won't be shown again)
- [ ] Save both values for Step 3

---

## Step 3: Configure Environment Variables

- [ ] Copy the example environment file:
  ```bash
  cp .env.example .env
  ```

- [ ] Open `.env` in your text editor

- [ ] Set **DATABASE_URL**:
  - **If using Neon** (from Step 1, Option A):
    ```bash
    DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
    ```
    ⚠️ Make sure to add `?sslmode=require` at the end!

  - **If using Docker** (from Step 1, Option B):
    ```bash
    DATABASE_URL="postgresql://liteshow:liteshow@localhost:5432/liteshow"
    ```

- [ ] Set **GitHub OAuth** credentials (from Step 2):
  ```bash
  GITHUB_CLIENT_ID="your_github_client_id_here"
  GITHUB_CLIENT_SECRET="your_github_client_secret_here"
  ```

- [ ] Set **AUTH_SECRET** (generate a random string):
  ```bash
  # Option 1: Generate with OpenSSL
  openssl rand -base64 32

  # Option 2: Use any random string (at least 32 characters)
  # Example: AUTH_SECRET="my_super_secret_random_string_here_123456789"
  ```
  Copy the output and set:
  ```bash
  AUTH_SECRET="paste_generated_secret_here"
  ```

- [ ] Verify these values are correct (should already be set for local dev):
  ```bash
  BETTER_AUTH_URL="http://localhost:8000"
  NEXT_PUBLIC_APP_URL="http://localhost:3000"
  NEXT_PUBLIC_API_URL="http://localhost:8000"
  API_PORT="8000"
  ```

- [ ] Set placeholders for services not needed in Phase 1:
  ```bash
  TURSO_API_TOKEN="placeholder_not_needed_for_phase1"
  ANTHROPIC_API_KEY="placeholder_not_needed_for_phase1"
  ```

- [ ] Save the `.env` file

---

## Step 4: Run Database Migrations

- [ ] Navigate to the database package:
  ```bash
  cd packages/db
  ```

- [ ] Generate migration files:
  ```bash
  pnpm db:generate
  ```

- [ ] Push schema to database:
  ```bash
  pnpm db:push
  ```

  Expected output: Success message with tables created (users, projects, domains, activity_logs)

- [ ] Return to root directory:
  ```bash
  cd ../..
  ```

---

## Step 5: Start Development Servers

- [ ] Start all development servers:
  ```bash
  pnpm dev
  ```

- [ ] Wait for all servers to start. You should see:
  ```
  @liteshow/dashboard:dev: ▲ Next.js 14.x.x
  @liteshow/dashboard:dev: - Local: http://localhost:3000

  @liteshow/api:dev: 🚀 LiteShow API server starting on port 8000
  ```

- [ ] Verify no errors in the terminal

---

## Step 6: Test the Application

### Test 1: Landing Page

- [ ] Open browser and go to: http://localhost:3000
- [ ] You should see the LiteShow landing page
- [ ] Verify the page has:
  - [ ] "LiteShow" heading
  - [ ] "AI-First, SEO-Optimized, Git-Powered CMS" subtitle
  - [ ] "Sign in with GitHub" button
  - [ ] "View Dashboard" link

### Test 2: API Health Check

- [ ] Open a new terminal window
- [ ] Run health check:
  ```bash
  curl http://localhost:8000/api/health
  ```
- [ ] Expected response:
  ```json
  {
    "status": "healthy",
    "timestamp": "2024-xx-xxTxx:xx:xx.xxxZ",
    "service": "liteshow-api"
  }
  ```

### Test 3: GitHub OAuth Sign In

- [ ] Go to http://localhost:3000/login
- [ ] Click the **"Sign in with GitHub"** button
- [ ] You should be redirected to GitHub
- [ ] GitHub will show authorization screen asking to:
  - [ ] Access your email address
  - [ ] Access your repositories (repo scope)
- [ ] Click **"Authorize [your-app-name]"**
- [ ] You should be redirected back to: http://localhost:3000/dashboard

### Test 4: Dashboard Access

- [ ] After signing in, you should see the dashboard at http://localhost:3000/dashboard
- [ ] Verify the dashboard displays:
  - [ ] "LiteShow" in the navigation bar
  - [ ] Your GitHub email address in the top right
  - [ ] "Sign Out" button
  - [ ] "Dashboard" heading
  - [ ] "Welcome back! Your projects will appear here." message
  - [ ] "No projects yet. Create your first project to get started!" empty state
  - [ ] "Create Project (Phase 2)" button (disabled/placeholder)

### Test 5: Sign Out

- [ ] Click the **"Sign Out"** button in the dashboard
- [ ] You should be redirected to the home page (http://localhost:3000)
- [ ] Try accessing http://localhost:3000/dashboard again
- [ ] You should be redirected back to the login page

### Test 6: Protected Routes

- [ ] Make sure you're signed out
- [ ] Try to access http://localhost:3000/dashboard directly
- [ ] You should be automatically redirected to http://localhost:3000/login
- [ ] This confirms route protection is working

---

## Step 7: Verify Database

### If using Docker:

- [ ] Check that database tables were created:
  ```bash
  docker exec -it liteshow-postgres psql -U liteshow -d liteshow -c "\dt"
  ```

  Expected output should list tables:
  - `users`
  - `projects`
  - `domains`
  - `activity_logs`

- [ ] Check that your user was created after signing in:
  ```bash
  docker exec -it liteshow-postgres psql -U liteshow -d liteshow -c "SELECT github_username, github_email, created_at FROM users;"
  ```

  You should see your GitHub username and email.

### If using Neon:

- [ ] Go to your Neon dashboard
- [ ] Navigate to your project
- [ ] Click on "Tables" or "SQL Editor"
- [ ] Run query to verify tables exist:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public';
  ```
- [ ] Run query to verify your user was created:
  ```sql
  SELECT github_username, github_email, created_at FROM users;
  ```

---

## Success Criteria

Phase 1 is working correctly if:

- [x] ✅ All development servers start without errors
- [x] ✅ Landing page loads at http://localhost:3000
- [x] ✅ API health check returns healthy status
- [x] ✅ GitHub OAuth flow works (authorize → redirect → dashboard)
- [x] ✅ Dashboard displays user information
- [x] ✅ Sign out works and redirects to home
- [x] ✅ Protected routes redirect to login when not authenticated
- [x] ✅ Database tables are created
- [x] ✅ User record is created after sign in

---

## Troubleshooting

### Problem: "Cannot connect to database"

**Solution:**
- Check that `DATABASE_URL` in `.env` is correct
- If using Neon, ensure `?sslmode=require` is at the end
- If using Docker, run `docker-compose ps` to verify PostgreSQL is running
- Try restarting: `docker-compose restart postgres`

### Problem: "GitHub OAuth error" or "Redirect URI mismatch"

**Solution:**
- Verify callback URL in GitHub OAuth app is exactly: `http://localhost:8000/api/auth/callback/github`
- Check that `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env` match your OAuth app
- Ensure `BETTER_AUTH_URL` is set to `http://localhost:8000`
- Try regenerating the client secret in GitHub

### Problem: "Failed to compile" or TypeScript errors

**Solution:**
- Make sure you ran `pnpm install` after cloning
- Try: `rm -rf node_modules && pnpm install`
- Verify you're using Node.js 18+ and pnpm 8+

### Problem: "Port already in use"

**Solution:**
- Check if another app is using ports 3000 or 8000
- Kill existing processes:
  ```bash
  # macOS/Linux
  lsof -ti:3000 | xargs kill
  lsof -ti:8000 | xargs kill

  # Or change ports in .env:
  # For dashboard: modify next.config.js or use Next.js -p flag
  # For API: change API_PORT="8001" in .env
  ```

### Problem: Database migration fails

**Solution:**
- Delete existing migrations: `rm -rf packages/db/migrations/`
- Run migrations again: `cd packages/db && pnpm db:push && cd ../..`
- If still failing, check database credentials and connection

### Problem: Dashboard shows "Loading..." forever

**Solution:**
- Check browser console (F12) for errors
- Verify `NEXT_PUBLIC_API_URL` in `.env` is set to `http://localhost:8000`
- Check that API server is running and responding at http://localhost:8000/api/health
- Try clearing browser cookies and localStorage

---

## Stopping the Servers

- [ ] Press `Ctrl+C` in the terminal running `pnpm dev`
- [ ] If using Docker, stop PostgreSQL:
  ```bash
  docker-compose down
  ```
- [ ] To remove all data (WARNING: deletes database):
  ```bash
  docker-compose down -v
  ```

---

## Next Steps

Once Phase 1 testing is complete:

- [ ] Mark Phase 1 as tested ✅
- [ ] Proceed to Phase 2: Project Management & Content Model
- [ ] See `IMPLEMENTATION_PLAN.md` for Phase 2 details

---

## Notes

Add any observations or issues you encountered during testing:

```
[Your notes here]
```

---

**Phase 1 Testing Complete!** 🎉

Date completed: _______________
Tester: _______________
