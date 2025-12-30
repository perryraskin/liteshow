/**
 * Migration script for progressive GitHub permissions
 * Run with: cd apps/api && node --import tsx src/scripts/migrate-permissions.ts
 */

import { sql } from 'drizzle-orm';
import { db } from '@liteshow/db';

async function migrate() {
  console.log('Running progressive permissions migration...\n');

  try {
    // Add columns to users table
    console.log('1. Adding columns to users table...');
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS has_public_repo_scope BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS has_private_repo_scope BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS scopes_granted_at TIMESTAMP
    `);
    console.log('   ✓ Users table updated\n');

    // Add columns to projects table
    console.log('2. Adding columns to projects table...');
    await db.execute(sql`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS github_auth_type TEXT,
      ADD COLUMN IF NOT EXISTS github_installation_id TEXT,
      ADD COLUMN IF NOT EXISTS github_repo_id TEXT
    `);
    console.log('   ✓ Projects table updated\n');

    // Migrate existing projects
    console.log('3. Migrating existing projects to oauth auth type...');
    await db.execute(sql`
      UPDATE projects
      SET github_auth_type = 'oauth'
      WHERE github_auth_type IS NULL
    `);
    console.log('   ✓ Updated existing projects\n');

    // Migrate existing users
    console.log('4. Migrating existing users with public repo scope...');
    await db.execute(sql`
      UPDATE users
      SET has_public_repo_scope = true,
          scopes_granted_at = NOW()
      WHERE github_access_token IS NOT NULL AND has_public_repo_scope = false
    `);
    console.log('   ✓ Updated existing users\n');

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
