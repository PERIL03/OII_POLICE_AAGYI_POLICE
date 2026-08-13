/**
 * CoinGecko API client — BTC/ETH price data.
 *
 * Cached in Redis, refreshed every ~5 minutes.
 * Used to populate `amountUsdAtTime` on Transaction records.
 */

import { redis } from '../redis';
import pino from 'pino';

const logger = pino({ name: 'coingecko-client' });

const BASE_URL = 'https://api.coingecko.com/api/v3';
const CACHE_TTL_PRICE = 300; // 5 minutes

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
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
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('CoinGecko fetch failed after retries');
}

async function cachedFetch<T>(cacheKey: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as T;
  } catch (_) { /* skip */ }

  const data = await fetcher();

  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(data));
  } catch (_) { /* skip */ }

  return data;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface CryptoPrice {
  bitcoin: { usd: number; inr: number };
  ethereum: { usd: number; inr: number };
}

// ─── API Functions ───────────────────────────────────────────────────

/**
 * Get current BTC and ETH prices in USD and INR.
 */
export async function getPrices(): Promise<CryptoPrice> {
  return cachedFetch(
    'coingecko:prices:btc-eth',
    CACHE_TTL_PRICE,
    async () => {
      const url = `${BASE_URL}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,inr`;
      logger.info('Fetching BTC/ETH prices from CoinGecko');
      const res = await fetchWithRetry(url);
      if (!res.ok) {
        throw new Error(`CoinGecko API error: ${res.status}`);
      }
      return res.json() as Promise<CryptoPrice>;
    }
  );
}

/**
 * Convert a crypto amount to USD at current price.
 */
export async function toUsd(chain: 'BTC' | 'ETH', amount: number): Promise<number> {
  const prices = await getPrices();
  const rate = chain === 'BTC' ? prices.bitcoin.usd : prices.ethereum.usd;
  return amount * rate;
}
