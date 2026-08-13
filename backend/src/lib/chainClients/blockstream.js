"use strict";
/**
 * Blockstream Esplora API client — BTC address/transaction data.
 *
 * All calls go through Redis cache first (AGENTS.md ground rule 4).
 * Base URL: https://blockstream.info/api
 *
 * Endpoints used:
 *   GET /address/:address           → address summary (balance, tx count)
 *   GET /address/:address/txs       → transaction history (paginated)
 *   GET /tx/:txid                   → single transaction details
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAddress = getAddress;
exports.getAddressTransactions = getAddressTransactions;
exports.getTransaction = getTransaction;
exports.getAddressUtxos = getAddressUtxos;
exports.computeBalanceBtc = computeBalanceBtc;
const redis_1 = require("../redis");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'blockstream-client' });
const BASE_URL = 'https://blockstream.info/api';
const CACHE_TTL_ADDRESS = 60; // 60 seconds for address data
const CACHE_TTL_TX = 300; // 5 minutes for confirmed tx data (immutable)
const CACHE_TTL_UTXO = 60; // 60 seconds for UTXO set
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
/**
 * Fetch with retry + rate-limit backoff.
 */
async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);
            // Rate limited — back off
            if (response.status === 429) {
                const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
                logger.warn({ url, attempt, delay }, 'Rate limited, backing off');
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }
            return response;
        }
        catch (err) {
            if (attempt === retries)
                throw err;
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            logger.warn({ url, attempt, delay, err }, 'Fetch failed, retrying');
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}
/**
 * Generic cache-through helper.
 */
async function cachedFetch(cacheKey, ttl, fetcher) {
    try {
        const cached = await redis_1.redis.get(cacheKey);
        if (cached) {
            logger.debug({ cacheKey }, 'Cache hit');
            return JSON.parse(cached);
        }
    }
    catch (err) {
        // Redis unavailable — skip cache, go direct
        logger.warn({ cacheKey, err }, 'Redis cache read failed, fetching directly');
    }
    const data = await fetcher();
    try {
        await redis_1.redis.setex(cacheKey, ttl, JSON.stringify(data));
    }
    catch (err) {
        logger.warn({ cacheKey, err }, 'Redis cache write failed');
    }
    return data;
}
// ─── API Functions ───────────────────────────────────────────────────
/**
 * Get address summary (balance, tx counts).
 */
async function getAddress(address) {
    return cachedFetch(`blockstream:address:${address}`, CACHE_TTL_ADDRESS, async () => {
        const url = `${BASE_URL}/address/${address}`;
        logger.info({ address }, 'Fetching BTC address from Blockstream');
        const res = await fetchWithRetry(url);
        if (!res.ok) {
            throw new Error(`Blockstream API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    });
}
/**
 * Get transaction history for an address.
 * Returns the 25 most recent confirmed transactions (Blockstream's default page size).
 * Pass `lastSeenTxid` for pagination.
 */
async function getAddressTransactions(address, lastSeenTxid) {
    const suffix = lastSeenTxid ? `/chain/${lastSeenTxid}` : '';
    return cachedFetch(`blockstream:addr-txs:${address}:${lastSeenTxid || 'first'}`, CACHE_TTL_ADDRESS, async () => {
        const url = `${BASE_URL}/address/${address}/txs${suffix}`;
        logger.info({ address, lastSeenTxid }, 'Fetching BTC address transactions');
        const res = await fetchWithRetry(url);
        if (!res.ok) {
            throw new Error(`Blockstream API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    });
}
/**
 * Get a single transaction by txid.
 */
async function getTransaction(txid) {
    return cachedFetch(`blockstream:tx:${txid}`, CACHE_TTL_TX, async () => {
        const url = `${BASE_URL}/tx/${txid}`;
        logger.info({ txid }, 'Fetching BTC transaction');
        const res = await fetchWithRetry(url);
        if (!res.ok) {
            throw new Error(`Blockstream API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    });
}
/**
 * Get UTXOs for an address.
 */
async function getAddressUtxos(address) {
    return cachedFetch(`blockstream:utxo:${address}`, CACHE_TTL_UTXO, async () => {
        const url = `${BASE_URL}/address/${address}/utxo`;
        logger.info({ address }, 'Fetching BTC UTXOs');
        const res = await fetchWithRetry(url);
        if (!res.ok) {
            throw new Error(`Blockstream API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    });
}
/**
 * Compute balance in BTC from satoshis using address stats.
 */
function computeBalanceBtc(addr) {
    const funded = addr.chain_stats.funded_txo_sum + addr.mempool_stats.funded_txo_sum;
    const spent = addr.chain_stats.spent_txo_sum + addr.mempool_stats.spent_txo_sum;
    return (funded - spent) / 1e8; // sats → BTC
}
//# sourceMappingURL=blockstream.js.map