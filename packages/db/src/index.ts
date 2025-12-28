/**
 * Database client exports
 *
 * This module exports:
 * - PostgreSQL client for metadata database
 * - Turso client factory for content databases
 * - Database schemas and types
 */

import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleTurso } from 'drizzle-orm/libsql';
import postgres from 'postgres';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import * as contentSchema from './content-schema';

// PostgreSQL client for metadata database
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString);
export const db = drizzlePg(client, { schema });

// Turso client factory - creates a client for a specific project's content database
export function createTursoClient(url: string, authToken: string) {
  const client = createClient({
    url,
    authToken,
  });

  return drizzleTurso(client, { schema: contentSchema });
}

// Export schemas and types
export * from './schema';
export * from './content-schema';
export { schema, contentSchema };
