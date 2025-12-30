/**
 * Drizzle Schema for Turso Content Database
 *
 * This schema is used for each project's isolated content database.
 * Each project gets its own Turso database with this schema.
 *
 * Content Model:
 * - Pages: Container with slug, title, status
 * - Blocks: Ordered array of content blocks (hero, features, markdown, etc.)
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Pages table - main content containers
export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(), // UUID as text in SQLite
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('draft'), // 'draft', 'published'

  // SEO metadata
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  ogImage: text('og_image'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Blocks table - content blocks within pages
export const blocks = sqliteTable('blocks', {
  id: text('id').primaryKey(), // UUID as text in SQLite
  pageId: text('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),

  // Block metadata
  type: text('type').notNull(), // 'hero', 'features', 'testimonials', 'markdown', 'cta', 'faq'
  order: integer('order').notNull(), // For ordering blocks within a page

  // Block content (stored as JSON)
  content: text('content', { mode: 'json' }).notNull(), // JSON object specific to block type

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Page versions table - snapshots of page + blocks at different points in time
export const pageVersions = sqliteTable('page_versions', {
  id: text('id').primaryKey(), // UUID as text in SQLite
  pageId: text('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(), // Incremental version number (1, 2, 3...)

  // Snapshot of page and blocks at this point in time
  snapshot: text('snapshot', { mode: 'json' }).notNull(), // { page: {...}, blocks: [...] }

  // Who created this version (from PostgreSQL users table)
  createdBy: text('created_by').notNull(), // User ID from main database

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Relations
export const pagesRelations = relations(pages, ({ many }) => ({
  blocks: many(blocks),
  versions: many(pageVersions),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  page: one(pages, {
    fields: [blocks.pageId],
    references: [pages.id],
  }),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one }) => ({
  page: one(pages, {
    fields: [pageVersions.pageId],
    references: [pages.id],
  }),
}));

// Export types for TypeScript
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type Block = typeof blocks.$inferSelect;
export type NewBlock = typeof blocks.$inferInsert;
export type PageVersion = typeof pageVersions.$inferSelect;
export type NewPageVersion = typeof pageVersions.$inferInsert;

// Block content type definitions
export interface HeroBlockContent {
  headline: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  backgroundImage?: string;
}

export interface FeaturesBlockContent {
  title?: string;
  features: Array<{
    icon?: string;
    title: string;
    description: string;
  }>;
}

export interface TestimonialsBlockContent {
  title?: string;
  testimonials: Array<{
    quote: string;
    author: string;
    role?: string;
    avatarUrl?: string;
  }>;
}

export interface MarkdownBlockContent {
  markdown: string;
}

export interface CtaBlockContent {
  headline: string;
  subheadline?: string;
  buttonText: string;
  buttonUrl: string;
  backgroundColor?: string;
}

export interface FaqBlockContent {
  title?: string;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
}

// Union type for all block content types
export type BlockContent =
  | HeroBlockContent
  | FeaturesBlockContent
  | TestimonialsBlockContent
  | MarkdownBlockContent
  | CtaBlockContent
  | FaqBlockContent;
