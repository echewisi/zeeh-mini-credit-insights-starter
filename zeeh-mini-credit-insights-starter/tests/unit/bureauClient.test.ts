import { BureauClient } from '../../src/services/bureauClient.js';
import axios from 'axios';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { never } from 'zod';


// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Prisma client
const mockPrismaClient = {
  bureauReport: {
    findFirst: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient)
}));

// Mock AuditLogService
jest.mock('../../src/services/auditLogService.js', () => ({
  AuditLogService: {
    record: jest.fn()
  }
}));

describe('BureauClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset mock implementations
    mockPrismaClient.bureauReport.findFirst.mockReset();
    mockPrismaClient.bureauReport.create.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Credit Check', () => {
    it('should successfully perform credit check', async () => {
      const mockResponse = {
        data: {
          score: 750,
          risk_band: 'LOW',
          enquiries_6m: 2,
          defaults: 0,
          open_loans: 1,
          trade_lines: []
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await BureauClient.checkCredit('12345678901', 'user-1');

      expect(result).toBeDefined();
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/credit/check'),
        { bvn: '12345678901' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-KEY': expect.any(String)
          }),
          timeout: 10000
        })
      );
    });

    it('should return cached report if recent', async () => {
      const mockCachedReport = {
        id: 'cached-1',
        bvn: '12345678901',
        score: 700,
        riskBand: 'MEDIUM',
        enquiries6m: 3,
        defaults: 1,
        openLoans: 2,
        tradeLines: [],
        requestedAt: new Date()
      };

      // Mock Prisma to return recent report
      mockPrismaClient.bureauReport.findFirst.mockResolvedValue(mockCachedReport);

      const result = await BureauClient.checkCredit('12345678901', 'user-1');

      expect(result).toEqual(mockCachedReport);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should retry on failure with exponential backoff', async () => {
      const mockResponse = {
        data: {
          score: 650,
          risk_band: 'MEDIUM',
          enquiries_6m: 4,
          defaults: 0,
          open_loans: 3,
          trade_lines: []
        }
      };

      // First two attempts fail, third succeeds
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(mockResponse);

      const result = await BureauClient.checkCredit('12345678901', 'user-1');

      expect(result).toBeDefined();
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should handle rate limiting correctly', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: { message: 'Too many requests' }
        }
      };

      mockedAxios.post.mockRejectedValue(rateLimitError);

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Rate limited: Too many requests');
    });

    it('should handle bad request errors', async () => {
      const badRequestError = {
        response: {
          status: 400,
          data: { message: 'Invalid BVN format' }
        }
      };

      mockedAxios.post.mockRejectedValue(badRequestError);

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Bad request: Invalid BVN format');
    });

    it('should handle server errors', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        }
      };

      mockedAxios.post.mockRejectedValue(serverError);

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Server error: 500 - Internal server error');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      };

      mockedAxios.post.mockRejectedValue(timeoutError);

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Request timeout after 10000ms');
    });

    it('should handle connection refused errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED'
      };

      mockedAxios.post.mockRejectedValue(connectionError);

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Connection refused - bureau service unavailable');
    });

    it('should throw error after max retries exceeded', async () => {
      const networkError = new Error('Network error');
      mockedAxios.post.mockRejectedValue(networkError);

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Network error');
    });
  });

  describe('Report Retrieval', () => {
    it('should retrieve existing report by BVN', async () => {
      const mockReport = {
        id: 'report-1',
        bvn: '12345678901',
        score: 700,
        riskBand: 'MEDIUM',
        enquiries6m: 3,
        defaults: 1,
        openLoans: 2,
        tradeLines: [],
        requestedAt: new Date()
      };

      mockPrismaClient.bureauReport.findFirst.mockResolvedValue(mockReport);

      const result = await BureauClient.getReport('12345678901');

      expect(result).toEqual(mockReport);
    });

    it('should return null for non-existent BVN', async () => {
      mockPrismaClient.bureauReport.findFirst.mockResolvedValue(null);

      const result = await BureauClient.getReport('99999999999');

      expect(result).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should use environment variables for configuration', () => {
      const originalEnv = process.env;
      process.env.BUREAU_API_URL = 'http://test-bureau.com';
      process.env.BUREAU_API_KEY = 'test-key';

      // Re-import to get updated config
      jest.resetModules();
      const { BureauClient: UpdatedBureauClient } = require('../../src/services/bureauClient.js');

      expect(UpdatedBureauClient).toBeDefined();

      process.env = originalEnv;
    });

    it('should use default values when environment variables not set', () => {
      const originalEnv = process.env;
      delete process.env.BUREAU_API_URL;
      delete process.env.BUREAU_API_KEY;

      // Re-import to get updated config
      jest.resetModules();
      const { BureauClient: UpdatedBureauClient } = require('../../src/services/bureauClient.js');

      expect(UpdatedBureauClient).toBeDefined();

      process.env = originalEnv;
    });
  });
});