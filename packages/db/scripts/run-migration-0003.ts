#!/usr/bin/env tsx
/**
 * Run migration 0003 - Add deployment fields
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import postgres from 'postgres';
import { readFileSync } from 'fs';

// Load environment variables
config({ path: resolve(process.cwd(), '../../apps/api/.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function runMigration() {
  try {
    console.log('🔄 Running migration 0003_add_deployment_fields.sql...');

    const migrationSQL = readFileSync(
      resolve(process.cwd(), './migrations/0003_add_deployment_fields.sql'),
      'utf-8'
    );

    // Execute the migration
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - Added deployment fields to projects table');
    console.log('   - Created deployments table');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
