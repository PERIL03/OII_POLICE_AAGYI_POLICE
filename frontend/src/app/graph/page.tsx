'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { fetchApi } from '@/lib/api';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  fullAddress: string;
  chain: string;
  riskScore: number;
  isCenter?: boolean;
  val: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  txHash: string;
  amount: number;
}

interface WalletLookupResult {
  wallet: {
    address: string;
    chain: string;
    currentRiskScore: number;
  };
  transactions?: Array<{
    txHash: string;
    amount: number;
    fromWallet?: { address?: string };
    toWallet?: { address?: string };
  }>;
}

function GraphContent() {
  const searchParams = useSearchParams();
  const initialChain = (searchParams.get('chain') as 'BTC' | 'ETH') || 'BTC';
  const initialAddress = searchParams.get('address') || '';

  const [chain, setChain] = useState<'BTC' | 'ETH'>(initialChain);
  const [address, setAddress] = useState(initialAddress);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const loadGraphData = useCallback(async (c: 'BTC' | 'ETH', addr: string) => {
    if (!addr.trim()) return;
    setLoading(true);
    setSelectedNode(null);

    try {
      const res = await fetchApi<WalletLookupResult>(`/api/wallets/lookup?chain=${c}&address=${encodeURIComponent(addr.trim())}`);
      
      const nodesMap = new Map<string, GraphNode>();
      const links: GraphLink[] = [];

      const centerAddr = res.wallet.address.toLowerCase();
      nodesMap.set(centerAddr, {
        id: centerAddr,
        label: `${c}: ${centerAddr.slice(0, 8)}...`,
        fullAddress: res.wallet.address,
        chain: c,
        riskScore: res.wallet.currentRiskScore,
        isCenter: true,
        val: 12,
      });

      res.transactions?.forEach((tx) => {
        const from = tx.fromWallet?.address?.toLowerCase() || 'unknown';
        const to = tx.toWallet?.address?.toLowerCase() || 'unknown';

        if (from && !nodesMap.has(from)) {
          nodesMap.set(from, {
            id: from,
            label: `${c}: ${from.slice(0, 8)}...`,
            fullAddress: tx.fromWallet?.address || from,
            chain: c,
            riskScore: 0,
            val: 6,
          });
        }

        if (to && !nodesMap.has(to)) {
          nodesMap.set(to, {
            id: to,
            label: `${c}: ${to.slice(0, 8)}...`,
            fullAddress: tx.toWallet?.address || to,
            chain: c,
            riskScore: 0,
            val: 6,
          });
        }

        links.push({
          source: from,
          target: to,
          txHash: tx.txHash,
          amount: tx.amount,
        });
      });

      setGraphData({
        nodes: Array.from(nodesMap.values()),
        links,
      });
    } catch (err: unknown) {
      console.error('Failed to load graph data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialAddress) {
      void (async () => {
        await loadGraphData(initialChain, initialAddress);
      })();
    }
  }, [initialAddress, initialChain, loadGraphData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadGraphData(chain, address);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Search Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Interactive Multi-Hop Fund Flow Graph</h1>
          <p className="text-xs text-slate-400">Visualize counterparty relationships, transaction volume, and risk hubs.</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
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
            className="bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none w-64"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all disabled:opacity-50"
          >
            {loading ? 'Rendering...' : 'Build Graph'}
          </button>
        </form>
      </div>

      {/* Graph Canvas Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass-panel rounded-2xl overflow-hidden border border-slate-800 h-[600px] relative">
          {graphData.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm space-y-2">
              <span>🕸️ Enter a wallet address above to visualize transaction flow graph</span>
            </div>
          ) : (
            <ForceGraph2D
              graphData={graphData}
              nodeAutoColorBy="chain"
              nodeCanvasObject={(nodeObj: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const node = nodeObj as GraphNode;
                const label = node.label;
                const fontSize = 12 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;

                const nodeX = node.x ?? 0;
                const nodeY = node.y ?? 0;

                ctx.beginPath();
                ctx.arc(nodeX, nodeY, node.isCenter ? 8 : 5, 0, 2 * Math.PI, false);
                ctx.fillStyle = node.isCenter
                  ? '#3b82f6'
                  : node.riskScore > 50
                  ? '#f43f5e'
                  : '#10b981';
                ctx.fill();

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(label, nodeX, nodeY + (node.isCenter ? 12 : 9));
              }}
              onNodeClick={(nodeObj: unknown) => setSelectedNode(nodeObj as GraphNode)}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.005}
              linkColor={() => '#334155'}
            />
          )}
        </div>

        {/* Selected Node Details Sidebar */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Entity Details</h3>
          
          {selectedNode ? (
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">Address</span>
                <span className="font-mono text-slate-200 break-all select-all font-bold">{selectedNode.fullAddress}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Chain</span>
                <span className="text-blue-400 font-bold">{selectedNode.chain}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Risk Score</span>
                <span className="text-lg font-extrabold text-slate-100">{selectedNode.riskScore ?? 0}/100</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Click any node in the graph to inspect entity attributes and transactions.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FlowGraphPage() {
  return (
    <div className="min-h-screen bg-[#090d16]">
      <Navbar />
      <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading flow graph...</div>}>
        <GraphContent />
      </Suspense>
    </div>
  );
}
