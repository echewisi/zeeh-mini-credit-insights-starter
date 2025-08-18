import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import pinoHttp from 'pino-http';
import pino from 'pino';

import { authRouter } from './routes/auth.js';
import { insightsRouter } from './routes/insights.js';
import { bureauRouter } from './routes/bureau.js';
import { statementsRouter } from './routes/statements.js';
import { auditRouter } from './routes/audit.js';
import { correlationMiddleware } from './utils/correlation.js';

export function createServer() {
  const app = express();
  app.use(helmet());
  app.use(express.json());
  app.use(morgan('dev'));
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  app.use(pinoHttp({ logger, customProps: (req) => ({ correlationId: (req as any).correlationId }) }));
  app.use(correlationMiddleware);

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/metrics', (_req, res) => {
    // Simple placeholder metrics; integrate prom-client for full metrics if needed
    res.type('text/plain').send('up 1\nrequests_total 0');
  });

  app.use('/auth', authRouter);
  app.use('/statements', statementsRouter);
  app.use('/insights', insightsRouter);
  app.use('/bureau', bureauRouter);
  app.use('/audit', auditRouter);

  return app;
}
