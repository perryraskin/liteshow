# LiteShow - Claude Instructions

Project-specific instructions for AI assistants working on LiteShow.

## Project Overview

LiteShow is an AI-first, SEO-optimized, Git-powered CMS built with:
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

## Multi-Tenant Architecture

Remember that LiteShow is multi-tenant:
- Each project gets its own Turso database
- Projects are isolated by user ownership
- GitHub repos are created per-project
- Sites will be deployed with separate builds per project

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
