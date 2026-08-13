import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import pino from 'pino';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { syncOfacSdn } from './agents/ofacSync';
import { syncCryptoScamDb } from './agents/scamDbSync';
import { startBtcIngestion } from './agents/btcIngestion';

// ─── Logger ──────────────────────────────────────────────────────────

const logger = pino({
  name: 'cryptotrace-worker',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// ─── Worker Boot ─────────────────────────────────────────────────────

async function boot() {
  logger.info('🔧 CryptoTrace Worker starting...');

  // Verify Postgres connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Postgres: connected');
  } catch (err) {
    logger.error({ err }, '❌ Postgres: connection failed');
  }

  // Verify Redis connection
  try {
    const pong = await redis.ping();
    logger.info(`✅ Redis: ${pong}`);
  } catch (err) {
    logger.error({ err }, '❌ Redis: connection failed');
  }

  // Run initial Sanctions/Scam Sync
  try {
    logger.info('Syncing Sanctions & Scam Datasets...');
    await syncOfacSdn(prisma);
    await syncCryptoScamDb(prisma);
    logger.info('✅ Sanctions & Scam Datasets synced');
  } catch (err) {
    logger.warn({ err }, 'Sanctions sync failed at boot (will retry on schedule)');
  }

  // Start BTC Mempool WebSocket Ingestion
  try {
    startBtcIngestion();
    logger.info('✅ BTC Mempool Ingestion started');
  } catch (err) {
    logger.warn({ err }, 'BTC Ingestion failed to start');
  }

  logger.info('🚀 CryptoTrace Worker is running');
  logger.info('   Listening for transactions & dataset refreshes...');
}

boot().catch((err) => {
  logger.fatal({ err }, 'Worker failed to boot');
  process.exit(1);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────

const shutdown = async () => {
  logger.info('Worker shutting down...');
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
