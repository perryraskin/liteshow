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

  console.log('getGitHubTokenForProject:', {
    authType,
    hasGithubAccessToken: !!user.githubAccessToken,
    tokenLength: user.githubAccessToken?.length || 0,
    tokenPrefix: user.githubAccessToken?.substring(0, 4) + '...' || 'none',
    hasInstallationId: !!project.githubInstallationId,
  });

  if (authType === 'oauth') {
    if (!user.githubAccessToken) {
      throw new Error('User does not have a GitHub access token');
    }
    // Test if token is valid by making a simple API call
    const testResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${user.githubAccessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    // Check token scopes from response headers
    const scopes = testResponse.headers.get('x-oauth-scopes') || 'none';

    if (!testResponse.ok) {
      const errorBody = await testResponse.text();
      console.error('OAuth token is invalid:', errorBody);

      // Create a specific error type for authentication failures
      const error = new Error(`GitHub OAuth token is invalid or expired (status ${testResponse.status})`);
      (error as any).code = 'GITHUB_AUTH_REQUIRED';
      (error as any).requiresReauth = true;
      throw error;
    }

    // Get the authenticated user's info
    const userData = await testResponse.json();

    console.log('OAuth token test /user:', {
      status: testResponse.status,
      statusText: testResponse.statusText,
      authenticatedUser: userData.login,
      scopes,
    });

    // Warning if token doesn't have write permissions
    if (!scopes.includes('repo') && !scopes.includes('public_repo')) {
      console.warn('⚠️  OAuth token does not have repo write permissions!', {
        currentScopes: scopes,
        requiredScopes: 'repo or public_repo',
      });
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
