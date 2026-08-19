"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.httpServer = exports.app = exports.logger = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '../.env' });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const health_1 = require("./routes/health");
const auth_1 = require("./routes/auth");
const wallet_1 = require("./routes/wallet");
const cases_1 = require("./routes/cases");
const watchlist_1 = require("./routes/watchlist");
const alerts_1 = require("./routes/alerts");
const auditLogs_1 = require("./routes/auditLogs");
const reports_1 = require("./routes/reports");
const workerEmbed_1 = require("./lib/workerEmbed");
const auth_2 = require("./middleware/auth");
const prisma_1 = require("./lib/prisma");
const logger_1 = require("./lib/logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_1.logger; } });
// ─── Express App ─────────────────────────────────────────────────────
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// Socket.IO server — will be used for real-time alerts in Phase 6
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_ORIGIN?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
exports.io = io;
// ─── Middleware ───────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
}));
app.use(express_1.default.json());
// Global rate limiter
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// ─── Routes ──────────────────────────────────────────────────────────
app.use('/health', health_1.healthRouter);
app.use('/auth', auth_1.authRouter);
app.use('/api/wallets', wallet_1.walletRouter);
app.use('/api/cases', cases_1.casesRouter);
app.use('/api/watchlist', watchlist_1.watchlistRouter);
app.use('/api/alerts', alerts_1.alertsRouter);
app.use('/api/audit-logs', auditLogs_1.auditLogsRouter);
app.use('/api/reports', reports_1.reportsRouter);
// Protected test route — verifies auth middleware works
app.get('/api/protected', auth_2.requireAuth, (req, res) => {
    res.json({ message: 'You are authenticated', user: req.user });
});
// Admin-only test route — verifies role guard
app.get('/api/admin-only', auth_2.requireAuth, (0, auth_2.requireRole)('ADMIN'), (req, res) => {
    res.json({ message: 'You are an admin', user: req.user });
});
// ─── Socket.IO ───────────────────────────────────────────────────────
io.on('connection', (socket) => {
    logger_1.logger.info({ socketId: socket.id }, 'Client connected');
    socket.on('disconnect', () => {
        logger_1.logger.info({ socketId: socket.id }, 'Client disconnected');
    });
});
// ─── Start Server ────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10);
httpServer.listen(PORT, () => {
    logger_1.logger.info(`🚀 CryptoTrace API server listening on port ${PORT}`);
    logger_1.logger.info(`   Health: http://localhost:${PORT}/health`);
    (0, workerEmbed_1.initEmbeddedWorker)().catch((err) => logger_1.logger.error({ err }, 'Worker initialization error'));
});
// ─── Graceful Shutdown ───────────────────────────────────────────────
const shutdown = async () => {
    logger_1.logger.info('Shutting down...');
    await prisma_1.prisma.$disconnect();
    httpServer.close();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
//# sourceMappingURL=index.js.map