import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'worker-redis' });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Redis client singleton for the worker process.
 * Used for BullMQ job queue, caching, and pub/sub.
 */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis: max retries reached, giving up');
      return null;
    }
    const delay = Math.min(times * 200, 3000);
    logger.warn(`Redis: retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Redis: connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis: connection error');
});

redis.connect().catch((err) => {
  logger.warn({ err }, 'Redis: initial connection failed (will retry)');
});
