import { describe, it, expect } from 'vitest';
import { evaluateRisk, WalletContext } from './index';
import { blacklistMatch } from './rules/blacklistMatch';
import { fanOut } from './rules/fanOut';
import { fanIn } from './rules/fanIn';
import { structuring } from './rules/structuring';
import { dormantReactivation } from './rules/dormantReactivation';
import { mixerInteraction } from './rules/mixerInteraction';
import { newWalletLargeInflow } from './rules/newWalletLargeInflow';

const createBaseContext = (): WalletContext => ({
  walletId: 'test-wallet-id',
  chain: 'BTC',
  address: '1BaseAddress1111111111111111111111',
  labels: [],
  recentTransactions: [],
  balance: 1.0,
  firstSeenAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
  lastSeenAt: new Date(),
  totalTxCount: 10,
  uniqueCounterparties: 5,
});

describe('Risk Rule: Blacklist Match', () => {
  it('should fire when an OFAC_SDN label is present', () => {
    const ctx = createBaseContext();
    ctx.labels = [{ source: 'OFAC_SDN', category: 'sanctioned' }];
    const res = blacklistMatch(ctx);
    expect(res.fired).toBe(true);
    expect(res.weight).toBe(40);
  });

  it('should not fire when no high-risk label is present', () => {
    const ctx = createBaseContext();
    ctx.labels = [{ source: 'EXCHANGE_TAG', category: 'exchange' }];
    const res = blacklistMatch(ctx);
    expect(res.fired).toBe(false);
    expect(res.weight).toBe(0);
  });
});

describe('Risk Rule: Fan-Out', () => {
  it('should fire when sending to >10 distinct recipients in 24h', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.recentTransactions = Array.from({ length: 12 }, (_, i) => ({
      txHash: `tx-out-${i}`,
      amount: 0.1,
      direction: 'out',
      counterpartyAddress: `address-recipient-${i}`,
      confirmedAt: now,
    }));

    const res = fanOut(ctx);
    expect(res.fired).toBe(true);
    expect(res.weight).toBe(20);
  });

  it('should not fire when sending to 2 distinct recipients', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.recentTransactions = [
      { txHash: 'tx-1', amount: 0.1, direction: 'out', counterpartyAddress: 'addr-1', confirmedAt: now },
      { txHash: 'tx-2', amount: 0.1, direction: 'out', counterpartyAddress: 'addr-2', confirmedAt: now },
    ];

    const res = fanOut(ctx);
    expect(res.fired).toBe(false);
    expect(res.weight).toBe(0);
  });
});

describe('Risk Rule: Fan-In', () => {
  it('should fire when receiving from >10 distinct senders in 24h', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.recentTransactions = Array.from({ length: 11 }, (_, i) => ({
      txHash: `tx-in-${i}`,
      amount: 0.2,
      direction: 'in',
      counterpartyAddress: `address-sender-${i}`,
      confirmedAt: now,
    }));

    const res = fanIn(ctx);
    expect(res.fired).toBe(true);
    expect(res.weight).toBe(15);
  });

  it('should not fire when receiving from 3 distinct senders', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.recentTransactions = Array.from({ length: 3 }, (_, i) => ({
      txHash: `tx-in-${i}`,
      amount: 0.2,
      direction: 'in',
      counterpartyAddress: `address-sender-${i}`,
      confirmedAt: now,
    }));

    const res = fanIn(ctx);
    expect(res.fired).toBe(false);
  });
});

describe('Risk Rule: Structuring', () => {
  it('should fire when 5+ outgoing txs have similar amounts within 48h', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.recentTransactions = Array.from({ length: 5 }, (_, i) => ({
      txHash: `tx-str-${i}`,
      amount: 0.99 + i * 0.01, // 0.99, 1.00, 1.01, 1.02, 1.03 (within 10%)
      direction: 'out',
      counterpartyAddress: `addr-${i}`,
      confirmedAt: now,
    }));

    const res = structuring(ctx);
    expect(res.fired).toBe(true);
    expect(res.weight).toBe(25);
  });

  it('should not fire when amounts vary significantly', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.recentTransactions = [
      { txHash: 'tx-1', amount: 0.1, direction: 'out', counterpartyAddress: 'addr-1', confirmedAt: now },
      { txHash: 'tx-2', amount: 5.0, direction: 'out', counterpartyAddress: 'addr-2', confirmedAt: now },
      { txHash: 'tx-3', amount: 0.001, direction: 'out', counterpartyAddress: 'addr-3', confirmedAt: now },
    ];

    const res = structuring(ctx);
    expect(res.fired).toBe(false);
  });
});

describe('Risk Rule: Dormant Reactivation', () => {
  it('should fire when a wallet inactive for >180 days suddenly becomes active', () => {
    const ctx = createBaseContext();
    const now = new Date();
    const firstSeen = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000); // 200 days ago
    ctx.firstSeenAt = firstSeen;
    ctx.totalTxCount = 20;

    // Recent tx in last 7 days, but no tx between 7 and 180 days ago
    ctx.recentTransactions = [
      { txHash: 'recent-tx', amount: 1.0, direction: 'in', counterpartyAddress: 'addr-1', confirmedAt: now },
    ];

    const res = dormantReactivation(ctx);
    expect(res.fired).toBe(true);
    expect(res.weight).toBe(15);
  });

  it('should not fire when account is fresh (<180 days old)', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.firstSeenAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days old
    ctx.recentTransactions = [
      { txHash: 'recent-tx', amount: 1.0, direction: 'in', counterpartyAddress: 'addr-1', confirmedAt: now },
    ];

    const res = dormantReactivation(ctx);
    expect(res.fired).toBe(false);
  });
});

describe('Risk Rule: Mixer Interaction', () => {
  it('should fire when wallet has a mixer label', () => {
    const ctx = createBaseContext();
    ctx.labels = [{ source: 'INTERNAL_ANALYST', category: 'mixer' }];

    const res = mixerInteraction(ctx);
    expect(res.fired).toBe(true);
    expect(res.weight).toBe(30);
  });

  it('should not fire when wallet has no mixer labels', () => {
    const ctx = createBaseContext();
    ctx.labels = [{ source: 'EXCHANGE_TAG', category: 'exchange' }];

    const res = mixerInteraction(ctx);
    expect(res.fired).toBe(false);
  });
});

describe('Risk Rule: New Wallet Large Inflow', () => {
  it('should fire when wallet age <30 days receives >1 BTC', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.firstSeenAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days old
    ctx.chain = 'BTC';
    ctx.recentTransactions = [
      { txHash: 'large-inflow', amount: 2.5, direction: 'in', counterpartyAddress: 'addr-sender', confirmedAt: now },
    ];

    const res = newWalletLargeInflow(ctx);
    expect(res.fired).toBe(true);
    expect(res.weight).toBe(20);
  });

  it('should not fire when wallet age >30 days', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.firstSeenAt = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days old
    ctx.chain = 'BTC';
    ctx.recentTransactions = [
      { txHash: 'large-inflow', amount: 2.5, direction: 'in', counterpartyAddress: 'addr-sender', confirmedAt: now },
    ];

    const res = newWalletLargeInflow(ctx);
    expect(res.fired).toBe(false);
  });
});

describe('Risk Engine Integration', () => {
  it('should compute aggregate score and explainable reasons', () => {
    const ctx = createBaseContext();
    const now = new Date();
    ctx.labels = [{ source: 'OFAC_SDN', category: 'sanctioned' }];
    ctx.chain = 'BTC';
    ctx.firstSeenAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days old
    ctx.recentTransactions = [
      { txHash: 'tx-1', amount: 10.0, direction: 'in', counterpartyAddress: 'addr-1', confirmedAt: now },
    ];

    const result = evaluateRisk(ctx);
    expect(result.score).toBeGreaterThanOrEqual(60); // 40 (blacklist) + 30 (mixer) + 20 (new wallet large inflow) = 90
    expect(result.reasons.length).toBe(3);
    expect(result.reasons.map((r) => r.rule)).toContain('blacklistMatch');
    expect(result.reasons.map((r) => r.rule)).toContain('mixerInteraction');
    expect(result.reasons.map((r) => r.rule)).toContain('newWalletLargeInflow');
  });
});
