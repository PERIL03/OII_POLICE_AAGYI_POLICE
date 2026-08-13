'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { fetchApi } from '@/lib/api';

interface WalletLabel {
  id: string;
  source: string;
  category: string;
  description?: string;
  sourceUrl?: string;
}

interface WalletTx {
  id: string;
  txHash: string;
  chain: string;
  amount: number;
  status: string;
  confirmedAt?: string;
}

interface Erc20Transfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  timeStamp: string;
}

interface ExchangeTag {
  entityName: string;
  category: string;
  confidence: string;
}

interface BtcCluster {
  clusterAddresses: string[];
  totalClusterTxCount: number;
  confidence: string;
}

interface LookupData {
  wallet: {
    chain: 'BTC' | 'ETH';
    address: string;
    balance: number;
    balanceUsd: number | null;
    currentRiskScore: number;
    entityLabel?: string;
  };
  exchangeTag?: ExchangeTag;
  btcCluster?: BtcCluster;
  erc20Transfers?: Erc20Transfer[];
  chainStats?: {
    txCount?: number;
  };
  transactions?: WalletTx[];
  labels?: WalletLabel[];
}

function LookupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [chain, setChain] = useState<'BTC' | 'ETH'>(() => (searchParams.get('chain') as 'BTC' | 'ETH') || 'BTC');
  const [address, setAddress] = useState(() => searchParams.get('address') || '');
  const [data, setData] = useState<LookupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [watchReason, setWatchReason] = useState('');
  const [addingWatchlist, setAddingWatchlist] = useState(false);
  const [watchSuccess, setWatchSuccess] = useState(false);

  const performLookup = useCallback(async (c: 'BTC' | 'ETH', addr: string) => {
    if (!addr.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetchApi<LookupData>(`/api/wallets/lookup?chain=${c}&address=${encodeURIComponent(addr.trim())}`);
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch on-chain data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const qChain = searchParams.get('chain') as 'BTC' | 'ETH';
    const qAddr = searchParams.get('address');
    if (qChain && qAddr) {
      void (async () => {
        await performLookup(qChain, qAddr);
      })();
    }
  }, [searchParams, performLookup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    router.push(`/lookup?chain=${chain}&address=${encodeURIComponent(address.trim())}`);
  };

  const handleAddToWatchlist = async () => {
    if (!data?.wallet) return;
    setAddingWatchlist(true);
    try {
      await fetchApi('/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({
          chain: data.wallet.chain,
          address: data.wallet.address,
          reason: watchReason || 'Investigative target',
        }),
      });
      setWatchSuccess(true);
      setTimeout(() => setWatchSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add to watchlist';
      alert(msg);
    } finally {
      setAddingWatchlist(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 60) return 'text-rose-400 border-rose-800 bg-rose-950/60 glow-red';
    if (score >= 30) return 'text-amber-400 border-amber-800 bg-amber-950/60';
    return 'text-emerald-400 border-emerald-800 bg-emerald-950/60 glow-emerald';
  };

  const formatTokenAmount = (val: string, decimals: string) => {
    const dec = parseInt(decimals, 10) || 18;
    return (parseFloat(val) / Math.pow(10, dec)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Search Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h1 className="text-xl font-bold text-white mb-4">On-Chain Wallet Intelligence & Screening</h1>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value as 'BTC' | 'ETH')}
            className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-blue-500"
          >
            <option value="BTC">Bitcoin (BTC)</option>
            <option value="ETH">Ethereum (ETH)</option>
          </select>

          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Paste target address (BTC/ETH)..."
            className="flex-1 bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-4 py-2.5 text-sm placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            {loading ? 'Querying Chain...' : 'Run Intelligence Lookup'}
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-card rounded-xl p-6 border border-rose-800/80 bg-rose-950/30 text-rose-300">
          <h3 className="font-bold text-lg mb-1">Lookup Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-6">
          {/* Top Wallet Profile Card */}
          <div className="glass-panel rounded-2xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-slate-800 text-blue-400 border border-slate-700">
                  {data.wallet.chain}
                </span>

                {/* Exchange Attribution Tag */}
                {data.exchangeTag ? (
                  <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-indigo-950 text-indigo-300 border border-indigo-700/80 flex items-center gap-1">
                    <span>🏦</span> {data.exchangeTag.entityName} ({data.exchangeTag.confidence})
                  </span>
                ) : data.wallet.entityLabel ? (
                  <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-indigo-950 text-indigo-300 border border-indigo-700/80">
                    🏷️ {data.wallet.entityLabel}
                  </span>
                ) : null}

                <span className="text-xs text-slate-400">Live Chain Data Persisted</span>
              </div>

              <div className="text-xl sm:text-2xl font-mono font-bold text-white break-all select-all">
                {data.wallet.address}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-xs text-slate-400">Native Balance</div>
                  <div className="text-lg font-extrabold text-slate-100">
                    {data.wallet.balance} {data.wallet.chain}
                  </div>
                  {data.wallet.balanceUsd !== null && (
                    <div className="text-xs text-slate-400">≈ ${data.wallet.balanceUsd?.toLocaleString()} USD</div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-400">Total Transactions</div>
                  <div className="text-lg font-extrabold text-slate-100">
                    {data.chainStats?.txCount ?? data.transactions?.length ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Score Widget */}
            <div className="flex flex-col items-center justify-center p-6 glass-card rounded-xl text-center border border-slate-800">
              <div className="text-xs font-semibold uppercase text-slate-400 mb-2">Explainable Risk Score</div>
              <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-extrabold ${getScoreColor(data.wallet.currentRiskScore)}`}>
                {data.wallet.currentRiskScore}
              </div>
              <div className="text-xs text-slate-400 mt-2 font-mono">0 (Safe) → 100 (Critical)</div>
            </div>
          </div>

          {/* BTC Common-Input Ownership Cluster Section */}
          {data.btcCluster && data.btcCluster.clusterAddresses.length > 1 && (
            <div className="glass-card rounded-xl p-6 border border-cyan-900/60 bg-cyan-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-cyan-400 flex items-center gap-2">
                  <span>🧩</span> Common-Input Ownership Cluster ({data.btcCluster.clusterAddresses.length} co-spent addresses)
                </h3>
                <span className="text-xs font-mono text-cyan-300 bg-cyan-900/50 px-2 py-0.5 rounded border border-cyan-700">
                  Confidence: {data.btcCluster.confidence}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                These addresses have been co-spent in inputs of common transactions, proving common wallet control under the Bitcoin input-ownership heuristic.
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                {data.btcCluster.clusterAddresses.map((addr) => (
                  <Link
                    key={addr}
                    href={`/lookup?chain=BTC&address=${addr}`}
                    className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-blue-400 hover:text-blue-300 hover:border-blue-500"
                  >
                    {addr}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Labels & Sanctions Matches */}
          {data.labels && data.labels.length > 0 && (
            <div className="glass-card rounded-xl p-6 border border-rose-900/60 bg-rose-950/20">
              <h3 className="text-base font-bold text-rose-400 mb-3 flex items-center gap-2">
                <span>⚠️</span> Public Sanctions & Fraud Tags Matched ({data.labels.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.labels.map((label) => (
                  <div key={label.id} className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-rose-400 uppercase">{label.source}</span>
                      <span className="text-slate-400">{label.category}</span>
                    </div>
                    <p className="text-slate-300">{label.description}</p>
                    {label.sourceUrl && (
                      <a href={label.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline block pt-1">
                        View Citation Source ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                value={watchReason}
                onChange={(e) => setWatchReason(e.target.value)}
                placeholder="Reason for watching (e.g. Suspect in FIR 42)..."
                className="bg-slate-900 text-slate-200 border border-slate-700 rounded-md px-3 py-1.5 text-xs placeholder-slate-500 w-full sm:w-64 focus:outline-none"
              />
              <button
                onClick={handleAddToWatchlist}
                disabled={addingWatchlist}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-md whitespace-nowrap transition-all"
              >
                {watchSuccess ? '✓ Added to Watchlist' : 'Add to Watchlist'}
              </button>
            </div>

            <Link
              href={`/graph?chain=${data.wallet.chain}&address=${data.wallet.address}`}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-md whitespace-nowrap transition-all"
            >
              Explore Multi-Hop Flow Graph →
            </Link>
          </div>

          {/* ERC-20 Token Transfers Table (ETH only) */}
          {data.erc20Transfers && data.erc20Transfers.length > 0 && (
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🪙</span> ERC-20 Token Transfers (USDT / USDC / Tokens)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Tx Hash</th>
                      <th className="p-3">Token</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">From</th>
                      <th className="p-3">To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {data.erc20Transfers.map((tx) => (
                      <tr key={tx.hash} className="hover:bg-slate-900/40">
                        <td className="p-3 text-blue-400 truncate max-w-xs">{tx.hash}</td>
                        <td className="p-3 font-bold text-cyan-400">{tx.tokenSymbol || tx.tokenName}</td>
                        <td className="p-3 font-bold text-slate-100">
                          {formatTokenAmount(tx.value, tx.tokenDecimal)} {tx.tokenSymbol}
                        </td>
                        <td className="p-3 text-slate-400 truncate max-w-xs">{tx.from}</td>
                        <td className="p-3 text-slate-400 truncate max-w-xs">{tx.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Native Transactions Table */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">Recent Transactions ({data.transactions?.length ?? 0})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Tx Hash</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Confirmed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {data.transactions?.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-900/40">
                      <td className="p-3 text-blue-400 truncate max-w-xs">{tx.txHash}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${tx.status === 'CONFIRMED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-yellow-950 text-yellow-400 border border-yellow-800'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-100">{tx.amount} {tx.chain}</td>
                      <td className="p-3 text-slate-400">
                        {tx.confirmedAt ? new Date(tx.confirmedAt).toLocaleString() : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddressLookupPage() {
  return (
    <div className="min-h-screen bg-[#090d16]">
      <Navbar />
      <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading screening interface...</div>}>
        <LookupContent />
      </Suspense>
    </div>
  );
}
