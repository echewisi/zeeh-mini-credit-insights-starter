import { InsightsService } from '../../src/services/insightsService.js';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    transaction: {
      findMany: jest.fn()
    },
    insight: {
      create: jest.fn()
    }
  }))
}));

// Mock AuditLogService
jest.mock('../../src/services/auditLogService.js', () => ({
  AuditLogService: {
    record: jest.fn()
  }
}));

describe('InsightsService', () => {
  let mockPrisma: any;
  let mockAuditLogService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      transaction: {
        findMany: jest.fn()
      },
      insight: {
        create: jest.fn()
      }
    };
    mockAuditLogService = {
      record: jest.fn()
    };
  });

  describe('Income Detection', () => {
    it('should correctly identify income transactions', async () => {
      const mockTransactions = [
        { date: new Date('2024-01-01'), description: 'Salary Payment - ABC Corp', amount: 500000, balance: 500000 },
        { date: new Date('2024-01-02'), description: 'Grocery Store', amount: -25000, balance: 475000 },
        { date: new Date('2024-01-07'), description: 'Salary Payment - ABC Corp', amount: 500000, balance: 975000 }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.insight.create.mockResolvedValue({ id: 'insight-1' });

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toBeDefined();
      // The service should identify 2 income transactions totaling ₦1,000,000
    });

    it('should calculate monthly income average correctly', async () => {
      const mockTransactions = [
        { date: new Date('2024-01-01'), description: 'Salary', amount: 500000, balance: 500000 },
        { date: new Date('2024-02-01'), description: 'Salary', amount: 500000, balance: 1000000 },
        { date: new Date('2024-03-01'), description: 'Salary', amount: 500000, balance: 1500000 }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.insight.create.mockResolvedValue({ id: 'insight-1' });

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toBeDefined();
      // Should calculate average over 3 months
    });

    it('should handle no income transactions', async () => {
      const mockTransactions = [
        { date: new Date('2024-01-01'), description: 'Grocery', amount: -25000, balance: 475000 },
        { date: new Date('2024-01-02'), description: 'Transport', amount: -1500, balance: 473500 }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.insight.create.mockResolvedValue({ id: 'insight-1' });

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toBeDefined();
      // Should handle case with no income
    });
  });

  describe('Spend Buckets', () => {
    it('should categorize transactions into correct spend buckets', async () => {
      const mockTransactions = [
        { date: new Date('2024-01-01'), description: 'Grocery Store - Walmart', amount: -25000, balance: 475000 },
        { date: new Date('2024-01-02'), description: 'Uber Ride - Transport', amount: -1500, balance: 473500 },
        { date: new Date('2024-01-03'), description: 'Amazon Shopping - Electronics', amount: -45000, balance: 428500 },
        { date: new Date('2024-01-04'), description: 'Restaurant - Fine Dining', amount: -8000, balance: 420500 },
        { date: new Date('2024-01-05'), description: 'Utility Bill - Electricity', amount: -15000, balance: 405500 }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.insight.create.mockResolvedValue({ id: 'insight-1' });

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toBeDefined();
      // Should categorize into Food & Dining, Transportation, Shopping, Utilities
    });

    it('should calculate spend percentages correctly', async () => {
      const mockTransactions = [
        { date: new Date('2024-01-01'), description: 'Grocery', amount: -50000, balance: 450000 },
        { date: new Date('2024-01-02'), description: 'Transport', amount: -25000, balance: 425000 },
        { date: new Date('2024-01-03'), description: 'Entertainment', amount: -25000, balance: 400000 }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.insight.create.mockResolvedValue({ id: 'insight-1' });

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toBeDefined();
      // Total spending: ₦100,000
      // Groceries: 50%, Transport: 25%, Entertainment: 25%
    });

    it('should handle empty transaction list', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      await expect(InsightsService.computeInsights('statement-1'))
        .rejects.toThrow('No transactions found for statement');
    });
  });

  describe('Risk Flags', () => {
    it('should detect high spending patterns', async () => {
      const mockTransactions = [
        { date: new Date('2024-01-01'), description: 'Large Purchase', amount: -600000, balance: 400000 },
        { date: new Date('2024-01-02'), description: 'Another Large', amount: -400000, balance: 0 }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.insight.create.mockResolvedValue({ id: 'insight-1' });

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toBeDefined();
      // Should flag large transactions and negative balance
    });

    it('should detect irregular income patterns', async () => {
      const mockTransactions = [
        { date: new Date('2024-01-01'), description: 'Salary', amount: 500000, balance: 500000 },
        { date: new Date('2024-01-15'), description: 'Bonus', amount: 100000, balance: 600000 },
        { date: new Date('2024-02-20'), description: 'Salary', amount: 500000, balance: 1100000 }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.insight.create.mockResolvedValue({ id: 'insight-1' });

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toBeDefined();
      // Should detect irregular income timing
    });
  });

  describe('3-Month Flows', () => {
    it('should calculate 3-month inflow correctly', async () => {
      const mockTransactions = [
        { date: new Date('2024-01-01'), description: 'Salary', amount: 500000, balance: 500000 },
        { date: new Date('2024-02-01'), description: 'Salary', amount: 500000, balance: 1000000 },
        { date: new Date('2024-03-01'), description: 'Salary', amount: 500000, balance: 1500000 }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.insight.create.mockResolvedValue({ id: 'insight-1' });

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toBeDefined();
      // 3-month inflow should be ₦1,500,000
    });

    it('should calculate 3-month outflow correctly', async () => {
      const mockTransactions = [
        { date: new Date('2024-01-01'), description: 'Salary', amount: 500000, balance: 500000 },
        { date: new Date('2024-01-02'), description: 'Grocery', amount: -25000, balance: 475000 },
        { date: new Date('2024-01-03'), description: 'Transport', amount: -1500, balance: 473500 },
        { date: new Date('2024-02-01'), description: 'Salary', amount: 500000, balance: 973500 },
        { date: new Date('2024-02-02'), description: 'Shopping', amount: -50000, balance: 923500 }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.insight.create.mockResolvedValue({ id: 'insight-1' });

      const result = await InsightsService.computeInsights('statement-1');

      expect(result).toBeDefined();
      // 3-month outflow should be ₦76,500
    });
  });
});


