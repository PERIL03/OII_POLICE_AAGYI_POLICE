/**
 * Risk Engine — central registry for all risk-scoring rules.
 */

import { blacklistMatch } from './rules/blacklistMatch';
import { fanOut } from './rules/fanOut';
import { fanIn } from './rules/fanIn';
import { structuring } from './rules/structuring';
import { dormantReactivation } from './rules/dormantReactivation';
import { mixerInteraction } from './rules/mixerInteraction';
import { newWalletLargeInflow } from './rules/newWalletLargeInflow';

export interface RuleResult {
  fired: boolean;
  weight: number;
  evidence: Record<string, unknown>;
}

export interface WalletContext {
  walletId: string;
  chain: 'BTC' | 'ETH';
  address: string;
  labels: Array<{ source: string; category: string }>;
  recentTransactions: Array<{
    txHash: string;
    amount: number;
    direction: 'in' | 'out';
    counterpartyAddress: string;
    confirmedAt: Date | null;
  }>;
  balance: number;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  totalTxCount: number;
  uniqueCounterparties: number;
}

export type RiskRule = (ctx: WalletContext) => RuleResult;

const rules: Map<string, RiskRule> = new Map();

export function registerRule(name: string, rule: RiskRule): void {
  rules.set(name, rule);
}

// Register built-in rules
registerRule('blacklistMatch', blacklistMatch);
registerRule('fanOut', fanOut);
registerRule('fanIn', fanIn);
registerRule('structuring', structuring);
registerRule('dormantReactivation', dormantReactivation);
registerRule('mixerInteraction', mixerInteraction);
registerRule('newWalletLargeInflow', newWalletLargeInflow);

/**
 * Evaluate all registered rules against a wallet context.
 * Returns an aggregate score (0–100) and the individual rule results.
 */
export function evaluateRisk(ctx: WalletContext): {
  score: number;
  reasons: Array<{ rule: string; weight: number; evidence: Record<string, unknown> }>;
} {
  const reasons: Array<{ rule: string; weight: number; evidence: Record<string, unknown> }> = [];

  for (const [name, rule] of rules) {
    const result = rule(ctx);
    if (result.fired) {
      reasons.push({ rule: name, weight: result.weight, evidence: result.evidence });
    }
  }

  // Sum weights, cap at 100
  const rawScore = reasons.reduce((sum, r) => sum + r.weight, 0);
  const score = Math.min(100, Math.max(0, rawScore));

  return { score, reasons };
}
