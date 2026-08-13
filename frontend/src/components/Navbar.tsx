'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Address Lookup', href: '/lookup' },
    { label: 'Flow Graph', href: '/graph' },
    { label: 'Watchlist', href: '/watchlist' },
    { label: 'Cases', href: '/cases' },
    { label: 'Audit Logs', href: '/audit-logs' },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              CT
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-wide">Crypto<span className="text-blue-500">Trace</span></span>
              <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-blue-950/80 text-blue-400 border border-blue-800/50 rounded">
                Chandigarh Police
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User info & Logout */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-200">{user.name}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono">
                    {user.role} {user.badgeId && `• ${user.badgeId}`}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-400 hover:bg-rose-950/40 border border-slate-700/60 hover:border-rose-800/50 rounded-md transition-all"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-950/40 border border-blue-800/50 rounded-md transition-all"
                >
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
