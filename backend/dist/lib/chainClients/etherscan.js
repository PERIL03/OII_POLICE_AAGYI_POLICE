"use strict";
/**
 * Etherscan API client — ETH address/transaction data.
 *
 * All calls go through Redis cache first (AGENTS.md ground rule 4).
 * Base URL: https://api.etherscan.io/api
 *
 * Requires ETHERSCAN_API_KEY environment variable (free tier).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalance = getBalance;
exports.getTransactions = getTransactions;
exports.getInternalTransactions = getInternalTransactions;
exports.getERC20Transfers = getERC20Transfers;
exports.weiToEth = weiToEth;
const redis_1 = require("../redis");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'etherscan-client' });
const BASE_URL = 'https://api.etherscan.io/v2/api';
const API_KEY = process.env.ETHERSCAN_API_KEY || '';
const CHAIN_ID = '1'; // Ethereum mainnet
const CACHE_TTL_ADDRESS = 60; // 60s for address balance
const CACHE_TTL_TX = 120; // 2 min for tx list
const CACHE_TTL_INTERNALTX = 120;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);
            if (response.status === 429) {
                const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
                logger.warn({ url: url.split('&apikey')[0], attempt, delay }, 'Rate limited, backing off');
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }
            return response;
        }
        catch (err) {
            if (attempt === retries)
                throw err;
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            logger.warn({ attempt, delay, err }, 'Fetch failed, retrying');
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw new Error(`Failed to fetch after ${retries} retries`);
}
async function cachedFetch(cacheKey, ttl, fetcher) {
    try {
        const cached = await redis_1.redis.get(cacheKey);
        if (cached) {
            logger.debug({ cacheKey }, 'Cache hit');
            return JSON.parse(cached);
        }
    }
    catch (err) {
        logger.warn({ cacheKey, err }, 'Redis cache read failed');
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
 * Get ETH balance for an address (in wei).
 */
async function getBalance(address) {
    return cachedFetch(`etherscan:balance:${address}`, CACHE_TTL_ADDRESS, async () => {
        const url = `${BASE_URL}?chainid=${CHAIN_ID}&module=account&action=balance&address=${address}&tag=latest&apikey=${API_KEY}`;
        logger.info({ address }, 'Fetching ETH balance from Etherscan');
        const res = await fetchWithRetry(url);
        const data = (await res.json());
        if (data.status !== '1' && data.message !== 'OK') {
            // Etherscan returns status '0' with message 'No transactions found' for valid but empty addresses
            if (data.message === 'No transactions found' || data.result === '0') {
                return '0';
            }
            throw new Error(`Etherscan API error: ${data.message} — ${JSON.stringify(data.result)}`);
        }
        return data.result;
    });
}
/**
 * Get normal (external) transactions for an address.
 */
async function getTransactions(address, startblock = 0, endblock = 99999999, page = 1, offset = 50) {
    return cachedFetch(`etherscan:txlist:${address}:${startblock}:${endblock}:${page}:${offset}`, CACHE_TTL_TX, async () => {
        const url = `${BASE_URL}?chainid=${CHAIN_ID}&module=account&action=txlist&address=${address}&startblock=${startblock}&endblock=${endblock}&page=${page}&offset=${offset}&sort=desc&apikey=${API_KEY}`;
        logger.info({ address, page, offset }, 'Fetching ETH transactions from Etherscan');
        const res = await fetchWithRetry(url);
        const data = (await res.json());
        if (data.status !== '1') {
            if (data.message === 'No transactions found')
                return [];
            throw new Error(`Etherscan API error: ${data.message}`);
        }
        return data.result;
    });
}
/**
 * Get internal transactions for an address.
 */
async function getInternalTransactions(address, startblock = 0, endblock = 99999999, page = 1, offset = 50) {
    return cachedFetch(`etherscan:txlistinternal:${address}:${startblock}:${endblock}:${page}`, CACHE_TTL_INTERNALTX, async () => {
        const url = `${BASE_URL}?chainid=${CHAIN_ID}&module=account&action=txlistinternal&address=${address}&startblock=${startblock}&endblock=${endblock}&page=${page}&offset=${offset}&sort=desc&apikey=${API_KEY}`;
        logger.info({ address }, 'Fetching ETH internal transactions');
        const res = await fetchWithRetry(url);
        const data = (await res.json());
        if (data.status !== '1') {
            if (data.message === 'No transactions found')
                return [];
            throw new Error(`Etherscan API error: ${data.message}`);
        }
        return data.result;
    });
}
/**
 * Get ERC-20 token transfers for an address.
 */
async function getERC20Transfers(address, page = 1, offset = 50) {
    return cachedFetch(`etherscan:tokentx:${address}:${page}`, CACHE_TTL_TX, async () => {
        const url = `${BASE_URL}?chainid=${CHAIN_ID}&module=account&action=tokentx&address=${address}&page=${page}&offset=${offset}&sort=desc&apikey=${API_KEY}`;
        logger.info({ address }, 'Fetching ERC-20 transfers');
        const res = await fetchWithRetry(url);
        const data = (await res.json());
        if (data.status !== '1') {
            if (data.message === 'No transactions found')
                return [];
            throw new Error(`Etherscan API error: ${data.message}`);
        }
        return data.result;
    });
}
/**
 * Convert wei string to ETH number.
 */
function weiToEth(wei) {
    return parseInt(wei, 10) / 1e18;
}
//# sourceMappingURL=etherscan.js.map