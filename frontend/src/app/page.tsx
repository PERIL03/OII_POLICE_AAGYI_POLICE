'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/Navbar';
import { fetchApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AlertItem {
  id: string;
  severity: string;
  type: string;
  message: string;
  wallet?: {
    address: string;
    chain: string;
  };
}

interface CaseItem {
  id: string;
  title: string;
  firNumber?: string;
  status: string;
  createdBy?: {
    name: string;
  };
  _count?: {
    evidence?: number;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [quickAddress, setQuickAddress] = useState('');
  const [quickChain, setQuickChain] = useState<'BTC' | 'ETH'>('BTC');

  // Fetch live alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchApi<{ alerts: AlertItem[]; total: number }>('/api/alerts?limit=10'),
    refetchInterval: 5000,
  });

  // Fetch active cases
  const { data: casesData } = useQuery({
    queryKey: ['cases'],
    queryFn: () => fetchApi<{ cases: CaseItem[] }>('/api/cases'),
  });

  // Fetch watchlists
  const { data: watchlistData } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => fetchApi<{ watchlist: unknown[] }>('/api/watchlist'),
  });

  const handleQuickLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddress.trim()) return;
    router.push(`/lookup?chain=${quickChain}&address=${encodeURIComponent(quickAddress.trim())}`);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-950/80 text-rose-400 border-rose-800/80 glow-red';
      case 'HIGH':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/80';
      case 'MEDIUM':
        return 'bg-yellow-950/80 text-yellow-400 border-yellow-800/80';
      default:
        return 'bg-blue-950/80 text-blue-400 border-blue-800/80';
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero & Quick Search */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-3xl space-y-4 relative z-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Police Cybercrime Financial Intelligence
            </h1>
            <p className="text-sm sm:text-base text-slate-300">
              Real-time blockchain transaction tracking, sanctions screening, automated risk scoring, and evidence case management for Chandigarh Police officers.
            </p>

            <form onSubmit={handleQuickLookup} className="flex flex-col sm:flex-row gap-3 pt-2">
              <select
                value={quickChain}
                onChange={(e) => setQuickChain(e.target.value as 'BTC' | 'ETH')}
                className="bg-slate-900/90 text-slate-200 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="BTC">Bitcoin (BTC)</option>
                <option value="ETH">Ethereum (ETH)</option>
              </select>

              <input
                type="text"
                value={quickAddress}
                onChange={(e) => setQuickAddress(e.target.value)}
                placeholder="Paste BTC address (e.g. 1DA5xr...) or ETH address (e.g. 0x098B...)"
                className="flex-1 bg-slate-900/90 text-slate-100 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />

              <button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-blue-600/20"
              >
                Analyze Wallet
              </button>
            </form>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-5 border border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Alerts</div>
            <div className="text-3xl font-extrabold text-rose-400 mt-2">{alertsData?.total ?? 0}</div>
            <div className="text-[11px] text-slate-500 mt-1">Real-time mempool & block signals</div>
          </div>

          <div className="glass-card rounded-xl p-5 border border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Watched Wallets</div>
            <div className="text-3xl font-extrabold text-blue-400 mt-2">{watchlistData?.watchlist?.length ?? 0}</div>
            <div className="text-[11px] text-slate-500 mt-1">Monitored high-priority entities</div>
          </div>

          <div className="glass-card rounded-xl p-5 border border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Open Cases</div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">{casesData?.cases?.length ?? 0}</div>
            <div className="text-[11px] text-slate-500 mt-1">Active FIR investigations</div>
          </div>

          <div className="glass-card rounded-xl p-5 border border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">System Freshness</div>
            <div className="text-3xl font-extrabold text-cyan-400 mt-2">LIVE</div>
            <div className="text-[11px] text-slate-500 mt-1">OFAC SDN & ScamDB auto-synced</div>
          </div>
        </div>

        {/* 2 Column Section: Live Feed + Active Cases */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Live Alert Feed (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                Live Real-Time Alert Feed
              </h2>
              <span className="text-xs text-slate-400 font-mono">Auto-refreshed (5s)</span>
            </div>

            <div className="space-y-3">
              {alertsLoading ? (
                <div className="p-8 text-center text-slate-500 glass-card rounded-xl">Loading live feed...</div>
              ) : alertsData?.alerts?.length === 0 ? (
                <div className="p-8 text-center text-slate-500 glass-card rounded-xl">No active alerts recorded yet.</div>
              ) : (
                alertsData?.alerts.map((alert) => (
                  <div key={alert.id} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-extrabold border rounded uppercase tracking-wider ${getSeverityBadge(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{alert.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm text-slate-200 font-medium">{alert.message}</p>
                      <div className="text-xs text-slate-400 font-mono">
                        Wallet: {alert.wallet?.address} ({alert.wallet?.chain})
                      </div>
                    </div>

                    <Link
                      href={`/lookup?chain=${alert.wallet?.chain}&address=${alert.wallet?.address}`}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-950/40 px-3 py-1.5 rounded-md border border-blue-800/50 whitespace-nowrap"
                    >
                      Inspect Wallet →
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Cases Sidebar (1 Col) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Active Cases</h2>
              <Link href="/cases" className="text-xs text-blue-400 hover:underline">View All</Link>
            </div>

            <div className="space-y-3">
              {casesData?.cases?.slice(0, 5).map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`} className="block glass-card rounded-xl p-4 hover:border-blue-500/40 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-sm text-slate-200">{c.title}</div>
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                      {c.status}
                    </span>
                  </div>
                  {c.firNumber && (
                    <div className="text-xs text-slate-400 font-mono mt-1">FIR: {c.firNumber}</div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
                    <span>By: {c.createdBy?.name}</span>
                    <span>Evidence: {c._count?.evidence ?? 0}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
