"use strict";
/**
 * CoinGecko API client — BTC/ETH price data.
 *
 * Cached in Redis, refreshed every ~5 minutes.
 * Used to populate `amountUsdAtTime` on Transaction records.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrices = getPrices;
exports.toUsd = toUsd;
const redis_1 = require("../redis");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'coingecko-client' });
const BASE_URL = 'https://api.coingecko.com/api/v3';
const CACHE_TTL_PRICE = 300; // 5 minutes
async function fetchWithRetry(url, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);
            if (response.status === 429) {
                const delay = 1000 * Math.pow(2, attempt);
                logger.warn({ attempt, delay }, 'CoinGecko rate limited, backing off');
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }
            return response;
        }
        catch (err) {
            if (attempt === retries)
                throw err;
            const delay = 1000 * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw new Error('CoinGecko fetch failed after retries');
}
async function cachedFetch(cacheKey, ttl, fetcher) {
    try {
        const cached = await redis_1.redis.get(cacheKey);
        if (cached)
            return JSON.parse(cached);
    }
    catch (_) { /* skip */ }
    const data = await fetcher();
    try {
        await redis_1.redis.setex(cacheKey, ttl, JSON.stringify(data));
    }
    catch (_) { /* skip */ }
    return data;
}
// ─── API Functions ───────────────────────────────────────────────────
/**
 * Get current BTC and ETH prices in USD and INR.
 */
async function getPrices() {
    return cachedFetch('coingecko:prices:btc-eth', CACHE_TTL_PRICE, async () => {
        const url = `${BASE_URL}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,inr`;
        logger.info('Fetching BTC/ETH prices from CoinGecko');
        const res = await fetchWithRetry(url);
        if (!res.ok) {
            throw new Error(`CoinGecko API error: ${res.status}`);
        }
        return res.json();
    });
}
/**
 * Convert a crypto amount to USD at current price.
 */
async function toUsd(chain, amount) {
    const prices = await getPrices();
    const rate = chain === 'BTC' ? prices.bitcoin.usd : prices.ethereum.usd;
    return amount * rate;
}
//# sourceMappingURL=coingecko.js.map