'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

interface CaseListItem {
  id: string;
  title: string;
  firNumber?: string;
  status: string;
  createdBy?: {
    name: string;
  };
  _count?: {
    evidence?: number;
    notes?: number;
  };
}

export default function CasesPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [firNumber, setFirNumber] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cases'],
    queryFn: () => fetchApi<{ cases: CaseListItem[] }>('/api/cases'),
  });

  const createMutation = useMutation({
    mutationFn: (newCase: { title: string; firNumber?: string }) =>
      fetchApi('/api/cases', { method: 'POST', body: JSON.stringify(newCase) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setTitle('');
      setFirNumber('');
      setShowCreateModal(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({ title: title.trim(), firNumber: firNumber.trim() || undefined });
  };

  return (
    <div className="min-h-screen bg-[#090d16]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">Investigation Cases</h1>
            <p className="text-xs text-slate-400">Manage cybercrime FIR investigations, evidence attachments, and reports.</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all shadow-lg shadow-blue-600/20"
          >
            + Open New Case
          </button>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="glass-panel rounded-2xl p-6 border border-slate-700 w-full max-w-md space-y-4">
              <h3 className="text-lg font-bold text-white">Open New Investigation Case</h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Case Title / Description *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Crypto Ransomware Complaint FIR 42"
                    className="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">FIR Number (Optional)</label>
                  <input
                    type="text"
                    value={firNumber}
                    onChange={(e) => setFirNumber(e.target.value)}
                    placeholder="e.g. FIR-2026-CHD-0042"
                    className="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded-lg text-xs"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Case'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cases Grid */}
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 glass-card rounded-xl">Loading investigation cases...</div>
        ) : data?.cases?.length === 0 ? (
          <div className="p-8 text-center text-slate-500 glass-card rounded-xl">No investigation cases opened yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.cases?.map((c) => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 hover:border-blue-500/40 transition-all block"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-base text-white">{c.title}</h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {c.status}
                  </span>
                </div>

                {c.firNumber && (
                  <div className="text-xs font-mono text-blue-400">FIR: {c.firNumber}</div>
                )}

                <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800">
                  <div>Investigator: {c.createdBy?.name}</div>
                  <div>Attached Evidence: {c._count?.evidence ?? 0} items</div>
                  <div>Case Notes: {c._count?.notes ?? 0} notes</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
