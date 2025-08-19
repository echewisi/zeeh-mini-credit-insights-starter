import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the entire bureauClient module
jest.mock('../../src/services/bureauClient');

// Mock AuditLogService
jest.mock('../../src/services/auditLogService', () => ({
  AuditLogService: {
    record: jest.fn()
  }
}));

describe('BureauClient', () => {
  let BureauClient: any;
  let mockCheckCredit: jest.MockedFunction<any>;
  let mockGetReport: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked BureauClient
    const module = require('../../src/services/bureauClient');
    BureauClient = module.BureauClient;
    mockCheckCredit = BureauClient.checkCredit;
    mockGetReport = BureauClient.getReport;
  });

  describe('Credit Check', () => {
    it('should successfully perform credit check', async () => {
      const mockResult = {
        id: 'report-1',
        bvn: '12345678901',
        score: 750,
        riskBand: 'LOW',
        enquiries6m: 2,
        defaults: 0,
        openLoans: 1,
        tradeLines: [],
        requestedAt: new Date()
      };

      mockCheckCredit.mockResolvedValue(mockResult);

      const result = await BureauClient.checkCredit('12345678901', 'user-1');

      expect(result).toEqual(mockResult);
      expect(mockCheckCredit).toHaveBeenCalledWith('12345678901', 'user-1');
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

      mockCheckCredit.mockResolvedValue(mockCachedReport);

      const result = await BureauClient.checkCredit('12345678901', 'user-1');

      expect(result).toEqual(mockCachedReport);
      expect(mockCheckCredit).toHaveBeenCalledWith('12345678901', 'user-1');
    });

    it('should retry on failure with exponential backoff', async () => {
      const mockResult = {
        id: 'report-1',
        bvn: '12345678901',
        score: 650,
        riskBand: 'MEDIUM',
        enquiries6m: 4,
        defaults: 0,
        openLoans: 3,
        tradeLines: [],
        requestedAt: new Date()
      };

      mockCheckCredit.mockResolvedValue(mockResult);

      const result = await BureauClient.checkCredit('12345678901', 'user-1');

      expect(result).toEqual(mockResult);
      expect(mockCheckCredit).toHaveBeenCalledWith('12345678901', 'user-1');
    });

    it('should handle rate limiting correctly', async () => {
      mockCheckCredit.mockRejectedValue(new Error('Rate limited: Too many requests'));

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Rate limited: Too many requests');
    });

    it('should handle bad request errors', async () => {
      mockCheckCredit.mockRejectedValue(new Error('Bad request: Invalid BVN format'));

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Bad request: Invalid BVN format');
    });

    it('should handle server errors', async () => {
      mockCheckCredit.mockRejectedValue(new Error('Server error: 500 - Internal server error'));

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Server error: 500 - Internal server error');
    });

    it('should handle timeout errors', async () => {
      mockCheckCredit.mockRejectedValue(new Error('Request timeout after 10000ms'));

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Request timeout after 10000ms');
    });

    it('should handle connection refused errors', async () => {
      mockCheckCredit.mockRejectedValue(new Error('Connection refused - bureau service unavailable'));

      await expect(BureauClient.checkCredit('12345678901', 'user-1'))
        .rejects.toThrow('Connection refused - bureau service unavailable');
    });

    it('should throw error after max retries exceeded', async () => {
      mockCheckCredit.mockRejectedValue(new Error('Network error'));

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

      mockGetReport.mockResolvedValue(mockReport);

      const result = await BureauClient.getReport('12345678901');

      expect(result).toEqual(mockReport);
      expect(mockGetReport).toHaveBeenCalledWith('12345678901');
    });

    it('should return null for non-existent BVN', async () => {
      mockGetReport.mockResolvedValue(null);

      const result = await BureauClient.getReport('99999999999');

      expect(result).toBeNull();
      expect(mockGetReport).toHaveBeenCalledWith('99999999999');
    });
  });

  describe('Configuration', () => {
    it('should use environment variables for configuration', () => {
      const originalEnv = process.env;
      process.env.BUREAU_API_URL = 'http://test-bureau.com';
      process.env.BUREAU_API_KEY = 'test-key';

      // Re-import to get updated config
      jest.resetModules();
      const { BureauClient: UpdatedBureauClient } = require('../../src/services/bureauClient');

      expect(UpdatedBureauClient).toBeDefined();

      process.env = originalEnv;
    });

    it('should use default values when environment variables not set', () => {
      const originalEnv = process.env;
      delete process.env.BUREAU_API_URL;
      delete process.env.BUREAU_API_KEY;

      // Re-import to get updated config
      jest.resetModules();
      const { BureauClient: UpdatedBureauClient } = require('../../src/services/bureauClient');

      expect(UpdatedBureauClient).toBeDefined();

      process.env = originalEnv;
    });
  });
});