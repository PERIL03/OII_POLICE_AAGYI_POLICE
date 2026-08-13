/**
 * Dormant Reactivation Rule
 *
 * Fires when a wallet that has been inactive for a long period
 * suddenly shows activity — suspicious because legitimate wallets
 * typically have continuous activity patterns.
 *
 * Weight: 15
 */

import { RuleResult, WalletContext } from '../index';

const DORMANCY_DAYS = 180; // 6 months of inactivity

export function dormantReactivation(ctx: WalletContext): RuleResult {
  if (!ctx.firstSeenAt || !ctx.lastSeenAt) {
    return { fired: false, weight: 0, evidence: {} };
  }

  // Need recent activity to count as "reactivation"
  const recentTxs = ctx.recentTransactions.filter((tx) => {
    if (!tx.confirmedAt) return true; // mempool = recent
    const ageMs = Date.now() - tx.confirmedAt.getTime();
    return ageMs < 7 * 24 * 60 * 60 * 1000; // within last 7 days
  });

  if (recentTxs.length === 0) {
    return { fired: false, weight: 0, evidence: {} };
  }

  // Check if the wallet was dormant before the recent activity
  // by looking for a gap between the oldest non-recent tx and the newest recent tx
  const olderTxs = ctx.recentTransactions.filter((tx) => {
    if (!tx.confirmedAt) return false;
    const ageMs = Date.now() - tx.confirmedAt.getTime();
    return ageMs >= 7 * 24 * 60 * 60 * 1000;
  });

  if (olderTxs.length === 0 && ctx.totalTxCount > recentTxs.length) {
    // Has historical txs outside our recent window — check firstSeen vs lastSeen gap
    const accountAgeDays = (Date.now() - ctx.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays > DORMANCY_DAYS) {
      return {
        fired: true,
        weight: 15,
        evidence: {
          dormancyDays: Math.round(accountAgeDays),
          threshold: DORMANCY_DAYS,
          recentTxCount: recentTxs.length,
          firstSeenAt: ctx.firstSeenAt.toISOString(),
        },
      };
    }
  }

  // Check gap between most recent older tx and newest recent tx
  if (olderTxs.length > 0) {
    const latestOlderTx = olderTxs.reduce((latest, tx) => {
      if (!tx.confirmedAt || !latest.confirmedAt) return latest;
      return tx.confirmedAt > latest.confirmedAt ? tx : latest;
    });

    if (latestOlderTx.confirmedAt) {
      const gapDays =
        (Date.now() - latestOlderTx.confirmedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (gapDays > DORMANCY_DAYS) {
        return {
          fired: true,
          weight: 15,
          evidence: {
            dormancyDays: Math.round(gapDays),
            threshold: DORMANCY_DAYS,
            recentTxCount: recentTxs.length,
            lastActivityBefore: latestOlderTx.confirmedAt.toISOString(),
          },
        };
      }
    }
  }

  return { fired: false, weight: 0, evidence: {} };
}
