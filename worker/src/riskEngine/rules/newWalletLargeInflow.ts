/**
 * New Wallet Large Inflow Rule
 *
 * Fires when a recently created wallet receives a large inflow —
 * common pattern in fraud where fresh wallets are used as temporary
 * collection points.
 *
 * Weight: 20
 */

import { RuleResult, WalletContext } from '../index';

const NEW_WALLET_DAYS = 30;             // wallet age threshold
const LARGE_INFLOW_BTC = 1;             // 1 BTC
const LARGE_INFLOW_ETH = 10;            // 10 ETH

export function newWalletLargeInflow(ctx: WalletContext): RuleResult {
  if (!ctx.firstSeenAt) {
    return { fired: false, weight: 0, evidence: {} };
  }

  const walletAgeDays = (Date.now() - ctx.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24);

  if (walletAgeDays > NEW_WALLET_DAYS) {
    return { fired: false, weight: 0, evidence: {} };
  }

  const threshold = ctx.chain === 'BTC' ? LARGE_INFLOW_BTC : LARGE_INFLOW_ETH;

  // Check for large inflows
  const largeInflows = ctx.recentTransactions.filter(
    (tx) => tx.direction === 'in' && tx.amount >= threshold
  );

  if (largeInflows.length === 0) {
    return { fired: false, weight: 0, evidence: {} };
  }

  const totalInflow = largeInflows.reduce((sum, tx) => sum + tx.amount, 0);

  return {
    fired: true,
    weight: 20,
    evidence: {
      walletAgeDays: Math.round(walletAgeDays),
      ageThreshold: NEW_WALLET_DAYS,
      largeInflowCount: largeInflows.length,
      totalInflow,
      inflowThreshold: threshold,
      chain: ctx.chain,
    },
  };
}
