/**
 * GitHub App Integration Tests
 *
 * Tests JWT generation and GitHub App API functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateGitHubAppJWT } from '../lib/github-app';
import jwt from 'jsonwebtoken';

// Valid test RSA private key (2048-bit) for testing purposes only
// Generated with: openssl genrsa 2048
const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCnXQpuhze8keua
reAIXizmDNvmNsL/N2BBA6nYW2THMc1pyVDXWslZdUBcqyPyqVnOrMS9VWLRIql8
RWyNEGE/i5IMS2CHLAWZvSvwQLNwKL3JQxnkVh+D0RW+AZqWbBimV0kJRjONGfhm
PAcWwHwqFqGkeTAi3k8Fv0OOz0tguzlH5NYn3gGrsyjCCf4El/vE1qW2zSJhG8eh
UVeuNEb8x4lANvKBKVcM2Hi96bIavmUEUim7tk2Xrcqz+M2EYEnbzmIMGApN9Hjj
lRTvCRoDbpOhCSoMVSbps99Q3+RhhSGU69d/941zYxJfqpHGqoUzdc1W53v7Piop
4Kg+CVsfAgMBAAECggEAAodvEJaDKsVQYx5SLq4wTYBPk7NWJQHS4YigThWreIXH
IzHDQqMrkb9/gSb7kb9/YkEiw/MAsu+sJ1BBQKxzsRXMgi+4E12AmX8jT9ZvymJt
48Gw0s4pBxaSFony/7zobnMOi9D/bG1tCdZ0YPf4UwZ+hia9VHmO23kKw04HRzyR
cohzJ9cD7XDMzSUrsukp95XmnBUKljeQaSlXPOsmVZczrIbijIPQTh9aJi4Lh2RL
d3fgS8tHwe1wXXADEtgVGXeP3dT/uQZD6DNCNnoC0jVbtGq5D71olIoXClgc3nZH
KulnZsbc4odnYzCcOxH65hLdCW9RL6kMQyxQVVt+0QKBgQDPqhOIFgb9dQyPweHg
4nKhTzFPbjtoGU0EYSDt3mPnVwhAl7iusxgiEoWIbZO0anMwrVpqsPEK/peeP5by
ivdc44+3gp93GM74MFNwdzza6N7GV+LhElJvDk2NgIoMhpjHRfQGZwJE+vQLL8Ga
NI59hZYXJ4XHimDsf595onWyeQKBgQDOUZZGf5JQ3qjGgrSw+UCdC2/dDUp3sX6j
Wp7GdauD54aarCPbWq7aALPkSQw4xZ9W3hLzFejKV6K4rdgHjzZyYqlXBrSTX7c6
RKmJ0ymS4wY3gC93pTALibaQFgEWLVisYDnTSoWG1vg59Ts7uYTnAh6rro7IF7Ux
i24zxspUVwKBgC6AA/2eCRSqKBTssjqcGlT6ma0SnuTRfYh0g14gRTihKWzlTGp6
GfZPNW12M/PbPk3xE2T+mAsBNUwvKwrGiVtYbW8HJdQSTw4OLDDr0kmmiXPabCg/
5QuPJViBJuhlH0LH7Duex0hQ9WKn3+86w4lh51jp9a/X0ZpDfZ9L/JTpAoGBALlE
Zi9UKy1XZDMt99fbWvwq4v6bCr3EszU5EM6hp6zA4QxPe7tkCRNWAjQCrGjmfRji
Ph3vFKVuYH56DT1sirXYhrvRF6InFz/JnHxZFEIEfvajsvw7Z5NUzI1CVSN3AON5
XTOw/YqBy1EwN0qAYymVq7j6/NgNAfZFgGYaImHtAoGBAISl2sOBbPKhfALEzmkg
PqXLoFaCgmHwngU33jSX/XCcTpoZ1XW/f+tmgdWacThs/ZGkdL0aLSIU0FT99IOv
v+j62ZVtBGUVNc1wpUbYUA2h1XJxdWsJzo5Fq313AR/d7ng4jRznR3OBLdj9m6Ar
wG9NR3mH8wMuGiAVGMQG4ElO
-----END PRIVATE KEY-----`;

const originalEnv = {
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
};

describe('GitHub App', () => {
  describe('JWT Generation', () => {
    beforeAll(() => {
      // Set up test credentials
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY = Buffer.from(testPrivateKey).toString('base64');
    });

    afterAll(() => {
      // Restore original environment
      if (originalEnv.GITHUB_APP_ID) {
        process.env.GITHUB_APP_ID = originalEnv.GITHUB_APP_ID;
      } else {
        delete process.env.GITHUB_APP_ID;
      }
      if (originalEnv.GITHUB_APP_PRIVATE_KEY) {
        process.env.GITHUB_APP_PRIVATE_KEY = originalEnv.GITHUB_APP_PRIVATE_KEY;
      } else {
        delete process.env.GITHUB_APP_PRIVATE_KEY;
      }
    });

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
      expect(decoded.iss).toBe('12345');
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
