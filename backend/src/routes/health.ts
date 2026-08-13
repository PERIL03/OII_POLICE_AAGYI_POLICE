import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: `${process.uptime().toFixed(0)}s`,
  };

  // Check Postgres
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'connected';
  } catch (err) {
    checks.postgres = 'disconnected';
  }

  // Check Redis
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'connected' : 'disconnected';
  } catch (err) {
    checks.redis = 'disconnected';
  }

  const isHealthy = checks.postgres === 'connected' && checks.redis === 'connected';

  res.status(isHealthy ? 200 : 503).json(checks);
});
