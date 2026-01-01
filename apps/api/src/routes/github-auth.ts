/**
 * Simple GitHub OAuth Implementation
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load env vars before anything else - from apps/api directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(__dirname, '../..');
config({ path: resolve(apiDir, '.env') });
config({ path: resolve(apiDir, '.env.local'), override: true });

import { Hono } from 'hono';
import { db } from '@liteshow/db';
import { users } from '@liteshow/db';
import { eq } from 'drizzle-orm';

const authRoutes = new Hono();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const CALLBACK_URL = `${process.env.BETTER_AUTH_URL}/callback/github`;
const FRONTEND_URL = process.env.NEXT_PUBLIC_APP_URL!;

console.log('🔐 Auth routes loaded:');
console.log('  GITHUB_CLIENT_ID:', GITHUB_CLIENT_ID ? '✓ SET' : '✗ UNDEFINED');
console.log('  GITHUB_CLIENT_SECRET:', GITHUB_CLIENT_SECRET ? '✓ SET' : '✗ UNDEFINED');
console.log('  BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL || '✗ UNDEFINED');
console.log('  CALLBACK_URL:', CALLBACK_URL);

// Initiate GitHub OAuth (minimal scope - just profile)
authRoutes.get('/github', (c) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=user:email`;

  console.log('Redirecting to GitHub:', githubAuthUrl);
  return c.redirect(githubAuthUrl);
});

// Request additional scopes (for repository access)
authRoutes.get('/github/request-scope', (c) => {
  const scope = c.req.query('scope'); // 'public_repo' or 'repo'
  const redirect = c.req.query('redirect') || '/dashboard';

  if (!scope || (scope !== 'public_repo' && scope !== 'repo')) {
    return c.json({ error: 'Invalid scope. Must be "public_repo" or "repo"' }, 400);
  }

  // Store redirect URL in state parameter
  const state = Buffer.from(redirect).toString('base64');

  // Include workflow scope for GitHub Actions workflow file permissions
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=user:email%20${scope}%20workflow&state=${state}`;

  console.log(`Requesting additional scopes: ${scope}, workflow`);
  return c.redirect(githubAuthUrl);
});

// GitHub OAuth callback
authRoutes.get('/callback/github', async (c) => {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');

    if (!code) {
      return c.json({ error: 'No code provided' }, 400);
    }

    // Decode redirect URL from state if present
    let customRedirect = '/dashboard';
    if (state) {
      try {
        customRedirect = Buffer.from(state, 'base64').toString();
      } catch (e) {
        console.log('Could not decode state, using default redirect');
      }
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: CALLBACK_URL,
      }),
    });

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      scope?: string;
    };
    const accessToken = tokenData.access_token;
    const grantedScopes = tokenData.scope?.split(',') || [];

    if (!accessToken) {
      console.error('No access token received:', tokenData);
      return c.json({ error: 'Failed to get access token' }, 500);
    }

    // Determine which repo scopes were granted
    const hasPublicRepoScope = grantedScopes.includes('public_repo');
    const hasPrivateRepoScope = grantedScopes.includes('repo');

    console.log('Granted scopes:', grantedScopes);

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const githubUser = await userResponse.json() as {
      id: number;
      login: string;
      name: string;
      avatar_url: string;
    };

    // Get user emails
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean }>;
    const primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email;

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.githubId, String(githubUser.id)),
    });

    let userId;

    if (existingUser) {
      // Update existing user
      await db.update(users)
        .set({
          githubUsername: githubUser.login,
          githubEmail: primaryEmail,
          githubAccessToken: accessToken,
          name: githubUser.name,
          avatarUrl: githubUser.avatar_url,
          hasPublicRepoScope: hasPublicRepoScope || existingUser.hasPublicRepoScope,
          hasPrivateRepoScope: hasPrivateRepoScope || existingUser.hasPrivateRepoScope,
          scopesGrantedAt: hasPublicRepoScope || hasPrivateRepoScope ? new Date() : existingUser.scopesGrantedAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));

      userId = existingUser.id;
    } else {
      // Create new user
      const [newUser] = await db.insert(users).values({
        githubId: String(githubUser.id),
        githubUsername: githubUser.login,
        githubEmail: primaryEmail,
        githubAccessToken: accessToken,
        name: githubUser.name,
        avatarUrl: githubUser.avatar_url,
        hasPublicRepoScope,
        hasPrivateRepoScope,
        scopesGrantedAt: hasPublicRepoScope || hasPrivateRepoScope ? new Date() : undefined,
      }).returning();

      userId = newUser.id;
    }

    // Set session cookie (simple implementation)
    const sessionToken = Buffer.from(`${userId}:${accessToken}`).toString('base64');

    // Redirect to custom path or dashboard with session
    const redirectUrl = `${FRONTEND_URL}${customRedirect}${customRedirect.includes('?') ? '&' : '?'}session=${sessionToken}`;
    console.log('Auth successful, redirecting to:', redirectUrl);

    return c.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Get session info
authRoutes.get('/session', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');

    if (!sessionToken) {
      return c.json({ user: null });
    }

    const [userId] = Buffer.from(sessionToken, 'base64').toString().split(':');

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return c.json({ user: null });
    }

    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.githubEmail,
        username: user.githubUsername,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return c.json({ user: null });
  }
});

export default authRoutes;
