import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

const prisma = new PrismaClient();

export interface TestUser {
  id: string;
  email: string;
  role: string;
  token: string;
}

export interface TestStatement {
  id: string;
  userId: string;
  transactions: Array<{
    date: Date;
    description: string;
    amount: number;
    balance: number | null;
  }>;
}

export class TestHelpers {
  /**
   * Create a test user and return user data with JWT token
   */
  static async createTestUser(email: string, role: 'USER' | 'ADMIN' = 'USER'): Promise<TestUser> {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'hashed-password', // In real tests, use bcrypt
        role
      }
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      token
    };
  }

  /**
   * Create a test statement with transactions
   */
  static async createTestStatement(userId: string, transactions: Array<{
    date: Date;
    description: string;
    amount: number;
    balance: number | null;
  }>): Promise<TestStatement> {
    const statement = await prisma.statement.create({
      data: {
        userId,
        sourceLabel: 'Test Statement',
        rowCount: transactions.length,
        parseSuccessRate: 100
      }
    });

    const createdTransactions = await Promise.all(
      transactions.map(tx =>
        prisma.transaction.create({
          data: {
            statementId: statement.id,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            balance: tx.balance,
            rawRowJson: {}
          }
        })
      )
    );

    return {
      id: statement.id,
      userId: statement.userId,
      transactions: createdTransactions
    };
  }

  /**
   * Clean up test data
   */
  static async cleanupTestData(): Promise<void> {
    try {
      await prisma.auditLog.deleteMany();
      await prisma.insight.deleteMany();
      await prisma.transaction.deleteMany();
      await prisma.statement.deleteMany();
      await prisma.bureauReport.deleteMany();
      await prisma.user.deleteMany();
    } catch (error) {
      // Tables might not exist yet, that's okay
      console.log('Tables not ready for cleanup, continuing...');
    }
  }

  /**
   * Generate sample CSV content for testing
   */
  static generateSampleCSV(transactions: Array<{
    date: string;
    description: string;
    amount: number;
    balance: number;
  }>): string {
    const headers = 'date,description,amount,balance\n';
    const rows = transactions.map(tx => 
      `${tx.date},${tx.description},${tx.amount},${tx.balance}`
    ).join('\n');
    
    return headers + rows;
  }

  /**
   * Generate sample transactions for testing
   */
  static generateSampleTransactions(count: number = 5): Array<{
    date: Date;
    description: string;
    amount: number;
    balance: number | null;
  }> {
    const transactions: Array<{
      date: Date;
      description: string;
      amount: number;
      balance: number | null;
    }> = [];
    let balance = 1000000; // Start with ₦1M

    for (let i = 0; i < count; i++) {
      const date = new Date(2024, 0, i + 1); // January 1, 2, 3...
      const isIncome = i % 3 === 0; // Every 3rd transaction is income
      const amount = isIncome ? 500000 : -Math.floor(Math.random() * 50000 + 1000);
      balance += amount;

      transactions.push({
        date,
        description: isIncome 
          ? `Salary Payment - Month ${i + 1}`
          : `Expense ${i + 1} - Category`,
        amount,
        balance: i === count - 1 ? balance : null // Only last transaction has balance
      });
    }

    return transactions;
  }

  /**
   * Mock Prisma client for unit tests
   */
  static createMockPrisma() {
    return {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn()
      },
      statement: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn()
      },
      transaction: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn()
      },
      insight: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn()
      },
      bureauReport: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn()
      },
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn()
      }
    };
  }

  /**
   * Wait for a specified number of milliseconds
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a random BVN for testing
   */
  static generateRandomBVN(): string {
    return Math.floor(10000000000 + Math.random() * 90000000000).toString();
  }
}


