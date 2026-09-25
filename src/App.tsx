import React, { useState, useEffect } from 'react';
import { useSentinelEvents } from './hooks/useSentinelEvents';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { ThreatFeedTab } from './components/ThreatFeedTab';
import { TrafficSimulatorTab } from './components/TrafficSimulatorTab';
import { PolicyEngineTab } from './components/PolicyEngineTab';
import { BlockedClientsTab } from './components/BlockedClientsTab';
import { StorefrontTab } from './components/StorefrontTab';
import { AuditLogsTab } from './components/AuditLogsTab';
import { IncidentDetailModal } from './components/IncidentDetailModal';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { DistributedPatternsTab } from './components/DistributedPatternsTab';
import { RelationshipGraphTab } from './components/RelationshipGraphTab';
import { BackendApiTab } from './components/BackendApiTab';
import type { ThreatEvent, UserAccount } from './types/sentinel';
import { authService } from './lib/authService';

export default function App() {
  // Client-side URL pathname sync
  const getInitialPath = () => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      return path;
    }
    return '/';
  };

  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedThreat, setSelectedThreat] = useState<ThreatEvent | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Sync browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      setCurrentPath(path);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== path) {
        window.history.pushState({}, '', path);
      }
      setCurrentPath(path);
    }
  };

  const {
    overview,
    trafficPoints,
    telemetry,
    threats,
    blockedClients,
    policies,
    distributedPatterns,
    isConnected,
    activeRole,
    setActiveRole,
    lastUpdated,
    refreshAll,
  } = useSentinelEvents();

  // Check auth session on startup
  useEffect(() => {
    let isMounted = true;
    authService
      .getCurrentUser()
      .then((user) => {
        if (!isMounted) return;
        if (user) {
          setCurrentUser(user);
          setActiveRole(user.role);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setCurrentUser(null);
      })
      .finally(() => {
        if (isMounted) setIsAuthChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [setActiveRole]);

  // Route guard: Redirect unauthenticated requests to /console to /auth
  useEffect(() => {
    if (!isAuthChecking) {
      if (currentPath === '/console' && !currentUser) {
        navigateTo('/auth');
      }
    }
  }, [currentPath, currentUser, isAuthChecking]);

  const handleLoginSuccess = (user: UserAccount, _token: string) => {
    setCurrentUser(user);
    setActiveRole(user.role);
    navigateTo('/console');
    setActiveTab('overview');
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setCurrentUser(null);
    navigateTo('/auth');
  };

  const handleUnblockClient = async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/unblock`, {
        method: 'POST',
        headers: {
          'X-Actor-Name': currentUser?.fullName || `SOC ${activeRole.toUpperCase()}`,
        },
      });
      if (res.ok) {
        refreshAll();
      }
    } catch (e) {
      console.error('Failed to unblock client:', e);
    }
  };

  const handleManualBlockClient = async (
    clientId: string,
    durationSec: number,
    reason: string
  ) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-Name': currentUser?.fullName || `SOC ${activeRole.toUpperCase()}`,
        },
        body: JSON.stringify({ durationSec, reason }),
      });
      if (res.ok) {
        refreshAll();
      }
    } catch (e) {
      console.error('Failed to block client:', e);
    }
  };

  // Route 1: "/" (Root URL) -> Public Landing Page
  // The landing page is the first page for every new visitor.
  // Do NOT automatically redirect "/" to the Security Console.
  if (currentPath === '/' || currentPath === '/landing') {
    return (
      <LandingPage
        onGetStarted={() => {
          if (currentUser) {
            navigateTo('/console');
          } else {
            navigateTo('/auth');
          }
        }}
        onGoToSignIn={() => {
          if (currentUser) {
            navigateTo('/console');
          } else {
            navigateTo('/auth');
          }
        }}
        onGoToDashboard={() => {
          if (currentUser) {
            navigateTo('/console');
          } else {
            navigateTo('/auth');
          }
        }}
      />
    );
  }

  // Route: "/auth", "/login", "/register" -> Unified Professional Authentication Interface
  if (currentPath === '/auth' || currentPath === '/login' || currentPath === '/register') {
    // If already authenticated, redirect straight to /console
    if (currentUser) {
      navigateTo('/console');
    }
    return (
      <AuthPage
        initialMode={currentPath === '/register' ? 'signup' : 'signin'}
        onAuthSuccess={handleLoginSuccess}
        onBackToHome={() => navigateTo('/')}
      />
    );
  }

  // Route: "/console" Protected Route check
  if (!currentUser && !isAuthChecking) {
    return (
      <AuthPage
        initialMode="signin"
        onAuthSuccess={handleLoginSuccess}
        onBackToHome={() => navigateTo('/')}
      />
    );
  }

  // Route: "/console" (and all subpaths/tabs) -> Existing API Sentinel Security Console/Profile interface.
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        isConnected={isConnected}
        lastUpdated={lastUpdated}
        onRefresh={refreshAll}
        blockedCount={blockedClients.length}
        patternCount={distributedPatterns.length}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onNavigateToLanding={() => navigateTo('/')}
        onNavigateToLogin={() => navigateTo('/auth')}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            overview={overview}
            trafficPoints={trafficPoints}
            threats={threats}
            blockedClients={blockedClients}
            onSelectThreat={(t) => setSelectedThreat(t)}
            onNavigateToSimulator={() => setActiveTab('simulator')}
            onNavigateToDistributed={() => setActiveTab('distributed')}
            distributedCount={distributedPatterns.length}
          />
        )}

        {activeTab === 'threats' && (
          <ThreatFeedTab
            threats={threats}
            telemetry={telemetry}
            onSelectThreat={(t) => setSelectedThreat(t)}
          />
        )}

        {activeTab === 'distributed' && (
          <DistributedPatternsTab
            patterns={distributedPatterns}
            activeRole={activeRole}
            onNavigateToGraph={() => setActiveTab('graph')}
            onRefreshAll={refreshAll}
          />
        )}

        {activeTab === 'graph' && (
          <RelationshipGraphTab
            activeRole={activeRole}
            onManualBlockClient={handleManualBlockClient}
            onUnblockClient={handleUnblockClient}
          />
        )}

        {activeTab === 'simulator' && (
          <TrafficSimulatorTab
            activeRole={activeRole}
            onRefreshAll={refreshAll}
          />
        )}

        {activeTab === 'policies' && (
          <PolicyEngineTab
            policies={policies}
            activeRole={activeRole}
            onRefreshAll={refreshAll}
          />
        )}

        {activeTab === 'blocked' && (
          <BlockedClientsTab
            blockedClients={blockedClients}
            activeRole={activeRole}
            onRefreshAll={refreshAll}
            onUnblockClient={handleUnblockClient}
            onManualBlockClient={handleManualBlockClient}
          />
        )}

        {activeTab === 'backend' && (
          <BackendApiTab
            activeRole={activeRole}
            onRefreshAll={refreshAll}
          />
        )}

        {activeTab === 'store' && (
          <StorefrontTab onRefreshAll={refreshAll} />
        )}

        {activeTab === 'audit' && (
          <AuditLogsTab activeRole={activeRole} />
        )}
      </main>

      {/* Incident Detail Investigation Modal */}
      {selectedThreat && (
        <IncidentDetailModal
          threat={selectedThreat}
          onClose={() => setSelectedThreat(null)}
          activeRole={activeRole}
          onUnblockClient={handleUnblockClient}
          onManualBlockClient={handleManualBlockClient}
        />
      )}

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>API Sentinel — Distributed Abuse Recognition & Adaptive Defense Gateway</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateTo('/')}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
            >
              Landing Page
            </button>
            <span>·</span>
            <span>College Hackathon MVP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
