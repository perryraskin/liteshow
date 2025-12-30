/**
 * Database client exports
 *
 * This module exports:
 * - PostgreSQL client for metadata database
 * - Turso client factory for content databases
 * - Database schemas and types
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleTurso } from 'drizzle-orm/libsql';
import postgres from 'postgres';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import * as contentSchema from './content-schema';

// Load .env from root directory (2 levels up from packages/db/src)
// Only load from file in development - production uses env vars
if (process.env.NODE_ENV !== 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

// PostgreSQL client for metadata database - lazy initialization
let _db: ReturnType<typeof drizzlePg> | null = null;

export const db = new Proxy({} as ReturnType<typeof drizzlePg>, {
  get(target, prop) {
    if (!_db) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
      }
      const client = postgres(connectionString, {
        connect_timeout: 10,
        idle_timeout: 20,
        max_lifetime: 60 * 30,
      });
      _db = drizzlePg(client, { schema });
    }
    return (_db as any)[prop];
  },
});

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
