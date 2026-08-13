import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { addWatchlistEntrySchema, chainAddressSchema } from '@cryptotrace/shared';
import pino from 'pino';

const logger = pino({ name: 'watchlist-routes' });

export const watchlistRouter = Router();

watchlistRouter.use(requireAuth as any);

/**
 * GET /api/watchlist
 * List all watchlisted wallets.
 */
watchlistRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const entries = await prisma.watchlistEntry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: {
          include: {
            labels: true,
          },
        },
        addedBy: { select: { id: true, name: true, badgeId: true } },
        case: { select: { id: true, title: true, firNumber: true } },
      },
    });

    res.json({ watchlist: entries });
  } catch (err) {
    logger.error({ err }, 'Failed to list watchlist');
    res.status(500).json({ error: 'Failed to list watchlist' });
  }
});

/**
 * POST /api/watchlist
 * Add an address to the watchlist.
 */
watchlistRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = addWatchlistEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { chain, address, reason, caseId } = parsed.data;

    // Validate chain-specific address format
    const validAddr = chainAddressSchema.safeParse({ chain, address });
    if (!validAddr.success) {
      res.status(400).json({ error: `Invalid ${chain} address format` });
      return;
    }

    // Ensure wallet exists or create it
    const wallet = await prisma.wallet.upsert({
      where: { chain_address: { chain, address } },
      update: { isWatchlisted: true },
      create: { chain, address, isWatchlisted: true },
    });

    const entry = await prisma.watchlistEntry.create({
      data: {
        walletId: wallet.id,
        addedByUserId: req.user!.id,
        caseId: caseId || null,
        reason: reason || null,
      },
      include: {
        wallet: true,
        addedBy: { select: { id: true, name: true, badgeId: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'WATCHLIST_ADDED',
        entityType: 'Wallet',
        entityId: wallet.id,
        metadata: { chain, address, reason, caseId },
      },
    });

    res.status(201).json({ entry });
  } catch (err) {
    logger.error({ err }, 'Failed to add to watchlist');
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

/**
 * DELETE /api/watchlist/:id
 * Remove an entry from the watchlist.
 */
watchlistRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const entryId = req.params.id as string;
    const entry = await prisma.watchlistEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      res.status(404).json({ error: 'Watchlist entry not found' });
      return;
    }

    await prisma.watchlistEntry.delete({ where: { id: entryId } });

    // Check if wallet is on any other watchlist entry
    const remainingCount = await prisma.watchlistEntry.count({
      where: { walletId: entry.walletId },
    });

    if (remainingCount === 0) {
      await prisma.wallet.update({
        where: { id: entry.walletId },
        data: { isWatchlisted: false },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'WATCHLIST_REMOVED',
        entityType: 'Wallet',
        entityId: entry.walletId,
        metadata: { entryId },
      },
    });

    res.json({ message: 'Watchlist entry removed' });
  } catch (err) {
    logger.error({ err }, 'Failed to remove watchlist entry');
    res.status(500).json({ error: 'Failed to remove watchlist entry' });
  }
});
