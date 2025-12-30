/**
 * Content Versioning Helper
 *
 * Manages versioning of page content by creating snapshots whenever pages are updated.
 * Snapshots include the full page data + all blocks.
 */

import { randomUUID } from 'crypto';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq, desc } from 'drizzle-orm';
import { pages, blocks, pageVersions } from '@liteshow/db/src/content-schema';

interface PageSnapshot {
  page: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: string;
    hasUnpublishedChanges: boolean;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
  };
  blocks: Array<{
    id: string;
    type: string;
    order: number;
    content: any;
  }>;
}

/**
 * Create a new version snapshot of a page
 */
export async function createPageVersion(
  db: LibSQLDatabase<any>,
  pageId: string,
  userId: string
): Promise<void> {
  try {
    // Fetch the current page data
    const pageData = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);

    if (pageData.length === 0) {
      throw new Error('Page not found');
    }

    // Fetch all blocks for this page
    const pageBlocks = await db
      .select()
      .from(blocks)
      .where(eq(blocks.pageId, pageId))
      .orderBy(blocks.order);

    // Get the latest version number for this page
    const latestVersion = await db
      .select()
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId))
      .orderBy(desc(pageVersions.versionNumber))
      .limit(1);

    const nextVersionNumber = latestVersion.length > 0 ? latestVersion[0].versionNumber + 1 : 1;

    // Create snapshot
    const snapshot: PageSnapshot = {
      page: {
        id: pageData[0].id,
        slug: pageData[0].slug,
        title: pageData[0].title,
        description: pageData[0].description,
        status: pageData[0].status,
        hasUnpublishedChanges: pageData[0].hasUnpublishedChanges || false,
        metaTitle: pageData[0].metaTitle,
        metaDescription: pageData[0].metaDescription,
        ogImage: pageData[0].ogImage,
      },
      blocks: pageBlocks.map(block => ({
        id: block.id,
        type: block.type,
        order: block.order,
        content: block.content,
      })),
    };

    // Save version
    await db.insert(pageVersions).values({
      id: randomUUID(),
      pageId,
      versionNumber: nextVersionNumber,
      snapshot: JSON.stringify(snapshot),
      createdBy: userId,
      createdAt: new Date(),
    });

    console.log(`Created version ${nextVersionNumber} for page ${pageId}`);
  } catch (error) {
    console.error('Failed to create page version:', error);
    // Don't throw - versioning should not break operations
  }
}

/**
 * Get version history for a page
 */
export async function getPageVersions(
  db: LibSQLDatabase<any>,
  pageId: string,
  limit: number = 10
) {
  try {
    // Limit to 10 versions to keep response size reasonable
    const versions = await db
      .select()
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId))
      .orderBy(desc(pageVersions.versionNumber))
      .limit(limit);

    return versions;
  } catch (error) {
    console.error('Error fetching page versions:', error);
    throw error;
  }
}

/**
 * Get a specific version by version number
 */
export async function getPageVersion(
  db: LibSQLDatabase<any>,
  pageId: string,
  versionNumber: number
) {
  const version = await db
    .select()
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .limit(1);

  return version.length > 0 ? version[0] : null;
}

/**
 * Restore a page to a specific version
 */
export async function restorePageVersion(
  db: LibSQLDatabase<any>,
  pageId: string,
  versionNumber: number,
  userId: string
): Promise<void> {
  try {
    // Get the version
    const versions = await db
      .select()
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId))
      .limit(1);

    if (versions.length === 0) {
      throw new Error('Version not found');
    }

    const version = versions[0];
    const snapshot = JSON.parse(version.snapshot as string) as PageSnapshot;

    // Create a version of the current state before restoring
    await createPageVersion(db, pageId, userId);

    // Restore page data
    await db.update(pages).set({
      slug: snapshot.page.slug,
      title: snapshot.page.title,
      description: snapshot.page.description,
      status: snapshot.page.status,
      hasUnpublishedChanges: snapshot.page.hasUnpublishedChanges || false,
      metaTitle: snapshot.page.metaTitle,
      metaDescription: snapshot.page.metaDescription,
      ogImage: snapshot.page.ogImage,
      updatedAt: new Date(),
    }).where(eq(pages.id, pageId));

    // Delete all existing blocks
    await db.delete(blocks).where(eq(blocks.pageId, pageId));

    // Restore blocks
    const now = new Date();
    for (const block of snapshot.blocks) {
      await db.insert(blocks).values({
        id: randomUUID(), // New ID for the block
        pageId,
        type: block.type,
        order: block.order,
        content: JSON.stringify(block.content),
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log(`Restored page ${pageId} to version ${versionNumber}`);
  } catch (error) {
    console.error('Failed to restore page version:', error);
    throw error;
  }
}
