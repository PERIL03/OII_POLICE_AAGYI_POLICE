"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'redis' });
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
/**
 * Redis client singleton — used for caching chain API responses,
 * BullMQ queue backend, and pub/sub for alert dispatch.
 */
exports.redis = new ioredis_1.default(REDIS_URL, {
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
exports.redis.on('connect', () => {
    logger.info('Redis: connected');
});
exports.redis.on('error', (err) => {
    logger.error({ err }, 'Redis: connection error');
});
// Connect eagerly but don't crash if Redis is down at boot
exports.redis.connect().catch((err) => {
    logger.warn({ err }, 'Redis: initial connection failed (will retry)');
});
//# sourceMappingURL=redis.js.map