/**
 * Better Auth Client
 *
 * Client-side authentication helpers for use in Next.js and other frontends.
 */

import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
});

export const {
  signIn,
  signOut,
  useSession,
} = authClient;
