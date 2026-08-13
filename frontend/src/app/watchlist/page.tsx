'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

interface WatchlistEntryItem {
  id: string;
  reason?: string;
  wallet?: {
    chain: string;
    address: string;
    currentRiskScore: number;
  };
  addedBy?: {
    name: string;
  };
}

export default function WatchlistPage() {
  const queryClient = useQueryClient();
  const [chain, setChain] = useState<'BTC' | 'ETH'>('BTC');
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => fetchApi<{ watchlist: WatchlistEntryItem[] }>('/api/watchlist'),
  });

  const addMutation = useMutation({
    mutationFn: (newEntry: { chain: string; address: string; reason?: string }) =>
      fetchApi('/api/watchlist', { method: 'POST', body: JSON.stringify(newEntry) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setAddress('');
      setReason('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/watchlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    addMutation.mutate({ chain, address: address.trim(), reason });
  };

  return (
    <div className="min-h-screen bg-[#090d16]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">Monitored Watchlist Wallets</h1>
            <p className="text-xs text-slate-400">High-priority addresses monitored for real-time transaction signals.</p>
          </div>
        </div>

        {/* Add Entry Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white">Add Address to Watchlist</h3>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value as 'BTC' | 'ETH')}
              className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
            >
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </select>

            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Target wallet address..."
              className="bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none flex-1"
            />

            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for watching..."
              className="bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none flex-1"
            />

            <button
              type="submit"
              disabled={addMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all disabled:opacity-50"
            >
              {addMutation.isPending ? 'Adding...' : 'Watch Address'}
            </button>
          </form>
        </div>

        {/* Watchlist Table */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading watchlist...</div>
          ) : data?.watchlist?.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No watchlisted addresses currently configured.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Chain</th>
                    <th className="p-3">Address</th>
                    <th className="p-3">Risk Score</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Added By</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {data?.watchlist?.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-bold text-blue-400">{entry.wallet?.chain}</td>
                      <td className="p-3 text-slate-100 font-bold truncate max-w-xs">{entry.wallet?.address}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200">
                          {entry.wallet?.currentRiskScore}/100
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-sans">{entry.reason || 'N/A'}</td>
                      <td className="p-3 text-slate-400 font-sans">{entry.addedBy?.name}</td>
                      <td className="p-3 text-right space-x-2">
                        <Link
                          href={`/lookup?chain=${entry.wallet?.chain}&address=${entry.wallet?.address}`}
                          className="text-blue-400 hover:underline"
                        >
                          Screen
                        </Link>
                        <button
                          onClick={() => removeMutation.mutate(entry.id)}
                          className="text-rose-400 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
