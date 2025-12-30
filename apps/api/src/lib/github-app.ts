/**
 * GitHub App JWT Generation
 *
 * Generates JSON Web Tokens for authenticating as the LiteShow GitHub App.
 * The JWT is used to obtain installation access tokens.
 */

import jwt from 'jsonwebtoken';

/**
 * Generates a JWT for the LiteShow GitHub App
 * Valid for 10 minutes, used to authenticate API requests to GitHub
 *
 * @returns {string} Signed JWT token
 * @throws {Error} If GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is not set
 */
export function generateGitHubAppJWT(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyBase64 = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId) {
    throw new Error('GITHUB_APP_ID environment variable is not set');
  }

  if (!privateKeyBase64) {
    throw new Error('GITHUB_APP_PRIVATE_KEY environment variable is not set');
  }

  // Decode the base64-encoded private key
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');

  // JWT payload
  const payload = {
    iat: Math.floor(Date.now() / 1000), // Issued at time
    exp: Math.floor(Date.now() / 1000) + 600, // Expires in 10 minutes
    iss: appId, // GitHub App ID
  };

  // Sign the JWT with RS256 algorithm
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

/**
 * Gets an installation access token for a specific GitHub App installation
 * These tokens expire after 1 hour and have permissions scoped to the installation
 *
 * @param {string} installationId - The GitHub App installation ID
 * @returns {Promise<string>} Installation access token
 * @throws {Error} If the GitHub API request fails
 */
export async function getGitHubAppInstallationToken(
  installationId: string
): Promise<string> {
  const jwtToken = generateGitHubAppJWT();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to get installation token: ${response.status} ${error}`
    );
  }

  const data = await response.json() as { token: string; expires_at: string };
  return data.token; // Valid for 1 hour
}

/**
 * Lists all repositories accessible by a GitHub App installation
 *
 * @param {string} installationId - The GitHub App installation ID
 * @returns {Promise<Array>} Array of repository objects
 */
export async function listInstallationRepositories(
  installationId: string
): Promise<
  Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
  }>
> {
  const token = await getGitHubAppInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/installation/repositories`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to list installation repositories: ${response.status} ${error}`
    );
  }

  const data = await response.json() as { repositories: any[] };
  return data.repositories || [];
}
