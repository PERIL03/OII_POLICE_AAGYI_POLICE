import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'redis' });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Redis client singleton — used for caching chain API responses,
 * BullMQ queue backend, and pub/sub for alert dispatch.
 */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 5) {
      logger.error('Redis: max retries reached, giving up');
      return null; // stop retrying
    }
    const delay = Math.min(times * 200, 2000);
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

// Connect eagerly but don't crash if Redis is down at boot
redis.connect().catch((err) => {
  logger.warn({ err }, 'Redis: initial connection failed (will retry)');
});
