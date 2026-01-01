/**
 * Deployment API Routes
 * Handles GitHub Pages deployment via GitHub Actions
 */

import { Hono } from 'hono';
import { db } from '@liteshow/db';
import { projects, deployments } from '@liteshow/db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';

const deploymentRoutes = new Hono();

// All routes require authentication
deploymentRoutes.use('*', authMiddleware);

/**
 * POST /projects/:projectId/deployment/deploy
 * Trigger a new deployment to GitHub Pages
 */
deploymentRoutes.post('/:projectId/deploy', async (c) => {
  try {
    const { projectId } = c.req.param();
    const user = c.get('user');

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

    if (!project.githubRepoName) {
      return c.json({ error: 'GitHub repository not connected' }, 400);
    }

    // TODO: Trigger GitHub Actions workflow via GitHub API
    // For now, we'll create a deployment record as "queued"
    // The actual GitHub Actions trigger will be implemented next

    const [deployment] = await db
      .insert(deployments)
      .values({
        projectId,
        status: 'queued',
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
      message: 'Deployment queued successfully',
    });
  } catch (error) {
    console.error('Deploy error:', error);
    return c.json({ error: 'Failed to trigger deployment' }, 500);
  }
});

/**
 * PATCH /projects/:projectId/deployment/settings
 * Update deployment settings (auto-deploy, etc.)
 */
deploymentRoutes.patch('/:projectId/settings', async (c) => {
  try {
    const { projectId } = c.req.param();
    const user = c.get('user');
    const body = await c.req.json();

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
deploymentRoutes.get('/:projectId/deployments', async (c) => {
  try {
    const { projectId } = c.req.param();
    const user = c.get('user');

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
 * GET /projects/:projectId/deployment/status
 * Get current deployment status
 */
deploymentRoutes.get('/:projectId/status', async (c) => {
  try {
    const { projectId } = c.req.param();
    const user = c.get('user');

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
