/**
 * Health Endpoint Tests
 *
 * Tests the health check endpoint for monitoring and uptime checks
 */

import { describe, it, expect } from 'vitest';

const API_URL = 'http://localhost:8000';

describe('Health Endpoint', () => {
  it('should return healthy status', async () => {
    const response = await fetch(`${API_URL}/health`);

    expect(response.status).toBe(200);

    const body = (await response.json()) as any;
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('liteshow-api');
  });

  it('should include timestamp in response', async () => {
    const response = await fetch(`${API_URL}/health`);
    const body = (await response.json()) as any;

    expect(body.timestamp).toBeTruthy();
    expect(typeof body.timestamp).toBe('string');

    // Verify timestamp is a valid ISO string
    const timestamp = new Date(body.timestamp);
    expect(timestamp.toString()).not.toBe('Invalid Date');
  });

  it('should respond quickly (under 1 second)', async () => {
    const startTime = Date.now();
    const response = await fetch(`${API_URL}/health`);
    const endTime = Date.now();

    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeLessThan(1000);
  });

  it('should return JSON content type', async () => {
    const response = await fetch(`${API_URL}/health`);

    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });
});
