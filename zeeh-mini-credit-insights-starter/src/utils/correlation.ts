import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerId = (req.headers['x-correlation-id'] || req.headers['x-request-id']) as string | undefined;
  const correlationId = headerId && typeof headerId === 'string' && headerId.trim().length > 0
    ? headerId
    : randomUUID();

  (req as any).correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}

export function getCorrelationId(req: Request): string | undefined {
  return (req as any).correlationId as string | undefined;
}






