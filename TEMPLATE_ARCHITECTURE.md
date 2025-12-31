# Template Architecture

## Overview

LiteShow uses a real Astro project as a template instead of TypeScript template strings. This provides better developer experience, syntax highlighting, and maintainability.

## Structure

```
templates/
└── astro/                  ← ACTUAL ASTRO PROJECT
    ├── package.json
    ├── astro.config.mjs
    ├── netlify.toml
    ├── README.md
    ├── .env.example
    ├── tsconfig.json
    └── src/
        ├── components/
        │   └── blocks/
        │       ├── HeroBlock.astro
        │       ├── CtaBlock.astro
        │       └── MarkdownBlock.astro
        ├── layouts/
        │   └── BaseLayout.astro
        ├── lib/
        │   └── content-api.ts
        └── pages/
            ├── index.astro
            ├── [slug].astro
            └── 404.astro
```

## Template Variables

Files in `templates/astro/` can use these template variables:

- `{{PROJECT_NAME}}` - Project display name
- `{{PROJECT_SLUG}}` - Project slug (URL-safe)
- `{{TURSO_DATABASE_URL}}` - Turso database URL (e.g., `libsql://db-name.turso.io`)
- `{{TURSO_AUTH_TOKEN}}` - Turso authentication token
- `{{SITE_URL}}` - Site URL (set by deployment platform)

## How It Works

### For New Projects

1. API reads all files from `templates/astro/` directory recursively
2. Replaces template variables with project-specific values
3. Pushes files to GitHub repository

### For Template Sync

1. API reads template files from `templates/astro/`
2. Replaces template variables
3. Compares with existing repo files
4. Creates PR with differences

## Development

### Local Testing

Run the test script to verify template generation:

```bash
node test-template.mjs
```

This will:
- Read all template files
- Test variable replacement
- Verify output matches expected format

### Making Changes

1. Edit files in `templates/astro/` as a normal Astro project
2. Use template variables where project-specific values are needed
3. Test locally: `cd templates/astro && pnpm dev`
4. Run test script to verify variable replacement
5. Changes will automatically be used for new projects

## Benefits

✅ **Real Astro Project** - Can run `pnpm dev` in templates/astro/ to test
✅ **No String Escaping** - Write actual code, not template strings
✅ **Easy to Maintain** - Edit actual files, not TypeScript strings
✅ **Git-Trackable** - See actual file changes in diffs
✅ **Syntax Highlighting** - Full IDE support for Astro files
✅ **Testable** - Can test the actual template project

## Code Reference

- Template reading: `apps/api/src/lib/template-sync.ts` (getTemplateFiles)
- Project creation: `apps/api/src/routes/projects.ts` (POST /api/projects)
- Template sync: `apps/api/src/routes/projects.ts` (POST /api/projects/:id/sync-template)

## Migration Notes

- Old string-based template kept as `getTemplateFilesOld()` for reference
- New implementation reads from filesystem at runtime
- Template variables use `{{VAR}}` syntax for clarity
- `.gitignore`, `pnpm-lock.yaml`, and `package-lock.json` are automatically skipped
