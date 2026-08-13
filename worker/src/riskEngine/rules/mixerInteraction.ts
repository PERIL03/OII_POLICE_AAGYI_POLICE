/**
 * Mixer Interaction Rule
 *
 * Fires when a wallet has labels indicating mixer/tumbler usage
 * or has transacted with known mixer addresses.
 *
 * Weight: 30
 */

import { RuleResult, WalletContext } from '../index';

const MIXER_KEYWORDS = ['mixer', 'tumbler', 'tornado', 'blender', 'coinjoin', 'wasabi'];

export function mixerInteraction(ctx: WalletContext): RuleResult {
  // Check labels for mixer indicators
  const mixerLabels = ctx.labels.filter((l) =>
    MIXER_KEYWORDS.some((keyword) =>
      l.category.toLowerCase().includes(keyword) ||
      (l.source === 'OFAC_SDN' && l.category === 'sanctioned')
    )
  );

  if (mixerLabels.length > 0) {
    return {
      fired: true,
      weight: 30,
      evidence: {
        reason: 'Wallet has mixer/tumbler labels',
        labels: mixerLabels.map((l) => ({ source: l.source, category: l.category })),
      },
    };
  }

  return { fired: false, weight: 0, evidence: {} };
}
