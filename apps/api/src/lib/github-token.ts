/**
 * GitHub Token Helper
 *
 * Provides unified access to GitHub tokens regardless of auth method.
 * Supports both OAuth (user token) and GitHub App (installation token) authentication.
 */

import { getGitHubAppInstallationToken } from './github-app';

/**
 * Project type with GitHub auth fields
 */
export interface ProjectWithGitHubAuth {
  githubAuthType: string | null;
  githubInstallationId: string | null;
}

/**
 * User type with GitHub token
 */
export interface UserWithGitHubToken {
  githubAccessToken: string | null;
}

/**
 * Gets the appropriate GitHub token for a project based on its auth type
 *
 * @param project - Project with GitHub auth configuration
 * @param user - User with OAuth token
 * @returns Promise<string> - GitHub access token (OAuth or installation token)
 * @throws Error if auth type is unknown or token cannot be obtained
 */
export async function getGitHubTokenForProject(
  project: ProjectWithGitHubAuth,
  user: UserWithGitHubToken
): Promise<string> {
  // Default to OAuth if no auth type is set (backward compatibility)
  const authType = project.githubAuthType || 'oauth';

  if (authType === 'oauth') {
    if (!user.githubAccessToken) {
      throw new Error('User does not have a GitHub access token');
    }
    return user.githubAccessToken;
  }

  if (authType === 'github_app') {
    if (!project.githubInstallationId) {
      throw new Error('Project does not have a GitHub App installation ID');
    }
    // Get a fresh installation token (valid for 1 hour)
    return await getGitHubAppInstallationToken(project.githubInstallationId);
  }

  throw new Error(`Unknown GitHub auth type: ${authType}`);
}
