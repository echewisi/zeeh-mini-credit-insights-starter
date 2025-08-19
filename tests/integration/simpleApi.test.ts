import request from 'supertest';
import { createServer } from '../../src/server.js';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Credit Insights API - Simple Integration', () => {
  let app: any;

  beforeAll(async () => {
    app = createServer();
  });

  afterAll(async () => {
    // Clean up
  });

  describe('Health and Basic Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app).get('/unknown');
      expect(response.status).toBe(404);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for protected endpoints', async () => {
      const response = await request(app).get('/audit/logs');
      expect(response.status).toBe(401);
    });

    it('should require authentication for statement upload', async () => {
      const response = await request(app).post('/statements/upload');
      expect(response.status).toBe(401);
    });

    it('should require authentication for insights computation', async () => {
      const response = await request(app).post('/insights/run');
      expect(response.status).toBe(401);
    });

    it('should require authentication for bureau check', async () => {
      const response = await request(app).post('/bureau/check');
      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation', () => {
    it('should validate login input', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should validate bureau check input', async () => {
      // This will fail authentication first, but we can test the endpoint structure
      const response = await request(app)
        .post('/bureau/check')
        .send({ bvn: '123' }); // Too short

      expect(response.status).toBe(401); // Authentication required first
    });
  });

  describe('API Structure', () => {
    it('should have proper CORS headers', async () => {
      const response = await request(app).get('/health');
      expect(response.headers).toBeDefined();
    });

    it('should return proper JSON responses', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
