"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'auditlogs-routes' });
exports.auditLogsRouter = (0, express_1.Router)();
exports.auditLogsRouter.use(auth_1.requireAuth);
/**
 * GET /api/audit-logs
 * Query system audit logs (ordered by createdAt DESC).
 */
exports.auditLogsRouter.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const logs = await prisma_1.prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                user: { select: { id: true, name: true, email: true, role: true, badgeId: true } },
            },
        });
        const total = await prisma_1.prisma.auditLog.count();
        res.json({ logs, total, page, limit });
    }
    catch (err) {
        logger.error({ err }, 'Failed to fetch audit logs');
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});
//# sourceMappingURL=auditLogs.js.map