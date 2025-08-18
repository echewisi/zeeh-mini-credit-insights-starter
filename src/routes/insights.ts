import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { InsightsService } from '../services/insightsService';

export const insightsRouter = Router();

const runInsightsSchema = z.object({
  statementId: z.string().min(1)
});

insightsRouter.post('/run', authenticateToken, requireRole('USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { statementId } = runInsightsSchema.parse(req.body);
    
    const insight = await InsightsService.computeInsights(statementId, req.user?.userId);
    
    res.json({
      message: 'Insights computed successfully',
      insight: {
        id: insight.id,
        statementId: insight.statementId,
        monthlyIncomeAvg: insight.monthlyIncomeAvg,
        inflow3m: insight.inflow3m,
        outflow3m: insight.outflow3m,
        net3m: insight.net3m,
        spendBreakdown: insight.spendBreakdownJson,
        riskFlags: insight.riskFlagsJson,
        createdAt: insight.createdAt
      }
    });
  } catch (error: unknown) {
    console.error('Insights computation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    
    if (error instanceof Error) {
      if (error.message === 'No transactions found for statement') {
        return res.status(404).json({ error: error.message });
      }
    }
    
    res.status(500).json({ error: 'Failed to compute insights' });
  }
});

insightsRouter.get('/:id', authenticateToken, requireRole('USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const insight = await InsightsService.getInsights(id);
    
    if (!insight) {
      return res.status(404).json({ error: 'Insights not found' });
    }
    
    res.json({
      insight: {
        id: insight.id,
        statementId: insight.statementId,
        monthlyIncomeAvg: insight.monthlyIncomeAvg,
        inflow3m: insight.inflow3m,
        outflow3m: insight.outflow3m,
        net3m: insight.net3m,
        spendBreakdown: insight.spendBreakdownJson,
        riskFlags: insight.riskFlagsJson,
        createdAt: insight.createdAt
      }
    });
  } catch (error: unknown) {
    console.error('Insights retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve insights' });
  }
});
