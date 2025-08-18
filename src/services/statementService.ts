import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse';
import { z } from 'zod';
import { AuditLogService } from './auditLogService.js';

const prisma = new PrismaClient();

type DbStatement = Awaited<ReturnType<typeof prisma.statement.create>>;
type DbTransaction = Awaited<ReturnType<typeof prisma.transaction.create>>;

const csvRowSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string().transform(val => parseFloat(val)),
  balance: z.string().optional().transform(val => val ? parseFloat(val) : null)
});

export class StatementService {
  static async uploadStatement(
    userId: string,
    csvBuffer: Buffer,
    sourceLabel?: string
  ): Promise<{ statement: DbStatement; transactions: DbTransaction[]; parseSuccessRate: number }> {
    return new Promise((resolve, reject) => {
      const transactions: Array<{
        date: Date;
        description: string;
        amount: number;
        balance: number | null;
        rawRowJson: Record<string, any>;
      }> = [];
      let validRows = 0;
      let totalRows = 0;
      let parseErrors = 0;

      parse(csvBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
        .on('data', (row) => {
          totalRows++;
          try {
            const parsedRow = csvRowSchema.parse(row);
            transactions.push({
              date: new Date(parsedRow.date),
              description: parsedRow.description,
              amount: parsedRow.amount,
              balance: parsedRow.balance,
              rawRowJson: row as Record<string, any>
            });
            validRows++;
          } catch (error) {
            parseErrors++;
            console.warn('Failed to parse CSV row:', row, error);
          }
        })
        .on('end', async () => {
          try {
            const parseSuccessRate = totalRows > 0 ? (validRows / totalRows) * 100 : 0;

            // Create statement
            const statement = await prisma.statement.create({
              data: {
                userId,
                sourceLabel,
                rowCount: totalRows,
                parseSuccessRate
              }
            });

            // Create transactions
            const createdTransactions = await Promise.all(
              transactions.map(tx => 
                prisma.transaction.create({
                  data: {
                    statementId: statement.id,
                    date: tx.date,
                    description: tx.description,
                    amount: tx.amount,
                    balance: tx.balance,
                    rawRowJson: tx.rawRowJson
                  }
                })
              )
            );

            // Audit log the statement upload
            await AuditLogService.record({
              actorUserId: userId,
              action: 'STATEMENT_UPLOADED',
              targetType: 'Statement',
              targetId: statement.id,
              meta: { 
                sourceLabel, 
                rowCount: totalRows, 
                parseSuccessRate,
                transactionCount: createdTransactions.length 
              }
            });

            resolve({
              statement,
              transactions: createdTransactions,
              parseSuccessRate
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  static async getStatement(statementId: string, userId: string): Promise<DbStatement | null> {
    const result = await prisma.statement.findFirst({
      where: { id: statementId, userId }
    });
    return result as unknown as DbStatement | null;
  }

  static async getTransactions(statementId: string): Promise<DbTransaction[]> {
    const results = await prisma.transaction.findMany({
      where: { statementId },
      orderBy: { date: 'asc' }
    });
    return results as unknown as DbTransaction[];
  }
}

