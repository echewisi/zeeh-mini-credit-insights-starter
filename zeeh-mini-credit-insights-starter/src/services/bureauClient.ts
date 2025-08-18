import axios, { AxiosResponse, AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuditLogService } from './auditLogService.js';

const prisma = new PrismaClient();

const bureauResponseSchema = z.object({
  score: z.number(),
  risk_band: z.string(),
  enquiries_6m: z.number(),
  defaults: z.number(),
  open_loans: z.number(),
  trade_lines: z.array(z.record(z.any()))
});

interface BureauResponse {
  score: number;
  risk_band: string;
  enquiries_6m: number;
  defaults: number;
  open_loans: number;
  trade_lines: Record<string, any>[];
}

export class BureauClient {
  private static readonly BASE_URL = process.env.BUREAU_API_URL || 'http://localhost:4000';
  private static readonly API_KEY = process.env.BUREAU_API_KEY || 'mock-key';
  private static readonly TIMEOUT = 10000; // 10 seconds
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

  static async checkCredit(bvn: string, userId?: string): Promise<DbBureauReport> {
    // Check if we have a recent report (within 24 hours)
    const existingReport = await this.getRecentReport(bvn);
    if (existingReport) {
      // Audit log the cached report access
      await AuditLogService.record({
        actorUserId: userId || null,
        action: 'BUREAU_REPORT_CACHED',
        targetType: 'BureauReport',
        targetId: existingReport.id,
        meta: { bvn, cached: true }
      });
      return existingReport;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.makeRequest(bvn);
        const validatedResponse = bureauResponseSchema.parse(response.data);
        
        // Save to database
        const report = await this.saveReport(bvn, validatedResponse);

        // Audit log the successful credit check
        await AuditLogService.record({
          actorUserId: userId || null,
          action: 'BUREAU_CREDIT_CHECK',
          targetType: 'BureauReport',
          targetId: report.id,
          meta: { 
            bvn, 
            score: report.score, 
            riskBand: report.riskBand,
            attempts: attempt + 1
          }
        });

        return report;

      } catch (error) {
        lastError = this.handleError(error as AxiosError, attempt);
        
        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAYS[attempt]);
        }
      }
    }

    // Audit log the failed credit check
    await AuditLogService.record({
      actorUserId: userId || null,
      action: 'BUREAU_CREDIT_CHECK_FAILED',
      targetType: 'BureauReport',
      targetId: null,
      meta: { 
        bvn, 
        error: lastError?.message,
        attempts: this.MAX_RETRIES + 1
      }
    });

    throw lastError || new Error('Max retries exceeded');
  }

  private static async makeRequest(bvn: string): Promise<AxiosResponse<BureauResponse>> {
    return axios.post(
      `${this.BASE_URL}/v1/credit/check`,
      { bvn },
      {
        headers: {
          'X-API-KEY': this.API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: this.TIMEOUT
      }
    );
  }

  private static handleError(error: AxiosError, attempt: number): Error {
    if (error.response) {
      const status = error.response.status;
      
      if (status === 400) {
        const msg = (error.response.data as any)?.message;
        return new Error(`Bad request: ${msg || 'Invalid BVN format'}`);
      } else if (status === 429) {
        const msg = (error.response.data as any)?.message;
        return new Error(`Rate limited: ${msg || 'Too many requests'}`);
      } else if (status >= 500) {
        const msg = (error.response.data as any)?.message;
        return new Error(`Server error: ${status} - ${msg || 'Internal server error'}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      return new Error(`Request timeout after ${this.TIMEOUT}ms`);
    } else if (error.code === 'ECONNREFUSED') {
      return new Error('Connection refused - bureau service unavailable');
    }

    return new Error(`Request failed: ${error.message}`);
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static async getRecentReport(bvn: string): Promise<DbBureauReport | null> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const res = await prisma.bureauReport.findFirst({
      where: {
        bvn,
        requestedAt: { gte: twentyFourHoursAgo }
      },
      orderBy: { requestedAt: 'desc' }
    });
    return res as unknown as DbBureauReport | null;
  }

  private static async saveReport(bvn: string, data: BureauResponse): Promise<DbBureauReport> {
    const res = await prisma.bureauReport.create({
      data: {
        bvn,
        score: data.score,
        riskBand: data.risk_band,
        enquiries6m: data.enquiries_6m,
        defaults: data.defaults,
        openLoans: data.open_loans,
        tradeLines: data.trade_lines
      }
    });
    return res as unknown as DbBureauReport;
  }

  static async getReport(bvn: string): Promise<DbBureauReport | null> {
    const res = await prisma.bureauReport.findFirst({
      where: { bvn },
      orderBy: { requestedAt: 'desc' }
    });
    return res as unknown as DbBureauReport | null;
  }
}

type DbBureauReport = Awaited<ReturnType<typeof prisma.bureauReport.create>>;

