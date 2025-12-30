/**
 * GitHub App API Routes
 *
 * Handles GitHub App installation management and repository listing.
 */

import { Hono } from 'hono';
import { listInstallationRepositories } from '../lib/github-app';

const githubAppRoutes = new Hono();

/**
 * GET /github-app/installations/:installationId/repos
 *
 * Lists all repositories accessible by a GitHub App installation.
 * Used by the frontend to show a dropdown of available repos.
 */
githubAppRoutes.get('/installations/:installationId/repos', async (c) => {
  try {
    const installationId = c.req.param('installationId');

    if (!installationId) {
      return c.json({ error: 'Installation ID is required' }, 400);
    }

    const repositories = await listInstallationRepositories(installationId);

    return c.json({
      repositories: repositories.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
      })),
    });
  } catch (error) {
    console.error('Error listing installation repositories:', error);
    return c.json(
      {
        error: 'Failed to list installation repositories',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default githubAppRoutes;
