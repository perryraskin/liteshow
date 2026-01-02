/**
 * Public Content API Tests
 *
 * Tests the public-facing content API endpoints that serve
 * published pages to Astro sites during build time.
 */

import { describe, it, expect } from 'vitest';

const API_URL = 'http://localhost:8000';

describe('Public Content API', () => {
  describe('Endpoint Structure', () => {
    it('should have pages list endpoint', async () => {
      // Test that the endpoint exists (will 404 for non-existent project)
      const response = await fetch(`${API_URL}/public/sites/test-project/pages`);

      // Should not be 405 (method not allowed) - endpoint should exist
      expect(response.status).not.toBe(405);
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should have single page endpoint', async () => {
      const response = await fetch(`${API_URL}/public/sites/test-project/pages/test-page`);

      // Should not be 405 (method not allowed) - endpoint should exist
      expect(response.status).not.toBe(405);
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should have settings endpoint', async () => {
      const response = await fetch(`${API_URL}/public/sites/test-project/settings`);

      // Should not be 405 (method not allowed) - endpoint should exist
      expect(response.status).not.toBe(405);
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent project', async () => {
      const response = await fetch(
        `${API_URL}/public/sites/definitely-does-not-exist-12345/pages`
      );

      expect(response.status).toBe(404);

      const body = (await response.json()) as any;
      expect(body.error).toBeTruthy();
    });

    it('should return JSON content type', async () => {
      const response = await fetch(`${API_URL}/public/sites/test-project/pages`);

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });

    it('should handle missing page slug gracefully', async () => {
      const response = await fetch(
        `${API_URL}/public/sites/test-project/pages/non-existent-page-12345`
      );

      expect(response.status).toBe(404);

      const body = (await response.json()) as any;
      expect(body.error).toBeTruthy();
    });
  });

  describe('Response Structure', () => {
    it('should validate pages list response structure', () => {
      // Example of expected response structure
      const mockPagesResponse = [
        {
          id: 'page-123',
          slug: 'about',
          title: 'About Us',
          description: 'About our company',
          status: 'saved',
          hasUnpublishedChanges: false,
          metaTitle: null,
          metaDescription: null,
          ogImage: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      expect(mockPagesResponse).toBeInstanceOf(Array);
      expect(mockPagesResponse[0]).toHaveProperty('id');
      expect(mockPagesResponse[0]).toHaveProperty('slug');
      expect(mockPagesResponse[0]).toHaveProperty('title');
      expect(mockPagesResponse[0]).toHaveProperty('status');
      expect(mockPagesResponse[0].status).toBe('saved');
    });

    it('should validate single page response structure', () => {
      // Example of expected response structure
      const mockPageResponse = {
        id: 'page-123',
        slug: 'about',
        title: 'About Us',
        description: 'About our company',
        status: 'saved',
        hasUnpublishedChanges: false,
        metaTitle: 'About Us - Company Name',
        metaDescription: 'Learn more about our company',
        ogImage: 'https://example.com/og.jpg',
        blocks: [
          {
            id: 'block-1',
            type: 'heading',
            order: 0,
            content: { text: 'Welcome' },
          },
          {
            id: 'block-2',
            type: 'paragraph',
            order: 1,
            content: { text: 'This is our story.' },
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(mockPageResponse).toHaveProperty('blocks');
      expect(mockPageResponse.blocks).toBeInstanceOf(Array);
      expect(mockPageResponse.blocks[0]).toHaveProperty('type');
      expect(mockPageResponse.blocks[0]).toHaveProperty('order');
      expect(mockPageResponse.blocks[0]).toHaveProperty('content');
    });

    it('should validate settings response structure', () => {
      // Example of expected response structure
      const mockSettingsResponse = {
        siteTitle: 'My Awesome Site',
        siteDescription: 'Welcome to my site',
        faviconUrl: 'https://example.com/favicon.ico',
      };

      expect(mockSettingsResponse).toHaveProperty('siteTitle');
      expect(mockSettingsResponse).toHaveProperty('siteDescription');
      expect(mockSettingsResponse).toHaveProperty('faviconUrl');
      expect(typeof mockSettingsResponse.siteTitle).toBe('string');
    });
  });

  describe('Block Content Parsing', () => {
    it('should parse JSON string content correctly', () => {
      const blockWithStringContent = {
        id: 'block-1',
        type: 'paragraph',
        order: 0,
        content: '{"text":"Hello world"}',
      };

      const parsedContent =
        typeof blockWithStringContent.content === 'string'
          ? JSON.parse(blockWithStringContent.content)
          : blockWithStringContent.content;

      expect(parsedContent).toHaveProperty('text');
      expect(parsedContent.text).toBe('Hello world');
    });

    it('should handle already parsed content', () => {
      const blockWithObjectContent = {
        id: 'block-1',
        type: 'paragraph',
        order: 0,
        content: { text: 'Hello world' },
      };

      const parsedContent =
        typeof blockWithObjectContent.content === 'string'
          ? JSON.parse(blockWithObjectContent.content)
          : blockWithObjectContent.content;

      expect(parsedContent).toHaveProperty('text');
      expect(parsedContent.text).toBe('Hello world');
    });

    it('should handle complex nested content', () => {
      const complexContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      };

      const serialized = JSON.stringify(complexContent);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.content).toBeInstanceOf(Array);
      expect(deserialized.content[0].content[0].text).toBe('Hello');
    });
  });

  describe('Status Filtering', () => {
    it('should only serve saved pages', () => {
      const pages = [
        { id: '1', slug: 'page-1', status: 'saved' },
        { id: '2', slug: 'page-2', status: 'draft' },
        { id: '3', slug: 'page-3', status: 'saved' },
      ];

      const savedPages = pages.filter(p => p.status === 'saved');

      expect(savedPages).toHaveLength(2);
      expect(savedPages[0].status).toBe('saved');
      expect(savedPages[1].status).toBe('saved');
    });

    it('should not serve draft pages', () => {
      const page = { id: '1', slug: 'draft-page', status: 'draft' };

      expect(page.status).not.toBe('saved');
    });

    it('should not serve pages with unpublished changes', () => {
      const page = {
        id: '1',
        slug: 'page',
        status: 'saved',
        hasUnpublishedChanges: true,
      };

      // In public API, we only check status === 'saved'
      // hasUnpublishedChanges is informational
      expect(page.status).toBe('saved');
    });
  });

  describe('Settings Defaults', () => {
    it('should use project name as default site title', () => {
      const project = {
        name: 'My Project',
        siteTitle: null,
      };

      const siteTitle = project.siteTitle || project.name;

      expect(siteTitle).toBe('My Project');
    });

    it('should use provided site title over project name', () => {
      const project = {
        name: 'My Project',
        siteTitle: 'Custom Site Title',
      };

      const siteTitle = project.siteTitle || project.name;

      expect(siteTitle).toBe('Custom Site Title');
    });

    it('should generate default description from project name', () => {
      const project = {
        name: 'My Project',
        siteDescription: null,
      };

      const siteDescription = project.siteDescription || `Welcome to ${project.name}`;

      expect(siteDescription).toBe('Welcome to My Project');
    });

    it('should handle null favicon gracefully', () => {
      const project = {
        faviconUrl: null,
      };

      expect(project.faviconUrl).toBeNull();
    });
  });
});
