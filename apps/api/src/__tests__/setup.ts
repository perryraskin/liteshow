/**
 * Vitest test setup
 * Runs before all tests
 */

import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(__dirname, '../../../../.env') });

// Ensure we're using test database (if you want a separate test DB)
// For now, we'll use the same dev DB but be careful with data

console.log('Test environment initialized');
