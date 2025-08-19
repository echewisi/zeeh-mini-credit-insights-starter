import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import pinoHttp from 'pino-http';
import pino from 'pino';

import { authRouter } from './routes/auth';
import { insightsRouter } from './routes/insights';
import { bureauRouter } from './routes/bureau';
import { statementsRouter } from './routes/statements';
import { auditRouter } from './routes/audit';
import { correlationMiddleware } from './utils/correlation';
import { mountSwagger } from './swagger';

export function createServer() {
  const app = express();
  
  // Security middleware
  app.use(helmet());
  
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Logging middleware
  app.use(morgan('dev'));
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  app.use(pinoHttp({ logger, customProps: (req) => ({ correlationId: (req as any).correlationId }) }));
  
  // Custom middleware
  app.use(correlationMiddleware);

  // Health and metrics endpoints
  app.get('/health', (_req, res) => res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }));
  
  app.get('/metrics', (_req, res) => {
    res.type('text/plain').send('up 1\nrequests_total 0');
  });

  app.use('/auth', authRouter);
  app.use('/statements', statementsRouter);
  app.use('/insights', insightsRouter);
  app.use('/bureau', bureauRouter);
  app.use('/audit', auditRouter);

  mountSwagger(app);

  app.use('*', (req, res) => {
    res.status(404).json({ 
      error: 'Route not found', 
      path: req.originalUrl,
      method: req.method 
    });
  });

  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  });

  return app;
}
