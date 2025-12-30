/**
 * GitHub App Integration Tests
 *
 * Tests JWT generation and GitHub App API functionality
 */

import { describe, it, expect } from 'vitest';
import { generateGitHubAppJWT } from '../lib/github-app';
import jwt from 'jsonwebtoken';

describe('GitHub App', () => {
  describe('JWT Generation', () => {
    it('should generate a valid JWT', () => {
      const token = generateGitHubAppJWT();

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct claims', () => {
      const token = generateGitHubAppJWT();
      const decoded = jwt.decode(token) as any;

      expect(decoded).toBeTruthy();
      expect(decoded.iss).toBe(process.env.GITHUB_APP_ID);
      expect(decoded.iat).toBeTruthy();
      expect(decoded.exp).toBeTruthy();

      // Expiry should be ~10 minutes from now
      const now = Math.floor(Date.now() / 1000);
      expect(decoded.exp - decoded.iat).toBeGreaterThanOrEqual(590);
      expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(610);
    });

    it('should use RS256 algorithm', () => {
      const token = generateGitHubAppJWT();
      const decoded = jwt.decode(token, { complete: true }) as any;

      expect(decoded.header.alg).toBe('RS256');
    });

    it('should throw error if GITHUB_APP_ID is missing', () => {
      const originalAppId = process.env.GITHUB_APP_ID;
      delete process.env.GITHUB_APP_ID;

      expect(() => generateGitHubAppJWT()).toThrow(
        'GITHUB_APP_ID environment variable is not set'
      );

      process.env.GITHUB_APP_ID = originalAppId;
    });

    it('should throw error if GITHUB_APP_PRIVATE_KEY is missing', () => {
      const originalKey = process.env.GITHUB_APP_PRIVATE_KEY;
      delete process.env.GITHUB_APP_PRIVATE_KEY;

      expect(() => generateGitHubAppJWT()).toThrow(
        'GITHUB_APP_PRIVATE_KEY environment variable is not set'
      );

      process.env.GITHUB_APP_PRIVATE_KEY = originalKey;
    });
  });

  describe('GitHub App Routes', () => {
    const API_URL = 'http://localhost:8000';

    it('should have installation repos endpoint', async () => {
      // This will fail without auth, but should return 401/403, not 404
      const response = await fetch(
        `${API_URL}/github-app/installations/12345/repos`
      );

      // Should not be 404 (route exists)
      expect(response.status).not.toBe(404);
    });
  });
});
