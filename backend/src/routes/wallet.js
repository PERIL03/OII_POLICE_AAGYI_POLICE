"use strict";
/**
 * Wallet Routes — address lookup, profile, and search.
 *
 * These endpoints fetch REAL data from Blockstream/Etherscan,
 * persist it to Postgres, and return enriched wallet profiles.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const chainClients_1 = require("../lib/chainClients");
const exchangeTags_1 = require("../lib/exchangeTags");
const btcCluster_1 = require("../lib/clustering/btcCluster");
const auth_1 = require("../middleware/auth");
const shared_1 = require("@cryptotrace/shared");
const library_1 = require("@prisma/client/runtime/library");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'wallet-routes' });
exports.walletRouter = (0, express_1.Router)();
// All wallet routes require authentication
exports.walletRouter.use(auth_1.requireAuth);
/**
 * GET /api/wallets/lookup?chain=BTC|ETH&address=...
 * Look up an address on-chain, persist wallet + transactions, return enriched profile.
 */
exports.walletRouter.get('/lookup', async (req, res) => {
    try {
        const parsed = shared_1.chainAddressSchema.safeParse({
            chain: req.query.chain,
            address: req.query.address,
        });
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid address', details: parsed.error.flatten() });
            return;
        }
        const { chain, address } = parsed.data;
        // Audit log
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'ADDRESS_LOOKUP',
                entityType: 'Wallet',
                entityId: null,
                metadata: { chain, address },
            },
        });
        if (chain === 'BTC') {
            const result = await lookupBtcAddress(address);
            res.json(result);
        }
        else {
            const result = await lookupEthAddress(address);
            res.json(result);
        }
    }
    catch (err) {
        logger.error({ err }, 'Wallet lookup failed');
        res.status(500).json({ error: 'Lookup failed', message: err.message });
    }
});
/**
 * GET /api/wallets/:id
 * Get a stored wallet by its internal UUID.
 */
exports.walletRouter.get('/:id', async (req, res) => {
    try {
        const walletId = req.params.id;
        const wallet = await prisma_1.prisma.wallet.findUnique({
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
    }
    catch (err) {
        logger.error({ err }, 'Get wallet failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * GET /api/wallets/:id/transactions
 * Get transactions for a stored wallet.
 */
exports.walletRouter.get('/:id/transactions', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 25, 100);
        const wallet = await prisma_1.prisma.wallet.findUnique({ where: { id: req.params.id } });
        if (!wallet) {
            res.status(404).json({ error: 'Wallet not found' });
            return;
        }
        const transactions = await prisma_1.prisma.transaction.findMany({
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
        const total = await prisma_1.prisma.transaction.count({
            where: {
                OR: [
                    { fromWalletId: wallet.id },
                    { toWalletId: wallet.id },
                ],
            },
        });
        res.json({ transactions, total, page, limit });
    }
    catch (err) {
        logger.error({ err }, 'Get wallet transactions failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ─── Internal Helpers ────────────────────────────────────────────────
async function lookupBtcAddress(address) {
    // Fetch real data from Blockstream
    const [addrData, txs] = await Promise.all([
        chainClients_1.blockstream.getAddress(address),
        chainClients_1.blockstream.getAddressTransactions(address),
    ]);
    const balanceBtc = chainClients_1.blockstream.computeBalanceBtc(addrData);
    // Get USD price
    let balanceUsd = null;
    try {
        balanceUsd = await chainClients_1.coingecko.toUsd('BTC', balanceBtc);
    }
    catch (err) {
        logger.warn({ err }, 'Could not fetch BTC price');
    }
    // Upsert wallet
    const wallet = await prisma_1.prisma.wallet.upsert({
        where: { chain_address: { chain: 'BTC', address } },
        update: {
            balance: new library_1.Decimal(balanceBtc),
            lastSeenAt: new Date(),
        },
        create: {
            chain: 'BTC',
            address,
            balance: new library_1.Decimal(balanceBtc),
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
        let fromWalletId = null;
        let toWalletId = null;
        if (fromAddress) {
            const fromWallet = await prisma_1.prisma.wallet.upsert({
                where: { chain_address: { chain: 'BTC', address: fromAddress } },
                update: { lastSeenAt: new Date() },
                create: { chain: 'BTC', address: fromAddress, lastSeenAt: new Date() },
            });
            fromWalletId = fromWallet.id;
        }
        if (toAddress && toAddress !== fromAddress) {
            const toWallet = await prisma_1.prisma.wallet.upsert({
                where: { chain_address: { chain: 'BTC', address: toAddress } },
                update: { lastSeenAt: new Date() },
                create: { chain: 'BTC', address: toAddress, lastSeenAt: new Date() },
            });
            toWalletId = toWallet.id;
        }
        const persistedTx = await prisma_1.prisma.transaction.upsert({
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
                amount: new library_1.Decimal(totalOutput),
                amountUsdAtTime: balanceUsd !== null ? new library_1.Decimal(totalOutput * (balanceUsd / balanceBtc || 0)) : null,
                status: tx.status.confirmed ? 'CONFIRMED' : 'MEMPOOL',
                blockHeight: tx.status.block_height || null,
                confirmedAt: tx.status.block_time ? new Date(tx.status.block_time * 1000) : null,
                rawPayload: tx,
            },
        });
        persistedTxs.push(persistedTx);
    }
    // Check for known Exchange Tag
    const exchangeTag = (0, exchangeTags_1.getExchangeTag)(address, 'BTC');
    // Compute BTC Common-Input-Ownership Cluster
    const btcCluster = await (0, btcCluster_1.computeBtcCluster)(address);
    // Fetch labels
    const labels = await prisma_1.prisma.label.findMany({ where: { walletId: wallet.id } });
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
async function lookupEthAddress(address) {
    // Fetch real data from Etherscan
    const [balanceWei, txs] = await Promise.all([
        chainClients_1.etherscan.getBalance(address),
        chainClients_1.etherscan.getTransactions(address),
    ]);
    const balanceEth = chainClients_1.etherscan.weiToEth(balanceWei);
    // Get USD price
    let balanceUsd = null;
    try {
        balanceUsd = await chainClients_1.coingecko.toUsd('ETH', balanceEth);
    }
    catch (err) {
        logger.warn({ err }, 'Could not fetch ETH price');
    }
    // Upsert wallet
    const wallet = await prisma_1.prisma.wallet.upsert({
        where: { chain_address: { chain: 'ETH', address: address.toLowerCase() } },
        update: {
            balance: new library_1.Decimal(balanceEth),
            lastSeenAt: new Date(),
        },
        create: {
            chain: 'ETH',
            address: address.toLowerCase(),
            balance: new library_1.Decimal(balanceEth),
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
        },
    });
    // Persist transactions
    const persistedTxs = [];
    for (const tx of txs.slice(0, 25)) {
        const amountEth = chainClients_1.etherscan.weiToEth(tx.value);
        // Upsert from/to wallets
        const fromWallet = await prisma_1.prisma.wallet.upsert({
            where: { chain_address: { chain: 'ETH', address: tx.from.toLowerCase() } },
            update: { lastSeenAt: new Date() },
            create: { chain: 'ETH', address: tx.from.toLowerCase(), lastSeenAt: new Date() },
        });
        let toWalletId = null;
        if (tx.to) {
            const toWallet = await prisma_1.prisma.wallet.upsert({
                where: { chain_address: { chain: 'ETH', address: tx.to.toLowerCase() } },
                update: { lastSeenAt: new Date() },
                create: { chain: 'ETH', address: tx.to.toLowerCase(), lastSeenAt: new Date() },
            });
            toWalletId = toWallet.id;
        }
        const persistedTx = await prisma_1.prisma.transaction.upsert({
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
                amount: new library_1.Decimal(amountEth),
                amountUsdAtTime: balanceUsd !== null ? new library_1.Decimal(amountEth * (balanceUsd / balanceEth || 0)) : null,
                status: 'CONFIRMED',
                blockHeight: parseInt(tx.blockNumber, 10),
                confirmedAt: new Date(parseInt(tx.timeStamp, 10) * 1000),
                rawPayload: tx,
            },
        });
        persistedTxs.push(persistedTx);
    }
    // Check for known Exchange Tag
    const exchangeTag = (0, exchangeTags_1.getExchangeTag)(address, 'ETH');
    // Fetch ERC-20 Token Transfers
    let erc20Transfers = [];
    try {
        erc20Transfers = await chainClients_1.etherscan.getERC20Transfers(address);
    }
    catch (err) {
        logger.warn({ address, err }, 'Could not fetch ERC-20 transfers');
    }
    // Fetch labels
    const labels = await prisma_1.prisma.label.findMany({ where: { walletId: wallet.id } });
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
//# sourceMappingURL=wallet.js.map