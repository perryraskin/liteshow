/**
 * Progressive GitHub Permissions Tests
 *
 * Tests the OAuth flow with minimal initial scope and progressive permission requests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = 'http://localhost:8000';
let testServer: any;

// Helper to start test server if needed
beforeAll(async () => {
  // For now, assume server is already running
  // In future, we could spawn it programmatically
  console.log('Using running API server at', API_URL);
});

afterAll(async () => {
  // Cleanup if needed
});

describe('OAuth Progressive Permissions', () => {
  describe('Initial OAuth Flow', () => {
    it('should redirect to GitHub with minimal user:email scope', async () => {
      const response = await fetch(`${API_URL}/auth/github`, {
        redirect: 'manual',
      });

      expect(response.status).toBe(302);

      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      expect(location).toContain('github.com/login/oauth/authorize');
      // Scope can be URL-encoded or not
      expect(location).toMatch(/scope=user(%3A|:)email/);
      expect(location).not.toContain('repo');
      expect(location).not.toContain('public_repo');
    });

    it('should include correct client ID', async () => {
      const response = await fetch(`${API_URL}/auth/github`, {
        redirect: 'manual',
      });

      const location = response.headers.get('location');
      expect(location).toContain('client_id=Ov23liZqBcFMDSXChkwp');
    });

    it('should include callback URL', async () => {
      const response = await fetch(`${API_URL}/auth/github`, {
        redirect: 'manual',
      });

      const location = response.headers.get('location');
      expect(location).toContain('redirect_uri=');
      // URL-encoded or not
      expect(location).toMatch(/(%2F|\/|%252F)auth(%2F|\/|%252F)callback(%2F|\/|%252F)github/);
    });
  });

  describe('Scope Re-Request Flow', () => {
    it('should accept public_repo scope request', async () => {
      const response = await fetch(
        `${API_URL}/auth/github/request-scope?scope=public_repo&redirect=/projects/new`,
        { redirect: 'manual' }
      );

      expect(response.status).toBe(302);

      const location = response.headers.get('location');
      // Scope can be URL-encoded or not
      expect(location).toMatch(/scope=user(%3A|:)email(%20| )public_repo/);
      expect(location).toContain('state=');
    });

    it('should accept repo (private) scope request', async () => {
      const response = await fetch(
        `${API_URL}/auth/github/request-scope?scope=repo&redirect=/projects/new`,
        { redirect: 'manual' }
      );

      expect(response.status).toBe(302);

      const location = response.headers.get('location');
      // Scope can be URL-encoded or not
      expect(location).toMatch(/scope=user(%3A|:)email(%20| )repo/);
    });

    it('should reject invalid scope request', async () => {
      const response = await fetch(
        `${API_URL}/auth/github/request-scope?scope=invalid_scope`,
        { redirect: 'manual' }
      );

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('Invalid scope');
    });

    it('should require scope parameter', async () => {
      const response = await fetch(
        `${API_URL}/auth/github/request-scope`,
        { redirect: 'manual' }
      );

      expect(response.status).toBe(400);
    });

    it('should encode redirect URL in state parameter', async () => {
      const redirectPath = '/projects/new';
      const response = await fetch(
        `${API_URL}/auth/github/request-scope?scope=public_repo&redirect=${redirectPath}`,
        { redirect: 'manual' }
      );

      const location = response.headers.get('location');
      expect(location).toContain('state=');

      // Extract and decode state
      const stateMatch = location?.match(/state=([^&]+)/);
      expect(stateMatch).toBeTruthy();

      const state = stateMatch![1];
      const decodedState = Buffer.from(state, 'base64').toString('utf-8');
      expect(decodedState).toBe(redirectPath);
    });
  });

  describe('API Health', () => {
    it('should return server status', async () => {
      const response = await fetch(`${API_URL}/`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.service).toBe('Liteshow API');
      expect(body.status).toBe('running');
    });
  });
});
