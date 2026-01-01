import { Octokit } from '@octokit/rest';
import SodiumPlusModule from 'sodium-plus';

const { SodiumPlus, X25519PublicKey } = SodiumPlusModule;

/**
 * Trigger a GitHub Actions workflow deployment
 */
export async function triggerDeployment(
  owner: string,
  repo: string,
  token: string
): Promise<void> {
  const octokit = new Octokit({ auth: token });

  try {
    // Trigger workflow_dispatch event for the deploy workflow
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: 'deploy.yml',
      ref: 'main',
    });
  } catch (error: any) {
    throw new Error(`Failed to trigger deployment: ${error.message}`);
  }
}

/**
 * Get the status of the latest deployment workflow run
 */
export async function getLatestDeploymentStatus(
  owner: string,
  repo: string,
  token: string
): Promise<{
  status: string;
  conclusion: string | null;
  commitSha: string;
  url: string;
  createdAt: string;
} | null> {
  const octokit = new Octokit({ auth: token });

  try {
    // Get the latest workflow run for the deploy workflow
    const { data } = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: 'deploy.yml',
      per_page: 1,
    });

    const latestRun = data.workflow_runs[0];
    if (!latestRun) {
      return null;
    }

    return {
      status: latestRun.status || 'unknown', // 'queued', 'in_progress', 'completed'
      conclusion: latestRun.conclusion || null, // 'success', 'failure', 'cancelled', etc.
      commitSha: latestRun.head_sha,
      url: latestRun.html_url,
      createdAt: latestRun.created_at,
    };
  } catch (error: any) {
    throw new Error(`Failed to get deployment status: ${error.message}`);
  }
}

/**
 * Set repository secrets (called when project is created)
 */
export async function setRepositorySecret(
  owner: string,
  repo: string,
  token: string,
  secretName: string,
  secretValue: string
): Promise<void> {
  const octokit = new Octokit({ auth: token });

  try {
    // Get repository public key for encryption
    const { data: publicKey } = await octokit.actions.getRepoPublicKey({
      owner,
      repo,
    });

    // Encrypt the secret value using libsodium (sodium-plus package)
    const sodiumInstance = await SodiumPlus.auto();

    const messageBytes = Buffer.from(secretValue);
    const keyBytes = Buffer.from(publicKey.key, 'base64');
    const publicKeyObj = X25519PublicKey.from(keyBytes);
    const encryptedBytes = await sodiumInstance.crypto_box_seal(messageBytes, publicKeyObj);
    const encryptedValue = encryptedBytes.toString('base64');

    // Set the secret
    await octokit.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: secretName,
      encrypted_value: encryptedValue,
      key_id: publicKey.key_id,
    });
  } catch (error: any) {
    throw new Error(`Failed to set repository secret: ${error.message}`);
  }
}

/**
 * Enable GitHub Pages for a repository
 */
export async function enableGitHubPages(
  owner: string,
  repo: string,
  token: string
): Promise<string> {
  const octokit = new Octokit({ auth: token });

  try {
    // Enable GitHub Pages with GitHub Actions as source
    const { data } = await octokit.repos.createPagesSite({
      owner,
      repo,
      source: {
        branch: 'main',
        path: '/',
      },
      build_type: 'workflow',
    });

    return data.html_url || `https://${owner}.github.io/${repo}/`;
  } catch (error: any) {
    // If Pages is already enabled, get the existing URL
    if (error.status === 409) {
      try {
        const { data } = await octokit.repos.getPages({
          owner,
          repo,
        });
        return data.html_url || `https://${owner}.github.io/${repo}/`;
      } catch {
        throw new Error('GitHub Pages already enabled but could not retrieve URL');
      }
    }
    throw new Error(`Failed to enable GitHub Pages: ${error.message}`);
  }
}

/**
 * Parse GitHub repo URL to extract owner and repo name
 */
export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Handle both HTTPS and SSH URLs
    const httpsMatch = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?/);
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
      };
    }
    return null;
  } catch {
    return null;
  }
}
