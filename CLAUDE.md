# Liteshow - Claude Instructions

Project-specific instructions for AI assistants working on Liteshow.

## Project Overview

Liteshow is an AI-first, SEO-optimized, Git-powered CMS built with:
- **Monorepo**: Turborepo with pnpm workspaces
- **Frontend**: Next.js (dashboard), Astro (public sites)
- **Backend**: Hono API
- **Databases**: PostgreSQL (main), Turso SQLite (per-project content)
- **Auth**: Better Auth with GitHub OAuth
- **Styling**: Tailwind CSS, shadcn/ui
- **Deployment**: Vercel (dashboard), TBD (sites)

## Phase Completion Protocol

### When completing a phase or sub-phase:

1. **Update README.md** to mark tasks as complete
   - Change `[ ]` to `[x]` for completed items
   - Update the "Current Status" line
   - Add newly discovered tasks to appropriate phase sections

2. **Commit with descriptive message** following the format:
   ```
   feat: [Phase X.Y] - Brief description

   Detailed changes:
   - Bullet point 1
   - Bullet point 2

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
   ```

3. **Update IMPLEMENTATION_PLAN.md** if architecture changes significantly

4. **Document new features** in relevant docs/ files

5. **Update ARCHITECTURE.md** with any new components, services, or data flows
   - Keep the Mermaid diagram current with the actual implementation
   - Add new packages, apps, or external services
   - Update authentication/data flows when they change
   - Document any new integrations (GitHub App, external APIs, etc.)

## Architecture Documentation

**IMPORTANT**: Maintain the living architecture diagram in `ARCHITECTURE.md`

### When to Update the Architecture Diagram:

- **Adding new apps or packages** to the monorepo
- **Implementing new API routes** or significant endpoints
- **Adding database tables** or schemas
- **Integrating external services** (GitHub App, Turso, deployment platforms)
- **Changing authentication flows** or adding new auth methods
- **Adding deployment targets** or infrastructure

### How to Update:

1. Edit the Mermaid diagram in `ARCHITECTURE.md`
2. Keep it at a high level - show components, not implementation details
3. Use clear labels and relationships
4. Include brief descriptions for new components
5. Test the diagram renders correctly in GitHub/IDE preview

## Code Conventions

### File Organization
- Place new components in appropriate app/package directories
- Shared components go in `packages/ui`
- Database schemas in `packages/db/src/`
- API routes in `apps/api/src/routes/`

### TypeScript
- Use strict mode - no `any` types without justification
- Export types for public interfaces
- Use Zod for runtime validation at API boundaries

### React/Next.js
- Use Server Components by default
- Add `'use client'` only when necessary
- Prefer composition over prop drilling

### Database
- Use Drizzle ORM for all queries
- Never expose raw SQL to users
- Validate all inputs with Zod before database operations

### API Routes
- Follow RESTful conventions
- Use Hono validators for request validation
- Return consistent error responses: `{ error: "message" }`
- Include proper HTTP status codes

### Styling
- Use Tailwind utility classes
- Use shadcn/ui components when available
- Maintain dark mode compatibility
- Mobile-first responsive design

### Python Scripts
- **ALWAYS use Python** for database migration and utility scripts
- Place all scripts in the `/scripts` folder at project root
- Use the existing virtual environment: `scripts/venv`
- Follow the pattern of existing scripts (see `check_pages.py`, `check_deployment_status.py`)
- Scripts should:
  - Include a shebang: `#!/usr/bin/env python3`
  - Have a docstring explaining usage
  - Load environment variables from `scripts/.env` using `python-dotenv`
  - Use `psycopg2` for PostgreSQL connections
  - Use `requests` library for HTTP/Turso API calls
  - Include proper error handling and user-friendly output
  - Be made executable: `chmod +x scripts/your_script.py`
- Required dependencies are in `scripts/requirements.txt`
- To run: `cd scripts && source venv/bin/activate && python your_script.py`

## Testing Requirements

- Test new API endpoints with example requests
- Verify database migrations run successfully
- Check authentication flows work end-to-end
- Test responsive layouts at mobile breakpoints

## Security Considerations

- Never commit secrets or tokens
- Use environment variables for all credentials
- Validate user input at API boundaries
- Check authorization before database operations
- Escape user content in rendered output

## Git Workflow

- Create descriptive commit messages with context
- Reference issue numbers when applicable
- Keep commits focused on single features/fixes
- Run `pnpm build` before committing if touching core packages

## Deployment

**CRITICAL: Pre-Deployment Checks**

Before deploying to any environment:
1. **Always run build** - `pnpm build` to catch TypeScript/build errors
2. **Always run linter** - Check for syntax and import errors
3. **Never deploy without verifying** - Builds and linters catch issues that would otherwise break production

These checks prevent runtime errors like missing imports, type errors, and syntax issues.

**Astro Template Changes:**

MANDATORY: When modifying files in `templates/astro/`, ALWAYS test locally before deploying:

```bash
cd templates/astro
pnpm install
pnpm build  # This runs 'astro check && astro build'
```

If astro check or build fails, DO NOT deploy until fixed. The template must build successfully or ALL user sites will fail to deploy.

**IMPORTANT: Vercel Deployment Strategy**

- **NEVER** use `vercel --prod` or any Vercel CLI deployment commands
- **ALWAYS** deploy to Vercel by pushing to GitHub
- Vercel is configured with automatic deployments from the main branch
- Push to GitHub → Vercel automatically builds and deploys
- This ensures consistency and proper CI/CD workflow

**Deployment Checklist:**
1. Commit changes locally
2. Push to GitHub: `git push`
3. Vercel will automatically detect the push and deploy
4. Monitor deployment at https://vercel.com/dashboard

**API Deployment (Fly.io):**
- API can be deployed directly via Fly.io CLI
- Use: `flyctl deploy --config apps/api/fly.toml --app liteshow-api`

## Multi-Tenant Architecture

Remember that Liteshow is multi-tenant:
- Each project gets its own Turso database
- Projects are isolated by user ownership
- GitHub repos are created per-project
- Sites will be deployed with separate builds per project

## Templates Architecture

**IMPORTANT**: Astro site templates are stored in a separate repository, not in this monorepo.

### Template Repository
- **Location**: [`liteshowcms/templates`](https://github.com/liteshowcms/templates)
- **Structure**: `/astro/` directory contains the full Astro site template

### How Templates Work

1. **Runtime Fetching**: The API fetches templates from GitHub at runtime using the GitHub API
   - See `apps/api/src/lib/template-sync.ts` for implementation
   - Function: `getTemplateFiles()` fetches from `liteshowcms/templates` repo
   - Uses GitHub Contents API and raw.githubusercontent.com

2. **No Redeployment Needed**: Template updates don't require API redeployment
   - Templates are fetched fresh on each project creation
   - Template sync feature pulls latest changes for existing projects
   - This allows rapid template iteration without infrastructure changes

3. **Template Variables**: Content is processed with project-specific variables
   - `{{PROJECT_NAME}}` - Project display name
   - `{{PROJECT_SLUG}}` - Project URL slug
   - `{{TURSO_DATABASE_URL}}` - Turso database connection
   - `{{TURSO_AUTH_TOKEN}}` - Turso authentication token
   - `{{SITE_URL}}` - Deployment URL (set by platform)

4. **Use Cases**:
   - **Initial Creation**: Templates populate new GitHub repos on project creation
   - **Template Sync**: `/projects/:id/sync-template` endpoint creates PR with latest changes
   - Both use the same `getTemplateFiles()` function for consistency

### Modifying Templates

**DO NOT** modify templates in this monorepo - they don't exist here!

To update templates, follow this workflow:

1. **Check for local templates repo**:
   ```bash
   # Check if templates repo exists locally in sibling directory
   ls ../liteshowcms/templates
   ```

2. **If it exists**: Work directly in `../liteshowcms/templates`

3. **If it doesn't exist**: Clone to temporary location
   ```bash
   cd /tmp
   git clone https://github.com/liteshowcms/templates.git
   cd templates
   ```

4. **Make changes** in the `/astro/` directory

5. **Test locally** (MANDATORY):
   ```bash
   cd astro
   pnpm install
   pnpm build  # This runs 'astro check && astro build'
   ```

6. **Commit and push** to the templates repo
   - Changes are immediately available - no API redeployment needed
   - All new projects and template syncs will use the updated templates

**Important**: Always test the build succeeds. A broken template will break all user site deployments!

### Deprecated Code

The file `template-sync.ts` contains `getTemplateFilesOld()` - this is deprecated string-based template code kept for reference. Always use the new `getTemplateFiles()` function that fetches from GitHub.

## Common Gotchas

1. **Turso Database URLs**: Format is `libsql://database-name.turso.io`, not `https://`
2. **Authentication**: API expects `Authorization: Bearer <token>` header
3. **Monorepo Imports**: Use workspace protocol `@liteshow/*` for internal packages
4. **Build Order**: Packages must be built before apps can import them
5. **Environment Variables**: Each app has its own `.env` file

## Phase Priority Order

Work on phases in this order:
1. Core infrastructure (Phase 1) ✅
2. Content management (Phase 2) ✅
3. Deployment automation (Phase 3) - NEXT
4. AI content assistant (Phase 4)
5. SEO & domains (Phase 5)
6. Polish & production (Phase 6)

## Before Starting Work

1. Read the current README.md to understand progress
2. Check recent commits to understand context
3. Review relevant docs in `docs/` directory
4. Understand the phase you're working on

## When Stuck

- Check the main database for existing patterns
- Look at similar components in the dashboard
- Review the IMPLEMENTATION_PLAN.md for architecture decisions
- Test with actual data in the development environment

## Documentation

- Update inline comments for complex logic
- Add JSDoc for public functions
- Update README.md and docs/ when adding features
- Document API endpoints with example requests/responses
