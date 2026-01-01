/**
 * Auth Package Entry Point
 *
 * Exports authentication configuration, middleware, and client helpers.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load .env from root directory (3 levels up from packages/auth/src)
// This ensures environment variables are available before auth config initializes
if (process.env.NODE_ENV !== 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, '../../../apps/api/.env') });
}

export * from './config';
export * from './middleware';
export * from './client';
