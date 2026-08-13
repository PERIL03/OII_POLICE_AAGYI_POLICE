/**
 * Fan-Out Rule
 *
 * Fires when a wallet sends to more than N distinct new addresses
 * within a short time window — classic layering/structuring pattern.
 *
 * Weight: 20
 */

import { RuleResult, WalletContext } from '../index';

const FANOUT_THRESHOLD = 10;       // distinct recipients
const WINDOW_HOURS = 24;           // within this time window

export function fanOut(ctx: WalletContext): RuleResult {
  const now = Date.now();
  const windowMs = WINDOW_HOURS * 60 * 60 * 1000;

  // Filter outgoing transactions within the window
  const recentOutgoing = ctx.recentTransactions.filter((tx) => {
    if (tx.direction !== 'out') return false;
    if (!tx.confirmedAt) return true; // mempool txs count
    return now - tx.confirmedAt.getTime() < windowMs;
  });

  // Count unique recipients
  const uniqueRecipients = new Set(
    recentOutgoing.map((tx) => tx.counterpartyAddress.toLowerCase())
  );

  if (uniqueRecipients.size < FANOUT_THRESHOLD) {
    return { fired: false, weight: 0, evidence: {} };
  }

  return {
    fired: true,
    weight: 20,
    evidence: {
      uniqueRecipients: uniqueRecipients.size,
      threshold: FANOUT_THRESHOLD,
      windowHours: WINDOW_HOURS,
      txCount: recentOutgoing.length,
    },
  };
}
