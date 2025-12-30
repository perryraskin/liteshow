/**
 * Project Management Routes
 *
 * Handles project CRUD operations, Turso DB provisioning, and GitHub repo creation.
 */

import { Hono } from 'hono';
import { db } from '@liteshow/db';
import { projects, users } from '@liteshow/db';
import { eq } from 'drizzle-orm';
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

    console.log('Content schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize content schema:', error);
    throw error;
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

    const dbData = await createResponse.json();
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

    const tokenData = await tokenResponse.json();

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
        auto_init: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('GitHub API error:', error);
      throw new Error(`Failed to create GitHub repository: ${response.statusText}`);
    }

    const repo = await response.json();
    return {
      name: repo.name,
      url: repo.html_url,
    };
  } catch (error) {
    console.error('GitHub repository creation error:', error);
    throw error;
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

export default projectRoutes;
