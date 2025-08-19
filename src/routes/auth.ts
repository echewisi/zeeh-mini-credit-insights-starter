import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pino from 'pino';
import { AuthService } from '../services/authService.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';

const logger = pino({ name: 'auth-routes' });

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['USER', 'ADMIN']).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// POST /auth/register - Register a new user (ADMIN only)
authRouter.post('/register', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { email, password, role } = registerSchema.parse(req.body);
    
    const user = await AuthService.register({ email, password, role: role || 'USER' });
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: unknown) {
    logger.error({
      msg: 'Registration error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      email: req.body.email
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /auth/login - Login user
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    const result = await AuthService.login({ email, password });
    
    res.json({
      message: 'Login successful',
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role
      }
    });
  } catch (error: unknown) {
    logger.error({
      msg: 'Login error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      email: req.body.email
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    
    if (error instanceof Error && error.message.includes('Invalid credentials')) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.status(500).json({ error: 'Failed to login' });
  }
});
