import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auditRouter = Router();

const getAuditLogsSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  action: z.string().optional(),
  targetType: z.string().optional(),
  actorUserId: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

const getAuditLogByIdSchema = z.object({
  id: z.string().min(1)
});

// GET /audit/logs - Get paginated audit logs with filtering
auditRouter.get('/logs', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = getAuditLogsSchema.parse(req.query);
    
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100); 
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const where: any = {};
    
    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    
    if (query.targetType) {
      where.targetType = { contains: query.targetType, mode: 'insensitive' };
    }
    
    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }
    
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.auditLog.count({ where });
    
    // Get audit logs with pagination
    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    } as any);

    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      data: auditLogs.map((log: any) => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        actorUser: log.actorUser,
        meta: log.metaJson,
        createdAt: log.createdAt
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error: unknown) {
    console.error('Audit logs retrieval error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// GET /audit/logs/:id - Get specific audit log by ID
auditRouter.get('/logs/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = getAuditLogByIdSchema.parse(req.params);
    
    const auditLog = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    } as any);
    
    if (!auditLog) {
      return res.status(404).json({ error: 'Audit log not found' });
    }
    
    res.json({
      data: {
        id: auditLog.id,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        actorUser: (auditLog as any).actorUser,
        meta: auditLog.metaJson,
        createdAt: auditLog.createdAt
      }
    });
  } catch (error: unknown) {
    console.error('Audit log retrieval error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid audit log ID', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

// GET /audit/actions - Get list of unique actions for filtering
auditRouter.get('/actions', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' }
    });
    
    res.json({
      data: actions.map(item => item.action)
    });
  } catch (error: unknown) {
    console.error('Audit actions retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit actions' });
  }
});

// GET /audit/target-types - Get list of unique target types for filtering
auditRouter.get('/target-types', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetTypes = await prisma.auditLog.findMany({
      select: { targetType: true },
      distinct: ['targetType'],
      where: { targetType: { not: null } },
      orderBy: { targetType: 'asc' }
    });
    
    res.json({
      data: targetTypes.map(item => item.targetType).filter(Boolean)
    });
  } catch (error: unknown) {
    console.error('Audit target types retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit target types' });
  }
});

// GET /audit/summary - Get audit summary statistics
auditRouter.get('/summary', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    const [
      totalLogs,
      todayLogs,
      yesterdayLogs,
      last7DaysLogs,
      last30DaysLogs,
      actionCounts,
      targetTypeCounts
    ] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10
      }),
      prisma.auditLog.groupBy({
        by: ['targetType'],
        _count: { targetType: true },
        where: { targetType: { not: null } },
        orderBy: { _count: { targetType: 'desc' } },
        take: 10
      })
    ]);

    res.json({
      data: {
        totalLogs,
        todayLogs,
        yesterdayLogs,
        last7DaysLogs,
        last30DaysLogs,
        topActions: actionCounts.map(item => ({
          action: item.action,
          count: item._count.action
        })),
        topTargetTypes: targetTypeCounts.map(item => ({
          targetType: item.targetType,
          count: item._count.targetType
        }))
      }
    });
  } catch (error: unknown) {
    console.error('Audit summary retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit summary' });
  }
});
