"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const redis_1 = require("../lib/redis");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get('/', async (_req, res) => {
    const checks = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: `${process.uptime().toFixed(0)}s`,
    };
    // Check Postgres
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        checks.postgres = 'connected';
    }
    catch (err) {
        checks.postgres = 'disconnected';
    }
    // Check Redis
    try {
        const pong = await redis_1.redis.ping();
        checks.redis = pong === 'PONG' ? 'connected' : 'disconnected';
    }
    catch (err) {
        checks.redis = 'disconnected';
    }
    const isHealthy = checks.postgres === 'connected';
    res.status(isHealthy ? 200 : 503).json(checks);
});
//# sourceMappingURL=health.js.map