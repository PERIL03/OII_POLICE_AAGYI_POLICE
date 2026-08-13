/**
 * Etherscan API client — ETH address/transaction data.
 *
 * All calls go through Redis cache first (AGENTS.md ground rule 4).
 * Base URL: https://api.etherscan.io/api
 *
 * Requires ETHERSCAN_API_KEY environment variable (free tier).
 */

import { redis } from '../redis';
import pino from 'pino';

const logger = pino({ name: 'etherscan-client' });

const BASE_URL = 'https://api.etherscan.io/api';
const API_KEY = process.env.ETHERSCAN_API_KEY || '';
const CACHE_TTL_ADDRESS = 60;   // 60s for address balance
const CACHE_TTL_TX = 120;       // 2 min for tx list
const CACHE_TTL_INTERNALTX = 120;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
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
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      logger.warn({ attempt, delay, err }, 'Fetch failed, retrying');
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`Failed to fetch after ${retries} retries`);
}

async function cachedFetch<T>(cacheKey: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Cache hit');
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    logger.warn({ cacheKey, err }, 'Redis cache read failed');
  }

  const data = await fetcher();

  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(data));
  } catch (err) {
    logger.warn({ cacheKey, err }, 'Redis cache write failed');
  }

  return data;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface EtherscanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
}

export interface EtherscanInternalTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  input: string;
  type: string;
  gas: string;
  gasUsed: string;
  traceId: string;
  isError: string;
  errCode: string;
}

export interface EtherscanERC20Transfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

interface EtherscanApiResponse<T> {
  status: string;
  message: string;
  result: T;
}

// ─── API Functions ───────────────────────────────────────────────────

/**
 * Get ETH balance for an address (in wei).
 */
export async function getBalance(address: string): Promise<string> {
  return cachedFetch(
    `etherscan:balance:${address}`,
    CACHE_TTL_ADDRESS,
    async () => {
      const url = `${BASE_URL}?module=account&action=balance&address=${address}&tag=latest&apikey=${API_KEY}`;
      logger.info({ address }, 'Fetching ETH balance from Etherscan');
      const res = await fetchWithRetry(url);
      const data = (await res.json()) as EtherscanApiResponse<string>;
      if (data.status !== '1' && data.message !== 'OK') {
        // Etherscan returns status '0' with message 'No transactions found' for valid but empty addresses
        if (data.message === 'No transactions found' || data.result === '0') {
          return '0';
        }
        throw new Error(`Etherscan API error: ${data.message} — ${JSON.stringify(data.result)}`);
      }
      return data.result;
    }
  );
}

/**
 * Get normal (external) transactions for an address.
 */
export async function getTransactions(
  address: string,
  startblock = 0,
  endblock = 99999999,
  page = 1,
  offset = 50
): Promise<EtherscanTx[]> {
  return cachedFetch(
    `etherscan:txlist:${address}:${startblock}:${endblock}:${page}:${offset}`,
    CACHE_TTL_TX,
    async () => {
      const url = `${BASE_URL}?module=account&action=txlist&address=${address}&startblock=${startblock}&endblock=${endblock}&page=${page}&offset=${offset}&sort=desc&apikey=${API_KEY}`;
      logger.info({ address, page, offset }, 'Fetching ETH transactions from Etherscan');
      const res = await fetchWithRetry(url);
      const data = (await res.json()) as EtherscanApiResponse<EtherscanTx[] | string>;
      if (data.status !== '1') {
        if (data.message === 'No transactions found') return [];
        throw new Error(`Etherscan API error: ${data.message}`);
      }
      return data.result as EtherscanTx[];
    }
  );
}

/**
 * Get internal transactions for an address.
 */
export async function getInternalTransactions(
  address: string,
  startblock = 0,
  endblock = 99999999,
  page = 1,
  offset = 50
): Promise<EtherscanInternalTx[]> {
  return cachedFetch(
    `etherscan:txlistinternal:${address}:${startblock}:${endblock}:${page}`,
    CACHE_TTL_INTERNALTX,
    async () => {
      const url = `${BASE_URL}?module=account&action=txlistinternal&address=${address}&startblock=${startblock}&endblock=${endblock}&page=${page}&offset=${offset}&sort=desc&apikey=${API_KEY}`;
      logger.info({ address }, 'Fetching ETH internal transactions');
      const res = await fetchWithRetry(url);
      const data = (await res.json()) as EtherscanApiResponse<EtherscanInternalTx[] | string>;
      if (data.status !== '1') {
        if (data.message === 'No transactions found') return [];
        throw new Error(`Etherscan API error: ${data.message}`);
      }
      return data.result as EtherscanInternalTx[];
    }
  );
}

/**
 * Get ERC-20 token transfers for an address.
 */
export async function getERC20Transfers(
  address: string,
  page = 1,
  offset = 50
): Promise<EtherscanERC20Transfer[]> {
  return cachedFetch(
    `etherscan:tokentx:${address}:${page}`,
    CACHE_TTL_TX,
    async () => {
      const url = `${BASE_URL}?module=account&action=tokentx&address=${address}&page=${page}&offset=${offset}&sort=desc&apikey=${API_KEY}`;
      logger.info({ address }, 'Fetching ERC-20 transfers');
      const res = await fetchWithRetry(url);
      const data = (await res.json()) as EtherscanApiResponse<EtherscanERC20Transfer[] | string>;
      if (data.status !== '1') {
        if (data.message === 'No transactions found') return [];
        throw new Error(`Etherscan API error: ${data.message}`);
      }
      return data.result as EtherscanERC20Transfer[];
    }
  );
}

/**
 * Convert wei string to ETH number.
 */
export function weiToEth(wei: string): number {
  return parseInt(wei, 10) / 1e18;
}
