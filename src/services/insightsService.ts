import { PrismaClient } from '@prisma/client';
import { AuditLogService } from './auditLogService';

const prisma = new PrismaClient();

type DbTransaction = {
  date: Date;
  description: string;
  amount: number;
  balance: number | null;
};

type DbInsight = {
  id: string;
  statementId: string;
  monthlyIncomeAvg: number | null;
  inflow3m: number | null;
  outflow3m: number | null;
  net3m: number | null;
  spendBreakdownJson: unknown | null;
  riskFlagsJson: unknown | null;
  createdAt: Date;
};

interface SpendBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

interface RiskFlags {
  highSpending: boolean;
  negativeBalance: boolean;
  irregularIncome: boolean;
  largeTransactions: boolean;
}

export class InsightsService {
  static async computeInsights(statementId: string, userId?: string): Promise<DbInsight> {
    const transactions: DbTransaction[] = await prisma.transaction.findMany({
      where: { statementId },
      orderBy: { date: 'asc' }
    });

    if (transactions.length === 0) {
      throw new Error('No transactions found for statement');
    }

    // Calculate 3-month period
    const latestDate = new Date(Math.max(...transactions.map(t => t.date.getTime())));
    const threeMonthsAgo = new Date(latestDate);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentTransactions: DbTransaction[] = transactions.filter((t: DbTransaction) => t.date >= threeMonthsAgo);

    // Calculate monthly income average (3 months)
    const monthlyIncomeAvg = this.calculateMonthlyIncomeAverage(recentTransactions);

    // Calculate 3-month flows
    const inflow3m = recentTransactions
      .filter((t: DbTransaction) => t.amount > 0)
      .reduce((sum: number, t: DbTransaction) => sum + t.amount, 0);

    const outflow3m = recentTransactions
      .filter((t: DbTransaction) => t.amount < 0)
      .reduce((sum: number, t: DbTransaction) => sum + Math.abs(t.amount), 0);

    const net3m = inflow3m - outflow3m;

    // Calculate spend breakdown
    const spendBreakdown = this.calculateSpendBreakdown(recentTransactions);

    // Calculate risk flags
    const riskFlags = this.calculateRiskFlags(transactions);

    // Always create a new insight record (statementId is not unique)
    const insight = await prisma.insight.create({
      data: {
        statementId,
        monthlyIncomeAvg,
        inflow3m,
        outflow3m,
        net3m,
        spendBreakdownJson: spendBreakdown as Record<string, any>,
        riskFlagsJson: riskFlags as Record<string, any>
      }
    });

    // Audit log the insights computation
    await AuditLogService.record({
      actorUserId: userId || null,
      action: 'INSIGHTS_COMPUTED',
      targetType: 'Insight',
      targetId: insight.id,
      meta: { 
        statementId,
        monthlyIncomeAvg,
        inflow3m,
        outflow3m,
        net3m,
        transactionCount: transactions.length
      }
    });

    return insight as unknown as DbInsight;
  }

  private static calculateMonthlyIncomeAverage(transactions: DbTransaction[]): number {
    const incomeTransactions = transactions.filter((t: DbTransaction) => t.amount > 0);
    if (incomeTransactions.length === 0) return 0;

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const months = this.getMonthDifference(
      new Date(Math.min(...transactions.map(t => t.date.getTime()))),
      new Date(Math.max(...transactions.map(t => t.date.getTime())))
    );

    return months > 0 ? totalIncome / months : totalIncome;
  }

  private static calculateSpendBreakdown(transactions: DbTransaction[]): SpendBreakdown[] {
    const spendingTransactions = transactions.filter((t: DbTransaction) => t.amount < 0);
    const totalSpending = spendingTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    if (totalSpending === 0) return [];

    const categories = new Map<string, number>();

    spendingTransactions.forEach((t: DbTransaction) => {
      const category = this.categorizeTransaction(t.description);
      categories.set(category, (categories.get(category) || 0) + Math.abs(t.amount));
    });

    return Array.from(categories.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / totalSpending) * 100
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private static calculateRiskFlags(transactions: DbTransaction[]): RiskFlags {
    const amounts = transactions.map((t: DbTransaction) => Math.abs(t.amount));
    const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);

    return {
      highSpending: avgAmount > 100000, // 100k threshold
      negativeBalance: transactions.some((t: DbTransaction) => t.balance !== null && t.balance < 0),
      irregularIncome: this.hasIrregularIncome(transactions),
      largeTransactions: maxAmount > 500000 // 500k threshold
    };
  }

  private static categorizeTransaction(description: string): string {
    const desc = description.toLowerCase();
    
    if (desc.includes('salary') || desc.includes('payment') || desc.includes('credit')) {
      return 'Income';
    } else if (desc.includes('food') || desc.includes('restaurant') || desc.includes('grocery')) {
      return 'Food & Dining';
    } else if (desc.includes('transport') || desc.includes('uber') || desc.includes('taxi')) {
      return 'Transportation';
    } else if (desc.includes('shopping') || desc.includes('amazon') || desc.includes('store')) {
      return 'Shopping';
    } else if (desc.includes('utility') || desc.includes('electricity') || desc.includes('water')) {
      return 'Utilities';
    } else if (desc.includes('entertainment') || desc.includes('movie') || desc.includes('game')) {
      return 'Entertainment';
    } else {
      return 'Other';
    }
  }

  private static hasIrregularIncome(transactions: DbTransaction[]): boolean {
    const incomeTransactions = transactions
      .filter((t: DbTransaction) => t.amount > 0)
      .sort((a: DbTransaction, b: DbTransaction) => a.date.getTime() - b.date.getTime());

    if (incomeTransactions.length < 2) return false;

    const intervals = [];
    for (let i = 1; i < incomeTransactions.length; i++) {
      const interval = incomeTransactions[i].date.getTime() - incomeTransactions[i-1].date.getTime();
      intervals.push(interval / (1000 * 60 * 60 * 24)); // Convert to days
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > avgInterval * 0.5; // High variance indicates irregular income
  }

  private static getMonthDifference(startDate: Date, endDate: Date): number {
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
           (endDate.getMonth() - startDate.getMonth());
  }

  static async getInsights(insightId: string): Promise<DbInsight | null> {
    const result = await prisma.insight.findUnique({
      where: { id: insightId }
    });
    return result as unknown as DbInsight | null;
  }
}
