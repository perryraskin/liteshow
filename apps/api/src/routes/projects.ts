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
import { syncTemplateToRepo, getTemplateFiles } from '../lib/template-sync';
import { getGitHubTokenForProject } from '../lib/github-token';

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
async function createGitHubRepository(slug: string, description: string, accessToken: string, isPrivate: boolean = false) {
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
        description: description || 'Liteshow content repository',
        private: isPrivate,
        auto_init: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('GitHub API error:', error);
      throw new Error(`Failed to create GitHub repository: ${response.statusText}`);
    }

    const repo = await response.json() as { name: string; full_name: string; html_url: string };
    return {
      name: repo.full_name, // Use full_name (owner/repo) instead of just name
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
    console.log('Creating deployment files using templates from GitHub...');

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

    // Get template files from GitHub (same source as template sync!)
    const templateFiles = await getTemplateFiles(projectName, slug, tursoDbUrl, undefined);
    console.log(`Fetched ${templateFiles.length} template files from GitHub`);

    // Convert to the format expected by the GitHub API
    const files = templateFiles.map(tf => ({
      path: tf.path,
      content: tf.content,
    }));

    // DEPRECATED: Old hardcoded files array removed - see git history if needed
    // Now using getTemplateFiles() which fetches from github.com/liteshowcms/templates
    // This ensures initial repo creation and template sync use the same source


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
    const { name, slug, description, githubStrategy, repoVisibility, githubInstallationId, githubRepoId } = body;

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

    // Determine GitHub auth strategy
    const strategy = githubStrategy || 'link-later';
    let authType: string | null = null;
    let shouldCreateGitHubRepo = false;

    if (strategy === 'create-now') {
      // OAuth: Liteshow creates the repo
      authType = 'oauth';
      shouldCreateGitHubRepo = true;

      // Check if user has the required scope
      const isPrivate = repoVisibility === 'private';
      const requiredScope = isPrivate ? 'hasPrivateRepoScope' : 'hasPublicRepoScope';
      if (!user[requiredScope]) {
        return c.json({
          error: `User does not have ${isPrivate ? 'private' : 'public'} repo access. Please authorize repository access first.`,
          requiresAuth: true,
          requiredScope: isPrivate ? 'repo' : 'public_repo'
        }, 403);
      }
    } else if (strategy === 'link-later') {
      // No GitHub setup yet - will be linked after project creation
      authType = null;
      shouldCreateGitHubRepo = false;
    } else if (strategy === 'github-app') {
      // GitHub App: User links existing repo
      authType = 'github_app';
      shouldCreateGitHubRepo = false;
      if (!githubInstallationId || !githubRepoId) {
        return c.json({ error: 'GitHub App installation ID and repository ID are required' }, 400);
      }
    } else {
      return c.json({ error: 'Invalid githubStrategy. Must be "create-now", "link-later", or "github-app"' }, 400);
    }

    console.log(`Creating project "${name}" (${slug}) for user ${user.id} with strategy: ${strategy}`);

    // Step 1: Create Turso database
    console.log('Creating Turso database...');
    const tursoDb = await createTursoDatabase(slug);

    // Step 1.5: Initialize content schema
    console.log('Initializing content schema...');
    await initializeContentSchema(tursoDb.url, tursoDb.token);

    // Step 2: Create or link GitHub repository (if applicable)
    let githubRepo: { name: string; url: string } | null = null;

    if (shouldCreateGitHubRepo) {
      // Liteshow creates the repository via OAuth
      console.log('Creating GitHub repository...');
      const isPrivate = repoVisibility === 'private';
      githubRepo = await createGitHubRepository(slug, description, user.githubAccessToken!, isPrivate);

      // Create deployment configuration files
      console.log('Creating deployment configuration files...');
      const repoFullName = githubRepo.url.replace('https://github.com/', '');
      await createDeploymentFiles(repoFullName, name, slug, tursoDb.url, user.githubAccessToken!);
    } else if (authType === 'github_app') {
      // GitHub App - repository already exists and is selected by user
      console.log('Linking to existing GitHub repository...');
      // The githubRepoId format is "owner/repo"
      githubRepo = {
        name: githubRepoId.split('/')[1],
        url: `https://github.com/${githubRepoId}`,
      };

      // Note: We could create deployment files here too using the GitHub App token,
      // but for now we'll let users do that manually since they own the repo
    } else {
      // link-later strategy - no GitHub repo yet
      console.log('Skipping GitHub repository setup (will be linked later)');
    }

    // Step 3: Store project in PostgreSQL
    console.log('Storing project metadata...');
    const [newProject] = await db.insert(projects).values({
      userId: user.id,
      name,
      slug,
      description: description || null,
      tursoDbUrl: tursoDb.url,
      tursoDbToken: tursoDb.token,
      githubRepoName: githubRepo?.name || null,
      githubRepoUrl: githubRepo?.url || null,
      githubAuthType: authType,
      githubInstallationId: githubInstallationId || null,
      githubRepoId: githubRepoId || null,
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

// POST /api/projects/:id/link-github - Link GitHub repository to existing project
projectRoutes.post('/:id/link-github', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const body = await c.req.json();
    const { strategy, repoVisibility } = body;

    // Get the project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Check if project already has a GitHub repo
    if (project.githubRepoUrl) {
      return c.json({ error: 'Project already has a GitHub repository linked' }, 400);
    }

    console.log(`Linking GitHub to project ${projectId} with strategy: ${strategy}`);

    if (strategy === 'create-now') {
      // Check if user has the required scope
      const isPrivate = repoVisibility === 'private';
      const requiredScope = isPrivate ? 'hasPrivateRepoScope' : 'hasPublicRepoScope';
      if (!user[requiredScope]) {
        return c.json({
          error: `User does not have ${isPrivate ? 'private' : 'public'} repo access. Please authorize repository access first.`,
          requiresAuth: true,
          requiredScope: isPrivate ? 'repo' : 'public_repo'
        }, 403);
      }

      // Create GitHub repository
      console.log('Creating GitHub repository...');
      const githubRepo = await createGitHubRepository(project.slug, project.description || '', user.githubAccessToken!, isPrivate);

      // Create deployment files
      console.log('Creating deployment files...');
      const repoFullName = githubRepo.url.replace('https://github.com/', '');
      await createDeploymentFiles(repoFullName, project.name, project.slug, project.tursoDbUrl, user.githubAccessToken!);

      // Update project with GitHub info
      await db.update(projects)
        .set({
          githubRepoName: githubRepo.name,
          githubRepoUrl: githubRepo.url,
          githubAuthType: 'oauth',
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      console.log('GitHub repository linked successfully');

      return c.json({
        success: true,
        githubRepoUrl: githubRepo.url,
      });
    } else if (strategy === 'github-app') {
      // GitHub App - link existing repository
      const { githubInstallationId, githubRepoId } = body;

      if (!githubInstallationId || !githubRepoId) {
        return c.json({ error: 'GitHub installation ID and repository ID are required' }, 400);
      }

      console.log(`Linking GitHub App repository: ${githubRepoId}`);

      // Extract repo name and URL from full_name (e.g., "owner/repo")
      const repoName = githubRepoId.split('/')[1];
      const repoUrl = `https://github.com/${githubRepoId}`;

      // Update project with GitHub App info
      await db.update(projects)
        .set({
          githubRepoName: repoName,
          githubRepoUrl: repoUrl,
          githubAuthType: 'github_app',
          githubInstallationId: githubInstallationId,
          githubRepoId: githubRepoId,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      console.log('GitHub App repository linked successfully');

      return c.json({
        success: true,
        githubRepoUrl: repoUrl,
      });
    } else {
      return c.json({ error: 'Invalid strategy' }, 400);
    }
  } catch (error: any) {
    console.error('Link GitHub error:', error);
    return c.json({ error: error.message || 'Failed to link GitHub repository' }, 500);
  }
});

// GET /api/projects/:id/sync-template/status - Check if template sync PR exists
projectRoutes.get('/:id/sync-template/status', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');

    // Get project and verify ownership
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!project.githubRepoUrl || !project.githubRepoName) {
      return c.json({ hasPendingPR: false });
    }

    // Get GitHub token
    const token = await getGitHubTokenForProject(project, user);
    if (!token) {
      return c.json({ hasPendingPR: false });
    }

    // Check for existing sync PR
    const { checkExistingSyncPR } = await import('../lib/template-sync');
    const prUrl = await checkExistingSyncPR(project.githubRepoName, token);

    return c.json({
      hasPendingPR: !!prUrl,
      prUrl: prUrl || null,
    });
  } catch (error: any) {
    console.error('Error checking sync PR status:', error);
    return c.json({ hasPendingPR: false });
  }
});

// POST /api/projects/:id/sync-template - Create PR with template updates
projectRoutes.post('/:id/sync-template', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');

    // Get project and verify ownership
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!project.githubRepoUrl) {
      return c.json({ error: 'GitHub repository not connected. Setup GitHub first.' }, 403);
    }

    // Sync template to repository
    const result = await syncTemplateToRepo(projectId, user.id);

    if (result.existingPrUrl) {
      return c.json(
        {
          error: 'Sync PR already exists',
          prUrl: result.existingPrUrl,
        },
        409
      );
    }

    if (result.upToDate) {
      return c.json({
        success: true,
        upToDate: true,
        message: 'Your template is already up to date',
      });
    }

    return c.json({
      success: true,
      prUrl: result.prUrl,
      branchName: result.branchName,
      filesChanged: result.filesChanged,
    });
  } catch (error: any) {
    console.error('Template sync error:', error);

    // Check if it's an authentication error
    if (error.code === 'GITHUB_AUTH_REQUIRED' || error.requiresReauth) {
      return c.json({
        error: error.message || 'GitHub authentication required',
        requiresReauth: true,
        code: 'GITHUB_AUTH_REQUIRED'
      }, 401);
    }

    return c.json({ error: error.message || 'Failed to sync template' }, 500);
  }
});

// PATCH /api/projects/:id/settings - Update project site settings
projectRoutes.patch('/:id/settings', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const body = await c.req.json();
    const { siteTitle, siteDescription, faviconUrl } = body;

    // Verify project exists and belongs to user
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Update project settings
    await db
      .update(projects)
      .set({
        siteTitle: siteTitle || null,
        siteDescription: siteDescription || null,
        faviconUrl: faviconUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    // Fetch and return updated project
    const updatedProject = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    return c.json(updatedProject);
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
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
