/**
 * Blacklist Match Rule
 *
 * Fires when a wallet has any Label from OFAC_SDN, CRYPTOSCAMDB, or
 * INTERNAL_ANALYST sources (sanctions, scam reports, analyst flags).
 *
 * Weight: 40 (high — direct sanctions/scam match is the strongest signal)
 */

import { RuleResult, WalletContext } from '../index';

const HIGH_RISK_SOURCES = ['OFAC_SDN', 'CRYPTOSCAMDB', 'INTERNAL_ANALYST'];
const HIGH_RISK_CATEGORIES = ['sanctioned', 'scam', 'ransomware', 'phishing', 'mixer'];

export function blacklistMatch(ctx: WalletContext): RuleResult {
  const matchingLabels = ctx.labels.filter(
    (l) =>
      HIGH_RISK_SOURCES.includes(l.source) ||
      HIGH_RISK_CATEGORIES.includes(l.category.toLowerCase())
  );

  if (matchingLabels.length === 0) {
    return { fired: false, weight: 0, evidence: {} };
  }

  // Weight scales with number of independent sources
  const uniqueSources = new Set(matchingLabels.map((l) => l.source));
  const weight = Math.min(40 + (uniqueSources.size - 1) * 10, 60);

  return {
    fired: true,
    weight,
    evidence: {
      matchCount: matchingLabels.length,
      sources: Array.from(uniqueSources),
      categories: matchingLabels.map((l) => l.category),
    },
  };
}
