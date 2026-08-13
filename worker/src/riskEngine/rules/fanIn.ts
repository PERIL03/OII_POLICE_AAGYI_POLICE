/**
 * Fan-In Rule
 *
 * Fires when a wallet receives from more than N distinct sources
 * within a short time window — indicates fund aggregation/collection.
 *
 * Weight: 15
 */

import { RuleResult, WalletContext } from '../index';

const FANIN_THRESHOLD = 10;
const WINDOW_HOURS = 24;

export function fanIn(ctx: WalletContext): RuleResult {
  const now = Date.now();
  const windowMs = WINDOW_HOURS * 60 * 60 * 1000;

  const recentIncoming = ctx.recentTransactions.filter((tx) => {
    if (tx.direction !== 'in') return false;
    if (!tx.confirmedAt) return true;
    return now - tx.confirmedAt.getTime() < windowMs;
  });

  const uniqueSenders = new Set(
    recentIncoming.map((tx) => tx.counterpartyAddress.toLowerCase())
  );

  if (uniqueSenders.size < FANIN_THRESHOLD) {
    return { fired: false, weight: 0, evidence: {} };
  }

  return {
    fired: true,
    weight: 15,
    evidence: {
      uniqueSenders: uniqueSenders.size,
      threshold: FANIN_THRESHOLD,
      windowHours: WINDOW_HOURS,
      txCount: recentIncoming.length,
    },
  };
}
