import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pino from 'pino';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { BureauClient } from '../services/bureauClient';

const logger = pino({ name: 'bureau-routes' });

export const bureauRouter = Router();

const checkCreditSchema = z.object({
  bvn: z.string().min(11).max(11)
});

bureauRouter.post('/check', authenticateToken, requireRole('USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bvn } = checkCreditSchema.parse(req.body);
    
    const report = await BureauClient.checkCredit(bvn, req.user?.userId);
    
    res.json({
      message: 'Credit check completed successfully',
      report: {
        id: report.id,
        bvn: report.bvn,
        score: report.score,
        riskBand: report.riskBand,
        enquiries6m: report.enquiries6m,
        defaults: report.defaults,
        openLoans: report.openLoans,
        tradeLines: report.tradeLines,
        requestedAt: report.requestedAt
      }
    });
  } catch (error: unknown) {
    logger.error({
      msg: 'Bureau check error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.userId,
      bvn: req.body.bvn
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    
    if (error instanceof Error) {
      if (error.message.includes('Bad request')) {
        return res.status(400).json({ error: error.message });
      } else if (error.message.includes('Rate limited')) {
        return res.status(429).json({ error: error.message });
      } else if (error.message.includes('Server error')) {
        return res.status(502).json({ error: error.message });
      } else if (error.message.includes('Connection refused')) {
        return res.status(503).json({ error: error.message });
      }
    }
    
    res.status(500).json({ error: 'Failed to perform credit check' });
  }
});

bureauRouter.get('/report/:bvn', authenticateToken, requireRole('USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bvn } = req.params;
    
    if (!bvn || bvn.length < 11 || bvn.length > 11) {
      return res.status(400).json({ error: 'Invalid BVN format' });
    }
    
    const report = await BureauClient.getReport(bvn);
    
    if (!report) {
      return res.status(404).json({ error: 'No credit report found for this BVN' });
    }
    
    res.json({
      report: {
        id: report.id,
        bvn: report.bvn,
        score: report.score,
        riskBand: report.riskBand,
        enquiries6m: report.enquiries6m,
        defaults: report.defaults,
        openLoans: report.openLoans,
        tradeLines: report.tradeLines,
        requestedAt: report.requestedAt
      }
    });
  } catch (error: unknown) {
    logger.error({
      msg: 'Report retrieval error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.userId,
      bvn: req.params.bvn
    });
    res.status(500).json({ error: 'Failed to retrieve credit report' });
  }
});
