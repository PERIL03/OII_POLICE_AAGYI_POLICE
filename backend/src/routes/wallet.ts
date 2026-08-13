/**
 * Wallet Routes — address lookup, profile, and search.
 *
 * These endpoints fetch REAL data from Blockstream/Etherscan,
 * persist it to Postgres, and return enriched wallet profiles.
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { blockstream, etherscan, coingecko } from '../lib/chainClients';
import { getExchangeTag } from '../lib/exchangeTags';
import { computeBtcCluster } from '../lib/clustering/btcCluster';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { chainAddressSchema } from '@cryptotrace/shared';
import { Decimal } from '@prisma/client/runtime/library';
import pino from 'pino';

const logger = pino({ name: 'wallet-routes' });

export const walletRouter = Router();

// All wallet routes require authentication
walletRouter.use(requireAuth as any);

/**
 * GET /api/wallets/lookup?chain=BTC|ETH&address=...
 * Look up an address on-chain, persist wallet + transactions, return enriched profile.
 */
walletRouter.get('/lookup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = chainAddressSchema.safeParse({
      chain: req.query.chain,
      address: req.query.address,
    });

    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid address', details: parsed.error.flatten() });
      return;
    }

    const { chain, address } = parsed.data;

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ADDRESS_LOOKUP',
        entityType: 'Wallet',
        entityId: null,
        metadata: { chain, address },
      },
    });

    if (chain === 'BTC') {
      const result = await lookupBtcAddress(address);
      res.json(result);
    } else {
      const result = await lookupEthAddress(address);
      res.json(result);
    }
  } catch (err) {
    logger.error({ err }, 'Wallet lookup failed');
    res.status(500).json({ error: 'Lookup failed', message: (err as Error).message });
  }
});

/**
 * GET /api/wallets/:id
 * Get a stored wallet by its internal UUID.
 */
walletRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const walletId = req.params.id as string;
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        labels: true,
        riskHistory: { orderBy: { computedAt: 'desc' }, take: 10 },
        watchlistEntries: true,
        _count: {
          select: {
            outgoingTx: true,
            incomingTx: true,
            alerts: true,
          },
        },
      },
    });

    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' });
      return;
    }

    res.json({ wallet });
  } catch (err) {
    logger.error({ err }, 'Get wallet failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/wallets/:id/transactions
 * Get transactions for a stored wallet.
 */
walletRouter.get('/:id/transactions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);

    const wallet = await prisma.wallet.findUnique({ where: { id: req.params.id as string } });
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' });
      return;
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromWalletId: wallet.id },
          { toWalletId: wallet.id },
        ],
      },
      orderBy: { ingestedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        fromWallet: { select: { id: true, address: true, chain: true } },
        toWallet: { select: { id: true, address: true, chain: true } },
      },
    });

    const total = await prisma.transaction.count({
      where: {
        OR: [
          { fromWalletId: wallet.id },
          { toWalletId: wallet.id },
        ],
      },
    });

    res.json({ transactions, total, page, limit });
  } catch (err) {
    logger.error({ err }, 'Get wallet transactions failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Internal Helpers ────────────────────────────────────────────────

async function lookupBtcAddress(address: string) {
  // Fetch real data from Blockstream
  const [addrData, txs] = await Promise.all([
    blockstream.getAddress(address),
    blockstream.getAddressTransactions(address),
  ]);

  const balanceBtc = blockstream.computeBalanceBtc(addrData);

  // Get USD price
  let balanceUsd: number | null = null;
  try {
    balanceUsd = await coingecko.toUsd('BTC', balanceBtc);
  } catch (err) {
    logger.warn({ err }, 'Could not fetch BTC price');
  }

  // Upsert wallet
  const wallet = await prisma.wallet.upsert({
    where: { chain_address: { chain: 'BTC', address } },
    update: {
      balance: new Decimal(balanceBtc),
      lastSeenAt: new Date(),
    },
    create: {
      chain: 'BTC',
      address,
      balance: new Decimal(balanceBtc),
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  // Persist transactions (upsert to avoid duplicates)
  const persistedTxs = [];
  for (const tx of txs.slice(0, 25)) {
    // Determine primary from/to for simplified view
    const fromAddress = tx.vin[0]?.prevout?.scriptpubkey_address || null;
    const toAddress = tx.vout[0]?.scriptpubkey_address || null;

    // Amount: sum of outputs not going back to sender (simplified)
    const totalOutput = tx.vout.reduce((sum, o) => sum + o.value, 0) / 1e8;

    let fromWalletId: string | null = null;
    let toWalletId: string | null = null;

    if (fromAddress) {
      const fromWallet = await prisma.wallet.upsert({
        where: { chain_address: { chain: 'BTC', address: fromAddress } },
        update: { lastSeenAt: new Date() },
        create: { chain: 'BTC', address: fromAddress, lastSeenAt: new Date() },
      });
      fromWalletId = fromWallet.id;
    }

    if (toAddress && toAddress !== fromAddress) {
      const toWallet = await prisma.wallet.upsert({
        where: { chain_address: { chain: 'BTC', address: toAddress } },
        update: { lastSeenAt: new Date() },
        create: { chain: 'BTC', address: toAddress, lastSeenAt: new Date() },
      });
      toWalletId = toWallet.id;
    }

    const persistedTx = await prisma.transaction.upsert({
      where: { chain_txHash: { chain: 'BTC', txHash: tx.txid } },
      update: {
        status: tx.status.confirmed ? 'CONFIRMED' : 'MEMPOOL',
        blockHeight: tx.status.block_height || null,
        confirmedAt: tx.status.block_time ? new Date(tx.status.block_time * 1000) : null,
      },
      create: {
        chain: 'BTC',
        txHash: tx.txid,
        fromWalletId,
        toWalletId,
        amount: new Decimal(totalOutput),
        amountUsdAtTime: balanceUsd !== null ? new Decimal(totalOutput * (balanceUsd / balanceBtc || 0)) : null,
        status: tx.status.confirmed ? 'CONFIRMED' : 'MEMPOOL',
        blockHeight: tx.status.block_height || null,
        confirmedAt: tx.status.block_time ? new Date(tx.status.block_time * 1000) : null,
        rawPayload: tx as any,
      },
    });

    persistedTxs.push(persistedTx);
  }

  // Check for known Exchange Tag
  const exchangeTag = getExchangeTag(address, 'BTC');

  // Compute BTC Common-Input-Ownership Cluster
  const btcCluster = await computeBtcCluster(address);

  // Fetch labels
  const labels = await prisma.label.findMany({ where: { walletId: wallet.id } });

  return {
    wallet: {
      ...wallet,
      balanceUsd,
      entityLabel: exchangeTag ? exchangeTag.entityName : wallet.entityLabel,
    },
    exchangeTag,
    btcCluster,
    transactions: persistedTxs,
    labels,
    chainStats: {
      txCount: addrData.chain_stats.tx_count,
      mempoolTxCount: addrData.mempool_stats.tx_count,
      fundedSum: addrData.chain_stats.funded_txo_sum / 1e8,
      spentSum: addrData.chain_stats.spent_txo_sum / 1e8,
    },
  };
}

async function lookupEthAddress(address: string) {
  // Fetch real data from Etherscan
  const [balanceWei, txs] = await Promise.all([
    etherscan.getBalance(address),
    etherscan.getTransactions(address),
  ]);

  const balanceEth = etherscan.weiToEth(balanceWei);

  // Get USD price
  let balanceUsd: number | null = null;
  try {
    balanceUsd = await coingecko.toUsd('ETH', balanceEth);
  } catch (err) {
    logger.warn({ err }, 'Could not fetch ETH price');
  }

  // Upsert wallet
  const wallet = await prisma.wallet.upsert({
    where: { chain_address: { chain: 'ETH', address: address.toLowerCase() } },
    update: {
      balance: new Decimal(balanceEth),
      lastSeenAt: new Date(),
    },
    create: {
      chain: 'ETH',
      address: address.toLowerCase(),
      balance: new Decimal(balanceEth),
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  // Persist transactions
  const persistedTxs = [];
  for (const tx of txs.slice(0, 25)) {
    const amountEth = etherscan.weiToEth(tx.value);

    // Upsert from/to wallets
    const fromWallet = await prisma.wallet.upsert({
      where: { chain_address: { chain: 'ETH', address: tx.from.toLowerCase() } },
      update: { lastSeenAt: new Date() },
      create: { chain: 'ETH', address: tx.from.toLowerCase(), lastSeenAt: new Date() },
    });

    let toWalletId: string | null = null;
    if (tx.to) {
      const toWallet = await prisma.wallet.upsert({
        where: { chain_address: { chain: 'ETH', address: tx.to.toLowerCase() } },
        update: { lastSeenAt: new Date() },
        create: { chain: 'ETH', address: tx.to.toLowerCase(), lastSeenAt: new Date() },
      });
      toWalletId = toWallet.id;
    }

    const persistedTx = await prisma.transaction.upsert({
      where: { chain_txHash: { chain: 'ETH', txHash: tx.hash } },
      update: {
        status: 'CONFIRMED',
        blockHeight: parseInt(tx.blockNumber, 10),
        confirmedAt: new Date(parseInt(tx.timeStamp, 10) * 1000),
      },
      create: {
        chain: 'ETH',
        txHash: tx.hash,
        fromWalletId: fromWallet.id,
        toWalletId,
        amount: new Decimal(amountEth),
        amountUsdAtTime: balanceUsd !== null ? new Decimal(amountEth * (balanceUsd / balanceEth || 0)) : null,
        status: 'CONFIRMED',
        blockHeight: parseInt(tx.blockNumber, 10),
        confirmedAt: new Date(parseInt(tx.timeStamp, 10) * 1000),
        rawPayload: tx as any,
      },
    });

    persistedTxs.push(persistedTx);
  }

  // Check for known Exchange Tag
  const exchangeTag = getExchangeTag(address, 'ETH');

  // Fetch ERC-20 Token Transfers
  let erc20Transfers: any[] = [];
  try {
    erc20Transfers = await etherscan.getERC20Transfers(address);
  } catch (err) {
    logger.warn({ address, err }, 'Could not fetch ERC-20 transfers');
  }

  // Fetch labels
  const labels = await prisma.label.findMany({ where: { walletId: wallet.id } });

  return {
    wallet: {
      ...wallet,
      balanceUsd,
      entityLabel: exchangeTag ? exchangeTag.entityName : wallet.entityLabel,
    },
    exchangeTag,
    erc20Transfers: erc20Transfers.slice(0, 20),
    transactions: persistedTxs,
    labels,
    chainStats: {
      txCount: txs.length,
      balanceWei,
    },
  };
}
