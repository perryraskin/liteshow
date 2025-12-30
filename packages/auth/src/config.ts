/**
 * Better Auth Configuration
 *
 * Configures GitHub OAuth authentication with repo scope
 * for managing repositories on behalf of users.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@liteshow/db';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:8000',
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: false, // We only use GitHub OAuth
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // Request public_repo scope for managing public repositories only
      // This is sufficient since generated sites need to be public for deployment
      scope: ['user:email', 'public_repo'],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  callbacks: {
    async session({ session, user }: { session: any; user: any }) {
      // Add custom user data to session if needed
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
        },
      };
    },
  },
});

export type Session = typeof auth.$Infer.Session;
