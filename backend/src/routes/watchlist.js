"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchlistRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const shared_1 = require("@cryptotrace/shared");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'watchlist-routes' });
exports.watchlistRouter = (0, express_1.Router)();
exports.watchlistRouter.use(auth_1.requireAuth);
/**
 * GET /api/watchlist
 * List all watchlisted wallets.
 */
exports.watchlistRouter.get('/', async (req, res) => {
    try {
        const entries = await prisma_1.prisma.watchlistEntry.findMany({
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
    }
    catch (err) {
        logger.error({ err }, 'Failed to list watchlist');
        res.status(500).json({ error: 'Failed to list watchlist' });
    }
});
/**
 * POST /api/watchlist
 * Add an address to the watchlist.
 */
exports.watchlistRouter.post('/', async (req, res) => {
    try {
        const parsed = shared_1.addWatchlistEntrySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
            return;
        }
        const { chain, address, reason, caseId } = parsed.data;
        // Validate chain-specific address format
        const validAddr = shared_1.chainAddressSchema.safeParse({ chain, address });
        if (!validAddr.success) {
            res.status(400).json({ error: `Invalid ${chain} address format` });
            return;
        }
        // Ensure wallet exists or create it
        const wallet = await prisma_1.prisma.wallet.upsert({
            where: { chain_address: { chain, address } },
            update: { isWatchlisted: true },
            create: { chain, address, isWatchlisted: true },
        });
        const entry = await prisma_1.prisma.watchlistEntry.create({
            data: {
                walletId: wallet.id,
                addedByUserId: req.user.id,
                caseId: caseId || null,
                reason: reason || null,
            },
            include: {
                wallet: true,
                addedBy: { select: { id: true, name: true, badgeId: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'WATCHLIST_ADDED',
                entityType: 'Wallet',
                entityId: wallet.id,
                metadata: { chain, address, reason, caseId },
            },
        });
        res.status(201).json({ entry });
    }
    catch (err) {
        logger.error({ err }, 'Failed to add to watchlist');
        res.status(500).json({ error: 'Failed to add to watchlist' });
    }
});
/**
 * DELETE /api/watchlist/:id
 * Remove an entry from the watchlist.
 */
exports.watchlistRouter.delete('/:id', async (req, res) => {
    try {
        const entryId = req.params.id;
        const entry = await prisma_1.prisma.watchlistEntry.findUnique({ where: { id: entryId } });
        if (!entry) {
            res.status(404).json({ error: 'Watchlist entry not found' });
            return;
        }
        await prisma_1.prisma.watchlistEntry.delete({ where: { id: entryId } });
        // Check if wallet is on any other watchlist entry
        const remainingCount = await prisma_1.prisma.watchlistEntry.count({
            where: { walletId: entry.walletId },
        });
        if (remainingCount === 0) {
            await prisma_1.prisma.wallet.update({
                where: { id: entry.walletId },
                data: { isWatchlisted: false },
            });
        }
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'WATCHLIST_REMOVED',
                entityType: 'Wallet',
                entityId: entry.walletId,
                metadata: { entryId },
            },
        });
        res.json({ message: 'Watchlist entry removed' });
    }
    catch (err) {
        logger.error({ err }, 'Failed to remove watchlist entry');
        res.status(500).json({ error: 'Failed to remove watchlist entry' });
    }
});
//# sourceMappingURL=watchlist.js.map