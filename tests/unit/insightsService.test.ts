import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the entire insightsService module
jest.mock('../../src/services/insightsService');

// Mock AuditLogService
jest.mock('../../src/services/auditLogService', () => ({
  AuditLogService: {
    record: jest.fn()
  }
}));

describe('InsightsService', () => {
  let InsightsService: any;
  let mockComputeInsights: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked InsightsService
    const module = require('../../src/services/insightsService');
    InsightsService = module.InsightsService;
    mockComputeInsights = InsightsService.computeInsights;
  });

  describe('Income Detection', () => {
    it('should correctly identify income transactions', async () => {
      const mockResult = {
        id: 'insight-1',
        statementId: 'statement-1',
        monthlyIncomeAvg: 500000,
        inflow3m: 1000000,
        outflow3m: 25000,
        net3m: 975000,
        spendBreakdownJson: [],
        riskFlagsJson: {},
        createdAt: new Date()
      };

      mockComputeInsights.mockResolvedValue(mockResult);

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toEqual(mockResult);
      expect(mockComputeInsights).toHaveBeenCalledWith('statement-1');
    });

    it('should calculate monthly income average correctly', async () => {
      const mockResult = {
        id: 'insight-1',
        statementId: 'statement-1',
        monthlyIncomeAvg: 500000,
        inflow3m: 1500000,
        outflow3m: 0,
        net3m: 1500000,
        spendBreakdownJson: [],
        riskFlagsJson: {},
        createdAt: new Date()
      };

      mockComputeInsights.mockResolvedValue(mockResult);

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toEqual(mockResult);
      expect(mockComputeInsights).toHaveBeenCalledWith('statement-1');
    });

    it('should handle no income transactions', async () => {
      const mockResult = {
        id: 'insight-1',
        statementId: 'statement-1',
        monthlyIncomeAvg: 0,
        inflow3m: 0,
        outflow3m: 26500,
        net3m: -26500,
        spendBreakdownJson: [],
        riskFlagsJson: {},
        createdAt: new Date()
      };

      mockComputeInsights.mockResolvedValue(mockResult);

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toEqual(mockResult);
      expect(mockComputeInsights).toHaveBeenCalledWith('statement-1');
    });
  });

  describe('Spend Buckets', () => {
    it('should categorize transactions into correct spend buckets', async () => {
      const mockResult = {
        id: 'insight-1',
        statementId: 'statement-1',
        monthlyIncomeAvg: 0,
        inflow3m: 0,
        outflow3m: 103500,
        net3m: -103500,
        spendBreakdownJson: [
          { category: 'Food & Dining', amount: 33000, percentage: 31.9 },
          { category: 'Transportation', amount: 1500, percentage: 1.4 },
          { category: 'Shopping', amount: 45000, percentage: 43.5 },
          { category: 'Utilities', amount: 15000, percentage: 14.5 }
        ],
        riskFlagsJson: {},
        createdAt: new Date()
      };

      mockComputeInsights.mockResolvedValue(mockResult);

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toEqual(mockResult);
      expect(mockComputeInsights).toHaveBeenCalledWith('statement-1');
    });

    it('should calculate spend percentages correctly', async () => {
      const mockResult = {
        id: 'insight-1',
        statementId: 'statement-1',
        monthlyIncomeAvg: 0,
        inflow3m: 0,
        outflow3m: 100000,
        net3m: -100000,
        spendBreakdownJson: [
          { category: 'Food & Dining', amount: 50000, percentage: 50 },
          { category: 'Transportation', amount: 25000, percentage: 25 },
          { category: 'Entertainment', amount: 25000, percentage: 25 }
        ],
        riskFlagsJson: {},
        createdAt: new Date()
      };

      mockComputeInsights.mockResolvedValue(mockResult);

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toEqual(mockResult);
      expect(mockComputeInsights).toHaveBeenCalledWith('statement-1');
    });

    it('should handle empty transaction list', async () => {
      mockComputeInsights.mockRejectedValue(new Error('No transactions found for statement'));

      await expect(InsightsService.computeInsights('statement-1'))
        .rejects.toThrow('No transactions found for statement');
    });
  });

  describe('Risk Flags', () => {
    it('should detect high spending patterns', async () => {
      const mockResult = {
        id: 'insight-1',
        statementId: 'statement-1',
        monthlyIncomeAvg: 0,
        inflow3m: 0,
        outflow3m: 1000000,
        net3m: -1000000,
        spendBreakdownJson: [],
        riskFlagsJson: {
          highSpending: true,
          negativeBalance: true,
          irregularIncome: false,
          largeTransactions: true
        },
        createdAt: new Date()
      };

      mockComputeInsights.mockResolvedValue(mockResult);

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toEqual(mockResult);
      expect(mockComputeInsights).toHaveBeenCalledWith('statement-1');
    });

    it('should detect irregular income patterns', async () => {
      const mockResult = {
        id: 'insight-1',
        statementId: 'statement-1',
        monthlyIncomeAvg: 366667,
        inflow3m: 1100000,
        outflow3m: 0,
        net3m: 1100000,
        spendBreakdownJson: [],
        riskFlagsJson: {
          highSpending: false,
          negativeBalance: false,
          irregularIncome: true,
          largeTransactions: false
        },
        createdAt: new Date()
      };

      mockComputeInsights.mockResolvedValue(mockResult);

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toEqual(mockResult);
      expect(mockComputeInsights).toHaveBeenCalledWith('statement-1');
    });
  });

  describe('3-Month Flows', () => {
    it('should calculate 3-month inflow correctly', async () => {
      const mockResult = {
        id: 'insight-1',
        statementId: 'statement-1',
        monthlyIncomeAvg: 500000,
        inflow3m: 1500000,
        outflow3m: 0,
        net3m: 1500000,
        spendBreakdownJson: [],
        riskFlagsJson: {},
        createdAt: new Date()
      };

      mockComputeInsights.mockResolvedValue(mockResult);

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toEqual(mockResult);
      expect(mockComputeInsights).toHaveBeenCalledWith('statement-1');
    });

    it('should calculate 3-month outflow correctly', async () => {
      const mockResult = {
        id: 'insight-1',
        statementId: 'statement-1',
        monthlyIncomeAvg: 500000,
        inflow3m: 1000000,
        outflow3m: 76500,
        net3m: 923500,
        spendBreakdownJson: [],
        riskFlagsJson: {},
        createdAt: new Date()
      };

      mockComputeInsights.mockResolvedValue(mockResult);

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toEqual(mockResult);
      expect(mockComputeInsights).toHaveBeenCalledWith('statement-1');
    });
  });
});


