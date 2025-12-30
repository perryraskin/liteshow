/**
 * Git Sync Operations
 *
 * Handles syncing content changes to GitHub repositories using the GitHub Contents API.
 * This approach avoids local git operations and works well in containerized environments.
 */

import type { Project } from '@liteshow/db';
import { getGitHubTokenForProject } from './github-token';
import type { User } from '@liteshow/db';

export interface PageWithBlocks {
  page: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: string;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  blocks: Array<{
    id: string;
    pageId: string;
    type: string;
    order: number;
    content: any;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

/**
 * Sync a page and its blocks to the project's GitHub repository
 */
export async function syncPageToGitHub(
  project: Project,
  pageData: PageWithBlocks,
  user: User
): Promise<void> {
  const { page, blocks } = pageData;
  const filePath = `content/pages/${page.slug}.json`;

  // Get the appropriate GitHub token (OAuth or GitHub App)
  const githubAccessToken = await getGitHubTokenForProject(project, user);

  // Extract owner and repo from GitHub URL
  // Format: https://github.com/owner/repo
  const urlParts = project.githubRepoUrl.split('/');
  const owner = urlParts[urlParts.length - 2];
  const repo = urlParts[urlParts.length - 1];

  console.log(`Syncing page "${page.title}" to ${owner}/${repo} at ${filePath}`);

  // Prepare the content to commit
  const content = {
    page: {
      id: page.id,
      slug: page.slug,
      title: page.title,
      description: page.description,
      status: page.status,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      ogImage: page.ogImage,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    },
    blocks: blocks.map(block => ({
      id: block.id,
      type: block.type,
      order: block.order,
      content: block.content,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    })),
  };

  const contentJson = JSON.stringify(content, null, 2);
  const contentBase64 = Buffer.from(contentJson).toString('base64');

  // Check if file already exists to get its SHA (required for updates)
  let fileSha: string | undefined;
  try {
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `Bearer ${githubAccessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json() as { sha: string };
      fileSha = fileData.sha;
      console.log(`File exists, will update with SHA: ${fileSha}`);
    }
  } catch (error) {
    // File doesn't exist, that's fine - we'll create it
    console.log('File does not exist, will create new file');
  }

  // Create or update the file
  const commitMessage = fileSha
    ? `Update page: ${page.title}`
    : `Publish page: ${page.title}`;

  const updatePayload: any = {
    message: commitMessage,
    content: contentBase64,
    branch: 'main',
  };

  if (fileSha) {
    updatePayload.sha = fileSha;
  }

  const updateResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${githubAccessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(updatePayload),
    }
  );

  if (!updateResponse.ok) {
    const error = await updateResponse.text();
    console.error('GitHub API error:', error);
    throw new Error(`Failed to sync to GitHub: ${updateResponse.statusText}`);
  }

  const result = await updateResponse.json() as { commit: { sha: string } };
  console.log(`Successfully synced to GitHub. Commit SHA: ${result.commit.sha}`);
}

/**
 * Delete a page from the GitHub repository
 */
export async function deletePageFromGitHub(
  project: Project,
  pageSlug: string,
  user: User
): Promise<void> {
  const filePath = `content/pages/${pageSlug}.json`;

  // Get the appropriate GitHub token (OAuth or GitHub App)
  const githubAccessToken = await getGitHubTokenForProject(project, user);

  const urlParts = project.githubRepoUrl.split('/');
  const owner = urlParts[urlParts.length - 2];
  const repo = urlParts[urlParts.length - 1];

  console.log(`Deleting page "${pageSlug}" from ${owner}/${repo}`);

  // Get the file SHA (required for deletion)
  const getFileResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      headers: {
        'Authorization': `Bearer ${githubAccessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    }
  );

  if (!getFileResponse.ok) {
    // File doesn't exist, nothing to delete
    console.log('File does not exist in GitHub, nothing to delete');
    return;
  }

  const fileData = await getFileResponse.json() as { sha: string };
  const fileSha = fileData.sha;

  // Delete the file
  const deleteResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${githubAccessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `Delete page: ${pageSlug}`,
        sha: fileSha,
        branch: 'main',
      }),
    }
  );

  if (!deleteResponse.ok) {
    const error = await deleteResponse.text();
    console.error('GitHub API error:', error);
    throw new Error(`Failed to delete from GitHub: ${deleteResponse.statusText}`);
  }

  console.log(`Successfully deleted ${pageSlug} from GitHub`);
}
