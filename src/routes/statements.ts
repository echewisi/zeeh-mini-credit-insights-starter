import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { StatementService } from '../services/statementService';
import { upload } from '../utils/upload';


export const statementsRouter = Router();


const uploadSchema = z.object({
  sourceLabel: z.string().optional()
});

statementsRouter.post('/upload', 
  authenticateToken,
  requireRole('USER'),
  upload.single('csv'),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'CSV file is required' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { sourceLabel } = uploadSchema.parse(req.body);

      const result = await StatementService.uploadStatement(
        req.user.userId,
        req.file.buffer,
        sourceLabel
      );

      res.status(201).json({
        message: 'Statement uploaded successfully',
        statement: {
          id: result.statement.id,
          sourceLabel: result.statement.sourceLabel,
          uploadedAt: result.statement.uploadedAt,
          rowCount: result.statement.rowCount,
          parseSuccessRate: result.statement.parseSuccessRate
        },
        transactionCount: result.transactions.length
      });

    } catch (error) {
      console.error('Statement upload error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      
      res.status(500).json({ error: 'Failed to upload statement' });
    }
  }
);

statementsRouter.get('/:id', 
  authenticateToken,
  requireRole('USER'),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { id } = req.params;
      const statement = await StatementService.getStatement(id, req.user.userId);

      if (!statement) {
        return res.status(404).json({ error: 'Statement not found' });
      }

      const transactions = await StatementService.getTransactions(id);

      res.json({
        statement: {
          id: statement.id,
          sourceLabel: statement.sourceLabel,
          uploadedAt: statement.uploadedAt,
          rowCount: statement.rowCount,
          parseSuccessRate: statement.parseSuccessRate
        },
        transactions: transactions.map(tx => ({
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          balance: tx.balance
        }))
      });

    } catch (error) {
      console.error('Statement retrieval error:', error);
      res.status(500).json({ error: 'Failed to retrieve statement' });
    }
  }
);

