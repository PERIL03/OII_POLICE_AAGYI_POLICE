'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';

interface EvidenceItem {
  id: string;
  createdAt: string;
  wallet?: {
    chain: string;
    address: string;
    currentRiskScore: number;
  };
  transaction?: {
    chain: string;
    txHash: string;
    amount: number;
  };
  addedBy?: {
    name: string;
  };
}

interface NoteItem {
  id: string;
  body: string;
  createdAt: string;
  author?: {
    name: string;
  };
}

interface CaseDetail {
  id: string;
  title: string;
  status: string;
  firNumber?: string;
  createdAt: string;
  createdBy?: {
    name: string;
    badgeId?: string;
  };
  evidence?: EvidenceItem[];
  notes?: NoteItem[];
}

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;
  const queryClient = useQueryClient();

  const [noteBody, setNoteBody] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => fetchApi<{ case: CaseDetail }>(`/api/cases/${caseId}`),
  });

  const addNoteMutation = useMutation({
    mutationFn: (body: string) =>
      fetchApi(`/api/cases/${caseId}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNoteBody('');
    },
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    addNoteMutation.mutate(noteBody.trim());
  };

  const handleExportPdf = async () => {
    setDownloadingPdf(true);
    try {
      const token = localStorage.getItem('token');
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await fetch(`${apiBase}/api/reports/case/${caseId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('PDF export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Case-Report-${caseId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download PDF report';
      alert(msg);
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#090d16]"><Navbar /><div className="p-8 text-center text-slate-500">Loading case file...</div></div>;
  if (error || !data?.case) return <div className="min-h-screen bg-[#090d16]"><Navbar /><div className="p-8 text-center text-rose-500">Case not found.</div></div>;

  const c = data.case;

  return (
    <div className="min-h-screen bg-[#090d16]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Case Header Card */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{c.title}</h1>
              <span className="px-3 py-1 text-xs font-mono font-bold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                {c.status}
              </span>
            </div>
            {c.firNumber && <div className="text-xs font-mono text-blue-400">FIR Reference: {c.firNumber}</div>}
            <div className="text-xs text-slate-400">
              Investigator: <span className="text-slate-200">{c.createdBy?.name}</span> ({c.createdBy?.badgeId || 'Badge N/A'}) • Opened: {new Date(c.createdAt).toLocaleDateString()}
            </div>
          </div>

          <button
            onClick={handleExportPdf}
            disabled={downloadingPdf}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20 whitespace-nowrap"
          >
            {downloadingPdf ? 'Generating PDF...' : '📄 Export Official Case PDF'}
          </button>
        </div>

        {/* 2 Column Layout: Evidence & Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Evidence Attachments */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white">Case Evidence ({c.evidence?.length ?? 0})</h3>

            {c.evidence?.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No evidence attached yet. Attach wallets or transactions from the screening page.</p>
            ) : (
              <div className="space-y-3">
                {c.evidence?.map((item) => (
                  <div key={item.id} className="glass-card rounded-xl p-4 text-xs font-mono space-y-1">
                    {item.wallet && (
                      <div>
                        <span className="text-blue-400 font-bold">Wallet [{item.wallet.chain}]:</span>{' '}
                        <span className="text-slate-200">{item.wallet.address}</span>
                        <div className="text-[11px] text-slate-400 mt-1">Risk Score: {item.wallet.currentRiskScore}/100</div>
                      </div>
                    )}
                    {item.transaction && (
                      <div>
                        <span className="text-emerald-400 font-bold">Tx [{item.transaction.chain}]:</span>{' '}
                        <span className="text-slate-200">{item.transaction.txHash}</span>
                        <div className="text-[11px] text-slate-400 mt-1">Amount: {item.transaction.amount}</div>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500 pt-1">
                      Added by: {item.addedBy?.name} on {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Case Notes */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
            <h3 className="text-base font-bold text-white">Investigator Notes ({c.notes?.length ?? 0})</h3>

            {/* Add Note Form */}
            <form onSubmit={handleAddNote} className="space-y-3">
              <textarea
                rows={3}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write an investigative observation, intelligence note, or update..."
                className="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg p-3 text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={addNoteMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all disabled:opacity-50"
              >
                {addNoteMutation.isPending ? 'Saving...' : 'Add Note to Case'}
              </button>
            </form>

            {/* Notes List */}
            <div className="space-y-3 pt-2">
              {c.notes?.map((note) => (
                <div key={note.id} className="glass-card rounded-xl p-4 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-300">
                    <span>{note.author?.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">{note.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
