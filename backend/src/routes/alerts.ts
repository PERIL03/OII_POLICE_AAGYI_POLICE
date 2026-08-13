import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { acknowledgeAlertSchema } from '@cryptotrace/shared';
import pino from 'pino';

const logger = pino({ name: 'alerts-routes' });

export const alertsRouter = Router();

alertsRouter.use(requireAuth as any);

/**
 * GET /api/alerts
 * List live alerts feed (ordered by createdAt DESC).
 */
alertsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const severity = req.query.severity as string | undefined;

    const where: any = {};
    if (severity) {
      where.severity = severity;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        wallet: { select: { id: true, chain: true, address: true, currentRiskScore: true, entityLabel: true } },
        transaction: { select: { id: true, txHash: true, amount: true, status: true } },
        acknowledgedBy: { select: { id: true, name: true, badgeId: true } },
      },
    });

    const total = await prisma.alert.count({ where });

    res.json({ alerts, total, page, limit });
  } catch (err) {
    logger.error({ err }, 'Failed to list alerts');
    res.status(500).json({ error: 'Failed to list alerts' });
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert.
 */
alertsRouter.post('/:id/acknowledge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const alertId = req.params.id as string;
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        acknowledgedByUserId: req.user!.id,
        acknowledgedAt: new Date(),
      },
      include: {
        acknowledgedBy: { select: { id: true, name: true, badgeId: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ALERT_ACKNOWLEDGED',
        entityType: 'Alert',
        entityId: alertId,
        metadata: { severity: alert.severity, type: alert.type },
      },
    });

    res.json({ alert: updated });
  } catch (err) {
    logger.error({ err }, 'Failed to acknowledge alert');
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});
