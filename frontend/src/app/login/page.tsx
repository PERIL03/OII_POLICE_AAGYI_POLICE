'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl p-8 border border-slate-800 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 items-center justify-center font-bold text-white text-xl shadow-lg shadow-blue-500/20 mb-2">
            CT
          </div>
          <h1 className="text-2xl font-extrabold text-white">Investigator Sign In</h1>
          <p className="text-xs text-slate-400">CryptoTrace — Chandigarh Police Fraud Intelligence Platform</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Official Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@police.gov"
              className="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-lg text-xs transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Platform'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          Need an officer account?{' '}
          <Link href="/register" className="text-blue-400 hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
