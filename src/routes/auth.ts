import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { requireRole } from '../middleware/auth';
import { authenticateToken } from '../middleware/auth';

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

authRouter.post('/register', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const user = await AuthService.register({
      ...data,
      role: data.role || 'USER'
    });
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    
    if (error instanceof Error) {
      if (error.message === 'User already exists') {
        return res.status(409).json({ error: error.message });
      }
    }
    
    res.status(500).json({ error: 'Failed to create user' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await AuthService.login(data);
    
    res.json({
      message: 'Login successful',
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role
      },
      token: result.token
    });
  } catch (error: unknown) {
    console.error('Login error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ error: error.message });
      }
    }
    
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});
