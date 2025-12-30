/**
 * Migration script to add indexes to page_versions table
 * Run this once to add performance indexes to existing project databases
 */

import { config } from 'dotenv';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { projects } from '@liteshow/db/src/schema';
import { eq } from 'drizzle-orm';
import * as schema from '@liteshow/db/src/schema';

// Load environment variables
config();

const PROJECT_ID = '996c6b4f-41cb-4157-9a85-fc6b7d423cd1'; // Update with your project ID

async function addIndexes() {
  // Get project from PostgreSQL
  const pg = postgres(process.env.DATABASE_URL!);
  const db = drizzle(pg, { schema });

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, PROJECT_ID),
  });

  if (!project) {
    console.error('❌ Project not found');
    process.exit(1);
  }

  const url = `libsql://${project.tursoDbUrl}`;
  console.log(`Connecting to ${url}...`);

  const client = createClient({
    url,
    authToken: project.tursoDbToken,
  });

  try {
    // Check if indexes already exist
    const existingIndexes = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND tbl_name='page_versions'
    `);

    console.log('Existing indexes:', existingIndexes.rows);

    // Add pageId index if it doesn't exist
    if (!existingIndexes.rows.some(r => r.name === 'page_versions_page_id_idx')) {
      console.log('Creating page_versions_page_id_idx...');
      await client.execute(`
        CREATE INDEX page_versions_page_id_idx ON page_versions(page_id)
      `);
      console.log('✓ Created page_versions_page_id_idx');
    } else {
      console.log('✓ page_versions_page_id_idx already exists');
    }

    // Add composite index if it doesn't exist
    if (!existingIndexes.rows.some(r => r.name === 'page_versions_page_id_version_idx')) {
      console.log('Creating page_versions_page_id_version_idx...');
      await client.execute(`
        CREATE INDEX page_versions_page_id_version_idx ON page_versions(page_id, version_number)
      `);
      console.log('✓ Created page_versions_page_id_version_idx');
    } else {
      console.log('✓ page_versions_page_id_version_idx already exists');
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pg.end();
  }
}

addIndexes();
