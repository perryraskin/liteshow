/**
 * Migration script for progressive GitHub permissions
 * Run with: tsx packages/db/scripts/migrate-progressive-permissions.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log('Running progressive permissions migration...');

  try {
    // Read the migration SQL file
    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, '../migrations/0001_progressive_github_permissions.sql'),
      'utf-8'
    );

    // Execute each statement (split by semicolon)
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 80) + '...');
      await pool.query(statement);
    }

    console.log('✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('Migration script error:', error);
  process.exit(1);
});
