/**
 * Activity Logging Helper
 *
 * Centralized logging for all user activities across the platform.
 */

import { db } from '@liteshow/db';
import { activityLogs } from '@liteshow/db';

export type ActivityAction =
  | 'page_created'
  | 'page_updated'
  | 'page_deleted'
  | 'page_saved'
  | 'block_created'
  | 'block_updated'
  | 'block_deleted'
  | 'block_reordered'
  | 'project_created'
  | 'git_sync';

export type ActivitySource = 'manual' | 'ai' | 'git_sync';

export type EntityType = 'page' | 'block' | 'project';

interface LogActivityParams {
  projectId: string;
  userId: string;
  action: ActivityAction;
  entityType: EntityType;
  entityId?: string;
  source?: ActivitySource;
  metadata?: Record<string, any>;
}

/**
 * Log an activity to the activity_logs table
 */
export async function logActivity({
  projectId,
  userId,
  action,
  entityType,
  entityId,
  source = 'manual',
  metadata,
}: LogActivityParams): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      projectId,
      userId,
      action,
      entityType,
      entityId: entityId || null,
      source,
      metadata: metadata || null,
    });

    console.log(`Activity logged: ${action} on ${entityType} ${entityId || ''} by user ${userId}`);
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging should not break operations
  }
}

/**
 * Helper: Log page activity
 */
export async function logPageActivity(
  action: Extract<ActivityAction, 'page_created' | 'page_updated' | 'page_deleted' | 'page_saved'>,
  projectId: string,
  userId: string,
  pageId: string,
  metadata?: Record<string, any>
) {
  await logActivity({
    projectId,
    userId,
    action,
    entityType: 'page',
    entityId: pageId,
    source: 'manual',
    metadata,
  });
}

/**
 * Helper: Log block activity
 */
export async function logBlockActivity(
  action: Extract<ActivityAction, 'block_created' | 'block_updated' | 'block_deleted' | 'block_reordered'>,
  projectId: string,
  userId: string,
  blockId: string,
  metadata?: Record<string, any>
) {
  await logActivity({
    projectId,
    userId,
    action,
    entityType: 'block',
    entityId: blockId,
    source: 'manual',
    metadata,
  });
}
