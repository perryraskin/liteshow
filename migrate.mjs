/**
 * Migration script for progressive GitHub permissions
 * Run with: node migrate.mjs
 */

import pg from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const { Pool } = pg;

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('Running progressive permissions migration...');

  try {
    // Read the migration SQL file
    const migrationSql = fs.readFileSync(
      resolve(__dirname, 'packages/db/migrations/0001_progressive_github_permissions.sql'),
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
  } catch (error) {
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
