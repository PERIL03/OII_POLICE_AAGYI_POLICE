import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import pino from 'pino';

const logger = pino({ name: 'auditlogs-routes' });

export const auditLogsRouter = Router();

auditLogsRouter.use(requireAuth as any);

/**
 * GET /api/audit-logs
 * Query system audit logs (ordered by createdAt DESC).
 */
auditLogsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, badgeId: true } },
      },
    });

    const total = await prisma.auditLog.count();

    res.json({ logs, total, page, limit });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch audit logs');
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});
