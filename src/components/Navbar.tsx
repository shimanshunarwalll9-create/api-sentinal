import React from 'react';
import {
  Shield,
  RefreshCw,
  Globe,
  Network,
  LogOut,
  LogIn,
  ExternalLink,
  User,
} from 'lucide-react';
import type { UserRole, UserAccount } from '../types/sentinel';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  isConnected: boolean;
  lastUpdated: string;
  onRefresh: () => void;
  blockedCount: number;
  patternCount?: number;
  currentUser?: UserAccount | null;
  onSignOut?: () => void;
  onNavigateToLanding?: () => void;
  onNavigateToLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeRole,
  setActiveRole,
  isConnected,
  lastUpdated,
  onRefresh,
  blockedCount,
  patternCount = 0,
  currentUser,
  onSignOut,
  onNavigateToLanding,
  onNavigateToLogin,
}) => {
  const tabs = [
    { id: 'overview', label: 'SOC Overview' },
    { id: 'threats', label: 'Threat Feed' },
    {
      id: 'distributed',
      label: `Distributed Patterns ${patternCount > 0 ? `(${patternCount})` : ''}`,
      icon: Globe,
    },
    { id: 'graph', label: 'Relationship Graph', icon: Network },
    { id: 'simulator', label: 'Traffic Simulator' },
    { id: 'policies', label: 'Policy Engine' },
    { id: 'blocked', label: `Blocked Clients ${blockedCount > 0 ? `(${blockedCount})` : ''}` },
    { id: 'store', label: 'Protected Store' },
    { id: 'audit', label: 'Audit Trail' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Meta info */}
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={onNavigateToLanding}
              title="Return to Public Landing Page"
            >
              <div className="w-8 h-8 rounded bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 transition-colors">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold tracking-wider text-sm uppercase text-slate-100 group-hover:text-cyan-400 transition-colors">
                  API Sentinel
                </span>
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                  Adaptive Threat Gateway
                </span>
              </div>
            </div>

            {/* Clean unboxed metadata with separators (zero-pill discipline) */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {isConnected ? 'Edge Protection Active' : 'Connecting Gateway...'}
              </span>
              <span className="text-slate-700">·</span>
              <span>Updated {lastUpdated}</span>
              <span className="text-slate-700">·</span>
              <span className="text-cyan-400">v2.4 Pro</span>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Landing page link */}
            {onNavigateToLanding && (
              <button
                onClick={onNavigateToLanding}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-slate-800 rounded-md transition-colors"
                title="View Product Landing Page"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                <span>Landing Page</span>
              </button>
            )}

            {/* Role Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-md">
              <span className="px-1.5 text-[11px] text-slate-400 font-medium hidden sm:inline">
                Role:
              </span>
              {(['admin', 'analyst', 'viewer'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRole(r)}
                  className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                    activeRole === r
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>

            {/* Auth Session State */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                    {currentUser.fullName}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase">
                    {currentUser.role}
                  </span>
                </div>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    title="Sign Out"
                    className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-slate-900 rounded-md border border-slate-800 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              onNavigateToLogin && (
                <button
                  onClick={onNavigateToLogin}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 rounded-md transition-all shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sign In</span>
                </button>
              )
            )}

            {/* Manual Refresh */}
            <button
              onClick={onRefresh}
              title="Refresh telemetry"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-md border border-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 overflow-x-auto py-1.5 border-t border-slate-800/80 no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-cyan-300 font-semibold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
