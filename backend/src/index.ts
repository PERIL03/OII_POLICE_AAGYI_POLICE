import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import pino from 'pino';

import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { walletRouter } from './routes/wallet';
import { casesRouter } from './routes/cases';
import { watchlistRouter } from './routes/watchlist';
import { alertsRouter } from './routes/alerts';
import { auditLogsRouter } from './routes/auditLogs';
import { reportsRouter } from './routes/reports';
import { requireAuth, requireRole, AuthenticatedRequest } from './middleware/auth';
import { prisma } from './lib/prisma';

// ─── Logger ──────────────────────────────────────────────────────────

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// ─── Express App ─────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

// Socket.IO server — will be used for real-time alerts in Phase 6
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Middleware ───────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ─── Routes ──────────────────────────────────────────────────────────

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/api/wallets', walletRouter);
app.use('/api/cases', casesRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/reports', reportsRouter);

// Protected test route — verifies auth middleware works
app.get('/api/protected', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ message: 'You are authenticated', user: req.user });
});

// Admin-only test route — verifies role guard
app.get('/api/admin-only', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  res.json({ message: 'You are an admin', user: req.user });
});

// ─── Socket.IO ───────────────────────────────────────────────────────

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

// ─── Start Server ────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '4000', 10);

httpServer.listen(PORT, () => {
  logger.info(`🚀 CryptoTrace API server listening on port ${PORT}`);
  logger.info(`   Health: http://localhost:${PORT}/health`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────

const shutdown = async () => {
  logger.info('Shutting down...');
  await prisma.$disconnect();
  httpServer.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, httpServer, io };
