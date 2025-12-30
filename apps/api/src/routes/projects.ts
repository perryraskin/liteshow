/**
 * Project Management Routes
 *
 * Handles project CRUD operations, Turso DB provisioning, and GitHub repo creation.
 */

import { Hono } from 'hono';
import { db } from '@liteshow/db';
import { projects, users, activityLogs } from '@liteshow/db';
import { eq, desc } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { pages, blocks } from '@liteshow/db/src/content-schema';

const projectRoutes = new Hono();

// Middleware to get user from session token
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const [userId] = Buffer.from(token, 'base64').toString().split(':');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  return user;
}

// Helper: Initialize content schema in Turso database
async function initializeContentSchema(dbUrl: string, authToken: string) {
  // Retry logic: Turso databases need a moment to become available after creation
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tursoClient = createClient({
        url: `libsql://${dbUrl}`,
        authToken: authToken,
      });

      // Create pages table
      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS pages (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          has_unpublished_changes INTEGER NOT NULL DEFAULT 0,
          meta_title TEXT,
          meta_description TEXT,
          og_image TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // Create blocks table with foreign key to pages
      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS blocks (
          id TEXT PRIMARY KEY,
          page_id TEXT NOT NULL,
          type TEXT NOT NULL,
          "order" INTEGER NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        )
      `);

      // Create page_versions table for versioning
      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS page_versions (
          id TEXT PRIMARY KEY,
          page_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          snapshot TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        )
      `);

      // Migration: Add hasUnpublishedChanges column to existing tables
      try {
        await tursoClient.execute(`
          ALTER TABLE pages ADD COLUMN has_unpublished_changes INTEGER NOT NULL DEFAULT 0
        `);
        console.log('Added hasUnpublishedChanges column to pages table');
      } catch (migrationError: any) {
        // Column might already exist, which is fine
        if (!migrationError.message?.includes('duplicate column name')) {
          console.warn('Migration warning:', migrationError.message);
        }
      }

      console.log('Content schema initialized successfully');
      return; // Success! Exit the retry loop
    } catch (error: any) {
      console.error(`Failed to initialize content schema (attempt ${attempt}/${maxRetries}):`, error.message);

      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('Max retries reached. Database might not be ready yet.');
        throw error;
      }
    }
  }
}

// Helper: Create Turso database
async function createTursoDatabase(slug: string) {
  const tursoApiToken = process.env.TURSO_API_TOKEN;
  const tursoOrg = process.env.TURSO_ORG || 'perryraskin'; // Default org name

  if (!tursoApiToken) {
    throw new Error('TURSO_API_TOKEN not configured');
  }

  try {
    // Create the database
    const createResponse = await fetch(`https://api.turso.tech/v1/organizations/${tursoOrg}/databases`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tursoApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `liteshow-${slug}`,
        group: 'liteshow',
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('Turso create DB error:', error);
      throw new Error(`Failed to create Turso database: ${createResponse.statusText}`);
    }

    const dbData = await createResponse.json() as {
      database: { Name: string; Hostname: string };
    };
    console.log('Turso database created:', dbData);

    // Create an auth token for the database
    const tokenResponse = await fetch(`https://api.turso.tech/v1/organizations/${tursoOrg}/databases/${dbData.database.Name}/auth/tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tursoApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expiration: 'never',
        authorization: 'full-access',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to create Turso auth token: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json() as { jwt: string };

    return {
      url: dbData.database.Hostname,
      token: tokenData.jwt,
    };
  } catch (error) {
    console.error('Turso API error:', error);
    throw error;
  }
}

// Helper: Create GitHub repository
async function createGitHubRepository(slug: string, description: string, accessToken: string) {
  try {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        name: `liteshow-${slug}`,
        description: description || 'LiteShow content repository',
        private: false,
        auto_init: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('GitHub API error:', error);
      throw new Error(`Failed to create GitHub repository: ${response.statusText}`);
    }

    const repo = await response.json() as { name: string; html_url: string };
    return {
      name: repo.name,
      url: repo.html_url,
    };
  } catch (error) {
    console.error('GitHub repository creation error:', error);
    throw error;
  }
}

// Helper: Create deployment configuration files in GitHub repo
async function createDeploymentFiles(
  repoFullName: string,
  projectName: string,
  slug: string,
  tursoDbUrl: string,
  accessToken: string
) {
  try {
    // Get the default branch (usually main)
    const repoResponse = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!repoResponse.ok) {
      throw new Error('Failed to get repository info');
    }

    const repoData = await repoResponse.json() as { default_branch: string };
    const defaultBranch = repoData.default_branch;

    // Files to create
    const files = [
      {
        path: 'README.md',
        content: `# ${projectName}

Built with [LiteShow](https://liteshow.com) - AI-first, Git-powered CMS

## Quick Deploy

Choose your preferred hosting platform:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/${repoFullName}#LITESHOW_PROJECT_SLUG=${slug})

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/${repoFullName}&env=LITESHOW_PROJECT_SLUG&envDescription=Your%20project%20slug%20from%20LiteShow%20dashboard%3A%20${slug})

**Your project slug:** \`${slug}\` (copy and paste when prompted during deployment)

After deploying, any content you publish in LiteShow will automatically trigger a rebuild.

## Manual Setup

If you prefer manual setup:

1. Import this repo in your hosting platform
2. Set build command: \`pnpm install && pnpm build\`
3. Set publish directory: \`dist\`
4. Add environment variable: \`LITESHOW_PROJECT_SLUG\` (your project slug)
5. (Optional) Add \`LITESHOW_API_URL\` if using custom API endpoint

## Environment Variables

- \`LITESHOW_PROJECT_SLUG\` - Your project slug (get from LiteShow dashboard)
- \`LITESHOW_API_URL\` - (Optional) API endpoint, defaults to production

## Local Development

\`\`\`bash
# Copy environment template
cp .env.example .env

# Edit .env and add your project slug
# LITESHOW_PROJECT_SLUG=your-project-slug

# Install and run
pnpm install
pnpm dev
\`\`\`

Visit http://localhost:4321

## How It Works

This Astro site fetches your published content from the LiteShow API at build time. LiteShow handles all the database infrastructure - you just manage your content!
`,
      },
      {
        path: 'netlify.toml',
        content: `[build]
  command = "pnpm install && pnpm build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/404"
  status = 404
`,
      },
      {
        path: 'vercel.json',
        content: `{
  "buildCommand": "pnpm install && pnpm build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",
  "framework": "astro"
}
`,
      },
      {
        path: '.node-version',
        content: '20',
      },
    ];

    // Create each file
    for (const file of files) {
      const createFileResponse = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${file.path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `Add ${file.path}`,
          content: Buffer.from(file.content).toString('base64'),
          branch: defaultBranch,
        }),
      });

      if (!createFileResponse.ok) {
        const error = await createFileResponse.text();
        console.error(`Failed to create ${file.path}:`, error);
        // Don't throw - continue creating other files
      } else {
        console.log(`Created ${file.path}`);
      }
    }

    console.log('Deployment files created successfully');
  } catch (error) {
    console.error('Failed to create deployment files:', error);
    // Don't throw - this shouldn't block project creation
  }
}

// GET /api/projects - List all projects for the authenticated user
projectRoutes.get('/', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProjects = await db.query.projects.findMany({
      where: eq(projects.userId, user.id),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    return c.json(userProjects);
  } catch (error) {
    console.error('List projects error:', error);
    return c.json({ error: 'Failed to list projects' }, 500);
  }
});

// POST /api/projects - Create a new project
projectRoutes.post('/', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { name, slug, description } = body;

    if (!name || !slug) {
      return c.json({ error: 'Name and slug are required' }, 400);
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return c.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, 400);
    }

    // Check if project with same slug exists
    const existing = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
    });

    if (existing) {
      return c.json({ error: 'A project with this slug already exists' }, 409);
    }

    console.log(`Creating project "${name}" (${slug}) for user ${user.id}`);

    // Step 1: Create Turso database
    console.log('Creating Turso database...');
    const tursoDb = await createTursoDatabase(slug);

    // Step 1.5: Initialize content schema
    console.log('Initializing content schema...');
    await initializeContentSchema(tursoDb.url, tursoDb.token);

    // Step 2: Create GitHub repository
    console.log('Creating GitHub repository...');
    const githubRepo = await createGitHubRepository(slug, description, user.githubAccessToken!);

    // Step 2.5: Create deployment configuration files
    console.log('Creating deployment configuration files...');
    // Extract owner/repo from the GitHub URL (e.g., "https://github.com/username/repo")
    const repoFullName = githubRepo.url.replace('https://github.com/', '');
    await createDeploymentFiles(repoFullName, name, slug, tursoDb.url, user.githubAccessToken!);

    // Step 3: Store project in PostgreSQL
    console.log('Storing project metadata...');
    const [newProject] = await db.insert(projects).values({
      userId: user.id,
      name,
      slug,
      description: description || null,
      tursoDbUrl: tursoDb.url,
      tursoDbToken: tursoDb.token,
      githubRepoName: githubRepo.name,
      githubRepoUrl: githubRepo.url,
      isPublished: false,
    }).returning();

    console.log(`Project created successfully: ${newProject.id}`);

    return c.json(newProject, 201);
  } catch (error: any) {
    console.error('Create project error:', error);
    return c.json({ error: error.message || 'Failed to create project' }, 500);
  }
});

// GET /api/projects/:id - Get a specific project
projectRoutes.get('/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    return c.json({ error: 'Failed to get project' }, 500);
  }
});

// POST /api/projects/:id/initialize-schema - Initialize content schema for existing project
projectRoutes.post('/:id/initialize-schema', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    console.log(`Initializing content schema for project ${projectId}`);
    await initializeContentSchema(project.tursoDbUrl, project.tursoDbToken);

    return c.json({ success: true, message: 'Content schema initialized' });
  } catch (error) {
    console.error('Initialize schema error:', error);
    return c.json({ error: 'Failed to initialize schema' }, 500);
  }
});

// GET /api/projects/:id/activity - Get activity logs for a project
projectRoutes.get('/:id/activity', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Get activity logs with optional pagination
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const activities = await db.query.activityLogs.findMany({
      where: eq(activityLogs.projectId, projectId),
      orderBy: [desc(activityLogs.createdAt)],
      limit: Math.min(limit, 100), // Max 100 items per request
      offset,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            githubUsername: true,
            avatarUrl: true,
          },
        },
      },
    });

    return c.json({
      activities,
      pagination: {
        limit,
        offset,
        hasMore: activities.length === limit,
      },
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    return c.json({ error: 'Failed to get activity logs' }, 500);
  }
});

// DELETE /api/projects/:id - Delete a project (Turso database and records)
projectRoutes.delete('/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    console.log(`Deleting project ${projectId} for user ${user.id}`);

    // Store GitHub repo URL to return in response
    const githubRepoUrl = project.githubRepoUrl;

    // Step 1: Delete Turso database
    try {
      const tursoApiToken = process.env.TURSO_API_TOKEN;
      const tursoOrg = process.env.TURSO_ORG || 'perryraskin';
      const dbName = `liteshow-${project.slug}`;

      console.log(`Deleting Turso database: ${dbName}`);

      const deleteTursoResponse = await fetch(
        `https://api.turso.tech/v1/organizations/${tursoOrg}/databases/${dbName}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${tursoApiToken}`,
          },
        }
      );

      if (!deleteTursoResponse.ok && deleteTursoResponse.status !== 404) {
        console.error('Failed to delete Turso database:', await deleteTursoResponse.text());
        // Continue anyway
      } else {
        console.log('Turso database deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting Turso database:', error);
      // Continue anyway
    }

    // Step 2: Delete project from PostgreSQL (cascades to activity logs)
    await db.delete(projects).where(eq(projects.id, projectId));

    console.log(`Project ${projectId} deleted successfully`);

    return c.json({
      success: true,
      message: 'Project deleted successfully',
      githubRepoUrl: githubRepoUrl
    });
  } catch (error: any) {
    console.error('Delete project error:', error);
    return c.json({ error: error.message || 'Failed to delete project' }, 500);
  }
});

export default projectRoutes;
