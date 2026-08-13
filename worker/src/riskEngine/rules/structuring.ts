/**
 * Structuring (Smurfing) Rule
 *
 * Fires when a wallet sends multiple transactions of similar amounts
 * in rapid succession — a classic money-laundering technique to
 * avoid detection thresholds.
 *
 * Weight: 25
 */

import { RuleResult, WalletContext } from '../index';

const MIN_TX_COUNT = 5;           // at least this many similar-amount txs
const SIMILARITY_THRESHOLD = 0.1; // amounts within 10% of each other
const WINDOW_HOURS = 48;

export function structuring(ctx: WalletContext): RuleResult {
  const now = Date.now();
  const windowMs = WINDOW_HOURS * 60 * 60 * 1000;

  const recentOutgoing = ctx.recentTransactions.filter((tx) => {
    if (tx.direction !== 'out') return false;
    if (tx.amount <= 0) return false;
    if (!tx.confirmedAt) return true;
    return now - tx.confirmedAt.getTime() < windowMs;
  });

  if (recentOutgoing.length < MIN_TX_COUNT) {
    return { fired: false, weight: 0, evidence: {} };
  }

  // Group transactions by similar amounts
  const amounts = recentOutgoing.map((tx) => tx.amount);
  let maxClusterSize = 0;
  let clusterAmount = 0;

  for (let i = 0; i < amounts.length; i++) {
    const baseAmount = amounts[i];
    const cluster = amounts.filter((a) => {
      const diff = Math.abs(a - baseAmount) / baseAmount;
      return diff <= SIMILARITY_THRESHOLD;
    });

    if (cluster.length > maxClusterSize) {
      maxClusterSize = cluster.length;
      clusterAmount = baseAmount;
    }
  }

  if (maxClusterSize < MIN_TX_COUNT) {
    return { fired: false, weight: 0, evidence: {} };
  }

  return {
    fired: true,
    weight: 25,
    evidence: {
      clusterSize: maxClusterSize,
      approximateAmount: clusterAmount,
      similarityThreshold: `${SIMILARITY_THRESHOLD * 100}%`,
      windowHours: WINDOW_HOURS,
      totalOutgoing: recentOutgoing.length,
    },
  };
}
