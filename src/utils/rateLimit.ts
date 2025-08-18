import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';

const limiter = new RateLimiterMemory({ points: 10, duration: 1 });

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    await limiter.consume(req.ip || 'global');
    next();
  } catch {
    res.status(429).json({ error: 'Too Many Requests' });
  }
}
