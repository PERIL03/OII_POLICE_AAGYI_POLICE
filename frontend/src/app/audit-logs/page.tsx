'use client';

import React from 'react';
import { Navbar } from '@/components/Navbar';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';

interface AuditLogItem {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  metadata?: Record<string, unknown>;
  user?: {
    name: string;
    role: string;
  };
}

export default function AuditLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => fetchApi<{ logs: AuditLogItem[]; total: number }>('/api/audit-logs?limit=50'),
  });

  return (
    <div className="min-h-screen bg-[#090d16]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Audit Trail & Activity Logs</h1>
          <p className="text-xs text-slate-400">Immutable audit log recording every investigative lookup, case mutation, and export.</p>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-slate-800">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading audit trail...</div>
          ) : data?.logs?.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No audit logs recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Officer / User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity Type</th>
                    <th className="p-3">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {data?.logs?.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40">
                      <td className="p-3 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-bold text-slate-200">
                        {log.user ? `${log.user.name} (${log.user.role})` : 'System'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">{log.entityType}</td>
                      <td className="p-3 text-slate-400 font-sans truncate max-w-xs">
                        {JSON.stringify(log.metadata)}
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
