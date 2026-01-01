/**
 * Drizzle Schema for PostgreSQL Metadata Database
 *
 * This schema defines the central metadata for the Liteshow platform:
 * - Users (linked to GitHub accounts)
 * - Projects (one per user site)
 * - Domains (custom domain mappings)
 * - Activity logs (tracking all content changes)
 */

import { pgTable, text, timestamp, uuid, boolean, jsonb, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - stores GitHub authenticated users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  githubId: text('github_id').notNull().unique(),
  githubUsername: text('github_username').notNull(),
  githubEmail: text('github_email'),
  githubAccessToken: text('github_access_token'), // For repo management
  name: text('name'),
  avatarUrl: text('avatar_url'),
  email: text('email'), // Better Auth - populated from github_email
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'), // Better Auth uses 'image' instead of 'avatarUrl'

  // Progressive permissions tracking
  hasPublicRepoScope: boolean('has_public_repo_scope').default(false).notNull(),
  hasPrivateRepoScope: boolean('has_private_repo_scope').default(false).notNull(),
  scopesGrantedAt: timestamp('scopes_granted_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Better Auth: Sessions table
export const sessions = pgTable('session', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Better Auth: Accounts table (for OAuth providers)
export const accounts = pgTable('account', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(), // GitHub user ID
  providerId: text('provider_id').notNull(), // 'github'
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  expiresAt: timestamp('expires_at'),
  password: text('password'), // For email/password auth (not used)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Better Auth: Verification tokens
export const verifications = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Projects table - each project represents a user's site
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),

  // Turso database connection details
  tursoDbUrl: text('turso_db_url').notNull(),
  tursoDbToken: text('turso_db_token').notNull(),

  // GitHub repository details (nullable for link-later strategy)
  githubRepoName: text('github_repo_name'),
  githubRepoUrl: text('github_repo_url'),
  githubAuthType: text('github_auth_type'), // 'oauth' or 'github_app'
  githubInstallationId: text('github_installation_id'), // For GitHub App installations
  githubRepoId: text('github_repo_id'), // GitHub repository ID

  // Project settings
  isPublished: boolean('is_published').default(false).notNull(),

  // Site settings (for Astro site customization)
  siteTitle: text('site_title'), // e.g., "Joe Shmoe" - appears as "Home - Joe Shmoe"
  siteDescription: text('site_description'), // Meta description for SEO
  faviconUrl: text('favicon_url'), // URL to favicon image

  // Deployment settings
  deploymentPlatform: text('deployment_platform').default('github-pages'),
  deploymentStatus: text('deployment_status'), // 'live', 'building', 'failed', 'not_deployed'
  deploymentUrl: text('deployment_url'),
  lastDeployedAt: timestamp('last_deployed_at'),
  lastDeploymentCommit: text('last_deployment_commit'),
  autoDeployOnSave: boolean('auto_deploy_on_save').default(false).notNull(),
  customDomain: text('custom_domain'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Domains table - custom domain mappings
export const domains = pgTable('domains', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull().unique(),
  isVerified: boolean('is_verified').default(false).notNull(),
  verificationToken: text('verification_token'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Activity logs - tracking all changes
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Activity details
  action: text('action').notNull(), // 'page_created', 'page_updated', 'block_added', etc.
  entityType: text('entity_type').notNull(), // 'page', 'block', etc.
  entityId: text('entity_id'), // ID of the page/block that was changed

  // Change attribution
  source: text('source').notNull(), // 'ai', 'manual', 'git_sync'
  metadata: jsonb('metadata'), // Additional context (e.g., AI prompt, commit hash)

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Deployments table - tracking deployment history
export const deployments = pgTable('deployments', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  // Deployment details
  status: text('status').notNull(), // 'queued', 'in_progress', 'success', 'failure'
  commitSha: text('commit_sha'),
  commitMessage: text('commit_message'),
  deploymentUrl: text('deployment_url'),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  activityLogs: many(activityLogs),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  domains: many(domains),
  activityLogs: many(activityLogs),
  deployments: many(deployments),
}));

export const domainsRelations = relations(domains, ({ one }) => ({
  project: one(projects, {
    fields: [domains.projectId],
    references: [projects.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  project: one(projects, {
    fields: [activityLogs.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
}));

// Export types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
