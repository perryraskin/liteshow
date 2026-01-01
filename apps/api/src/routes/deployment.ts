/**
 * Deployment API Routes
 * Handles GitHub Pages deployment via GitHub Actions
 */

import { Hono } from 'hono';
import { db } from '@liteshow/db';
import { projects, deployments, users } from '@liteshow/db';
import { eq, desc } from 'drizzle-orm';
import {
  triggerDeployment,
  parseGitHubRepoUrl,
  getLatestDeploymentStatus,
  enableGitHubPages,
  setRepositorySecret
} from '../lib/github-pages';
import { getGitHubTokenForProject } from '../lib/github-token';

const deploymentRoutes = new Hono();

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

/**
 * POST /projects/:projectId/deployment/deploy
 * Trigger a new deployment to GitHub Pages
 */
deploymentRoutes.post('/deploy', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const authHeader = c.req.header('Authorization');

    const user = await getUserFromToken(authHeader);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get project with all GitHub auth fields
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (!project.githubRepoUrl) {
      return c.json({ error: 'GitHub repository not connected' }, 400);
    }

    // Parse GitHub repo URL to get owner and repo name
    const repoInfo = parseGitHubRepoUrl(project.githubRepoUrl);
    if (!repoInfo) {
      return c.json({ error: 'Invalid GitHub repository URL' }, 400);
    }

    // Get appropriate GitHub token (OAuth or GitHub App)
    const githubToken = await getGitHubTokenForProject(project, user);

    try {
      // Enable GitHub Pages if not already enabled
      // This is safe to call multiple times - it will return existing URL if already enabled
      const pagesUrl = await enableGitHubPages(repoInfo.owner, repoInfo.repo, githubToken);
      console.log('GitHub Pages enabled:', pagesUrl);

      // Update deployment URL if we got one
      if (pagesUrl && !project.deploymentUrl) {
        await db
          .update(projects)
          .set({ deploymentUrl: pagesUrl })
          .where(eq(projects.id, projectId));
      }

      // Set required GitHub Actions secrets for the build
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.liteshow.io';
      await setRepositorySecret(repoInfo.owner, repoInfo.repo, githubToken, 'LITESHOW_API_URL', apiUrl);
      await setRepositorySecret(repoInfo.owner, repoInfo.repo, githubToken, 'LITESHOW_PROJECT_SLUG', project.slug);

      // Set BASE_PATH based on whether a custom domain is configured
      // Custom domains are at root (/), GitHub Pages subpaths use /repo-name/
      const basePath = project.customDomain ? '/' : `/${repoInfo.repo}/`;
      await setRepositorySecret(repoInfo.owner, repoInfo.repo, githubToken, 'BASE_PATH', basePath);
      console.log('GitHub Actions secrets configured');

      // Trigger the GitHub Actions workflow
      await triggerDeployment(repoInfo.owner, repoInfo.repo, githubToken);

      // Create deployment record
      const [deployment] = await db
        .insert(deployments)
        .values({
          projectId,
          status: 'in_progress',
          commitMessage: 'Manual deployment trigger',
        })
        .returning();

      // Update project deployment status
      await db
        .update(projects)
        .set({
          deploymentStatus: 'building',
        })
        .where(eq(projects.id, projectId));

      return c.json({
        deployment,
        message: 'Deployment triggered successfully',
      });
    } catch (error: any) {
      // If deployment trigger failed, record the failure
      const [deployment] = await db
        .insert(deployments)
        .values({
          projectId,
          status: 'failure',
          commitMessage: 'Manual deployment trigger',
          errorMessage: error.message,
        })
        .returning();

      return c.json(
        {
          deployment,
          error: 'Failed to trigger deployment',
          details: error.message,
        },
        500
      );
    }
  } catch (error) {
    console.error('Deploy error:', error);
    return c.json({ error: 'Failed to trigger deployment' }, 500);
  }
});

/**
 * PATCH /projects/:projectId/deployment/settings
 * Update deployment settings (auto-deploy, etc.)
 */
deploymentRoutes.patch('/settings', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const authHeader = c.req.header('Authorization');
    const body = await c.req.json();

    const user = await getUserFromToken(authHeader);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { autoDeployOnSave } = body;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Update settings
    const [updatedProject] = await db
      .update(projects)
      .set({
        autoDeployOnSave: autoDeployOnSave ?? project.autoDeployOnSave,
      })
      .where(eq(projects.id, projectId))
      .returning();

    return c.json(updatedProject);
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

/**
 * GET /projects/:projectId/deployments
 * Get deployment history for a project
 */
deploymentRoutes.get('/deployments', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const authHeader = c.req.header('Authorization');

    const user = await getUserFromToken(authHeader);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Get deployment history
    const deploymentHistory = await db
      .select()
      .from(deployments)
      .where(eq(deployments.projectId, projectId))
      .orderBy(desc(deployments.createdAt))
      .limit(20);

    return c.json(deploymentHistory);
  } catch (error) {
    console.error('Get deployments error:', error);
    return c.json({ error: 'Failed to fetch deployments' }, 500);
  }
});

/**
 * POST /projects/:projectId/deployment/sync-status
 * Sync deployment status from GitHub Actions
 */
deploymentRoutes.post('/sync-status', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const authHeader = c.req.header('Authorization');

    const user = await getUserFromToken(authHeader);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (!project.githubRepoUrl) {
      return c.json({ error: 'GitHub repository not connected' }, 400);
    }

    // Parse GitHub repo URL
    const repoInfo = parseGitHubRepoUrl(project.githubRepoUrl);
    if (!repoInfo) {
      return c.json({ error: 'Invalid GitHub repository URL' }, 400);
    }

    // Get appropriate GitHub token (OAuth or GitHub App)
    const githubToken = await getGitHubTokenForProject(project, user);

    // Get latest deployment status from GitHub
    const githubStatus = await getLatestDeploymentStatus(
      repoInfo.owner,
      repoInfo.repo,
      githubToken
    );

    if (!githubStatus) {
      return c.json({ error: 'No deployments found' }, 404);
    }

    // Map GitHub status to our status format
    let deploymentStatus = 'not_deployed';
    if (githubStatus.status === 'in_progress' || githubStatus.status === 'queued') {
      deploymentStatus = 'building';
    } else if (githubStatus.conclusion === 'success') {
      deploymentStatus = 'live';
    } else if (githubStatus.conclusion === 'failure') {
      deploymentStatus = 'failed';
    }

    // Update project with latest deployment info
    await db
      .update(projects)
      .set({
        deploymentStatus,
        lastDeploymentCommit: githubStatus.commitSha,
        lastDeployedAt: githubStatus.status === 'completed'
          ? new Date(githubStatus.createdAt)
          : project.lastDeployedAt,
      })
      .where(eq(projects.id, projectId));

    // Update or create deployment record
    const [latestDeployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.projectId, projectId))
      .orderBy(desc(deployments.createdAt))
      .limit(1);

    if (latestDeployment && latestDeployment.commitSha === githubStatus.commitSha) {
      // Update existing deployment record
      await db
        .update(deployments)
        .set({
          status: githubStatus.conclusion || githubStatus.status,
          completedAt: githubStatus.status === 'completed'
            ? new Date()
            : null,
        })
        .where(eq(deployments.id, latestDeployment.id));
    }

    return c.json({
      status: deploymentStatus,
      githubStatus,
      message: 'Status synced successfully',
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return c.json({ error: 'Failed to sync status' }, 500);
  }
});

/**
 * PATCH /projects/:projectId/deployment/custom-domain
 * Update custom domain configuration
 */
deploymentRoutes.patch('/custom-domain', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const authHeader = c.req.header('Authorization');
    const body = await c.req.json();

    const user = await getUserFromToken(authHeader);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { customDomain } = body;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Validate domain format if provided
    if (customDomain) {
      const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(customDomain)) {
        return c.json({ error: 'Invalid domain format' }, 400);
      }
    }

    // Update custom domain
    const [updatedProject] = await db
      .update(projects)
      .set({
        customDomain: customDomain || null,
      })
      .where(eq(projects.id, projectId))
      .returning();

    return c.json({
      customDomain: updatedProject.customDomain,
      message: customDomain
        ? 'Custom domain configured successfully'
        : 'Custom domain removed',
    });
  } catch (error) {
    console.error('Update custom domain error:', error);
    return c.json({ error: 'Failed to update custom domain' }, 500);
  }
});

/**
 * GET /projects/:projectId/deployment/status
 * Get current deployment status
 * Automatically syncs from GitHub if status is "building"
 */
deploymentRoutes.get('/status', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const authHeader = c.req.header('Authorization');

    const user = await getUserFromToken(authHeader);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // If status is "building", sync from GitHub to check if it completed
    if (project.deploymentStatus === 'building' && project.githubRepoUrl) {
      try {
        const repoInfo = parseGitHubRepoUrl(project.githubRepoUrl);
        if (repoInfo) {
          const githubToken = await getGitHubTokenForProject(project, user);
          const githubStatus = await getLatestDeploymentStatus(
            repoInfo.owner,
            repoInfo.repo,
            githubToken
          );

          if (githubStatus) {
            // Map GitHub status to our status format
            let deploymentStatus = 'not_deployed';
            if (githubStatus.status === 'in_progress' || githubStatus.status === 'queued') {
              deploymentStatus = 'building';
            } else if (githubStatus.conclusion === 'success') {
              deploymentStatus = 'live';
            } else if (githubStatus.conclusion === 'failure') {
              deploymentStatus = 'failed';
            }

            // Update project if status changed
            if (deploymentStatus !== project.deploymentStatus) {
              await db
                .update(projects)
                .set({
                  deploymentStatus,
                  lastDeployedAt: githubStatus.status === 'completed'
                    ? new Date(githubStatus.createdAt)
                    : project.lastDeployedAt,
                })
                .where(eq(projects.id, projectId));

              // Return updated status
              return c.json({
                status: deploymentStatus,
                url: project.deploymentUrl,
                lastDeployedAt: githubStatus.status === 'completed'
                  ? new Date(githubStatus.createdAt).toISOString()
                  : project.lastDeployedAt,
                lastCommit: project.lastDeploymentCommit,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error syncing deployment status:', error);
        // Continue with cached status if sync fails
      }
    }

    return c.json({
      status: project.deploymentStatus || 'not_deployed',
      url: project.deploymentUrl,
      lastDeployedAt: project.lastDeployedAt,
      lastCommit: project.lastDeploymentCommit,
    });
  } catch (error) {
    console.error('Get status error:', error);
    return c.json({ error: 'Failed to fetch status' }, 500);
  }
});

export default deploymentRoutes;
