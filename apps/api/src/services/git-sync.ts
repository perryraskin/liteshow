/**
 * Git Sync Service
 *
 * Handles synchronization of content changes to GitHub repositories.
 * Each project has its own GitHub repository for content storage.
 */

import simpleGit from 'simple-git';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface GitSyncOptions {
  repoUrl: string;
  accessToken: string;
  authorName: string;
  authorEmail: string;
}

interface Page {
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
}

interface Block {
  id: string;
  pageId: string;
  type: string;
  content: any;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Syncs page content to GitHub repository
 */
export async function syncPageToGitHub(
  page: Page,
  blocks: Block[],
  options: GitSyncOptions,
  commitMessage: string
): Promise<void> {
  const repoPath = join(tmpdir(), `liteshow-${Date.now()}`);

  try {
    // Clone the repository
    const git = simpleGit();
    const repoUrlWithToken = options.repoUrl.replace(
      'https://github.com/',
      `https://${options.accessToken}@github.com/`
    );

    console.log(`Cloning repository to ${repoPath}...`);
    await git.clone(repoUrlWithToken, repoPath);

    // Configure git user
    const repoGit = simpleGit(repoPath);
    await repoGit.addConfig('user.name', options.authorName);
    await repoGit.addConfig('user.email', options.authorEmail);

    // Create content directory if it doesn't exist
    const contentDir = join(repoPath, 'content', 'pages');
    if (!existsSync(contentDir)) {
      mkdirSync(contentDir, { recursive: true });
    }

    // Write page data
    const pageData = {
      ...page,
      blocks: blocks.map((block) => ({
        id: block.id,
        type: block.type,
        content: block.content,
        order: block.order,
      })),
    };

    const pageFilePath = join(contentDir, `${page.slug}.json`);
    writeFileSync(pageFilePath, JSON.stringify(pageData, null, 2), 'utf-8');

    console.log(`Wrote page data to ${pageFilePath}`);

    // Stage, commit, and push
    await repoGit.add('.');
    await repoGit.commit(commitMessage);
    await repoGit.push('origin', 'main');

    console.log('Successfully pushed changes to GitHub');
  } catch (error) {
    console.error('Git sync error:', error);
    throw new Error(`Failed to sync to GitHub: ${error}`);
  } finally {
    // Clean up temp directory
    if (existsSync(repoPath)) {
      rmSync(repoPath, { recursive: true, force: true });
    }
  }
}

/**
 * Deletes a page from GitHub repository
 */
export async function deletePageFromGitHub(
  pageSlug: string,
  options: GitSyncOptions,
  commitMessage: string
): Promise<void> {
  const repoPath = join(tmpdir(), `liteshow-${Date.now()}`);

  try {
    // Clone the repository
    const git = simpleGit();
    const repoUrlWithToken = options.repoUrl.replace(
      'https://github.com/',
      `https://${options.accessToken}@github.com/`
    );

    console.log(`Cloning repository to ${repoPath}...`);
    await git.clone(repoUrlWithToken, repoPath);

    // Configure git user
    const repoGit = simpleGit(repoPath);
    await repoGit.addConfig('user.name', options.authorName);
    await repoGit.addConfig('user.email', options.authorEmail);

    // Delete page file
    const pageFilePath = join(repoPath, 'content', 'pages', `${pageSlug}.json`);
    if (existsSync(pageFilePath)) {
      rmSync(pageFilePath);
      console.log(`Deleted page file: ${pageFilePath}`);

      // Stage, commit, and push
      await repoGit.add('.');
      await repoGit.commit(commitMessage);
      await repoGit.push('origin', 'main');

      console.log('Successfully pushed deletion to GitHub');
    } else {
      console.log('Page file does not exist, skipping deletion');
    }
  } catch (error) {
    console.error('Git delete error:', error);
    throw new Error(`Failed to delete from GitHub: ${error}`);
  } finally {
    // Clean up temp directory
    if (existsSync(repoPath)) {
      rmSync(repoPath, { recursive: true, force: true });
    }
  }
}
