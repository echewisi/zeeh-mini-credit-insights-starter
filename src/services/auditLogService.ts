import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type AuditLogInput = {
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

export class AuditLogService {
  static async record(log: AuditLogInput) {
    await prisma.auditLog.create({
      data: {
        actorUserId: log.actorUserId ?? null,
        action: log.action,
        targetType: log.targetType ?? null,
        targetId: log.targetId ?? null,
        metaJson: log.meta ?? undefined
      }
    });
  }
}




