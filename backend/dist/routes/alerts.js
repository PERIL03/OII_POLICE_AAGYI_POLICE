"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'alerts-routes' });
exports.alertsRouter = (0, express_1.Router)();
exports.alertsRouter.use(auth_1.requireAuth);
/**
 * GET /api/alerts
 * List live alerts feed (ordered by createdAt DESC).
 */
exports.alertsRouter.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const severity = req.query.severity;
        const where = {};
        if (severity) {
            where.severity = severity;
        }
        const alerts = await prisma_1.prisma.alert.findMany({
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
        const total = await prisma_1.prisma.alert.count({ where });
        res.json({ alerts, total, page, limit });
    }
    catch (err) {
        logger.error({ err }, 'Failed to list alerts');
        res.status(500).json({ error: 'Failed to list alerts' });
    }
});
/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert.
 */
exports.alertsRouter.post('/:id/acknowledge', async (req, res) => {
    try {
        const alertId = req.params.id;
        const alert = await prisma_1.prisma.alert.findUnique({ where: { id: alertId } });
        if (!alert) {
            res.status(404).json({ error: 'Alert not found' });
            return;
        }
        const updated = await prisma_1.prisma.alert.update({
            where: { id: alertId },
            data: {
                acknowledgedByUserId: req.user.id,
                acknowledgedAt: new Date(),
            },
            include: {
                acknowledgedBy: { select: { id: true, name: true, badgeId: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'ALERT_ACKNOWLEDGED',
                entityType: 'Alert',
                entityId: alertId,
                metadata: { severity: alert.severity, type: alert.type },
            },
        });
        res.json({ alert: updated });
    }
    catch (err) {
        logger.error({ err }, 'Failed to acknowledge alert');
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});
//# sourceMappingURL=alerts.js.map