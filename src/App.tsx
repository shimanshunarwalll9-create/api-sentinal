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
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { DistributedPatternsTab } from './components/DistributedPatternsTab';
import { RelationshipGraphTab } from './components/RelationshipGraphTab';
import { BackendApiTab } from './components/BackendApiTab';
import type { ThreatEvent, UserAccount } from './types/sentinel';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedThreat, setSelectedThreat] = useState<ThreatEvent | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

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
    const token = localStorage.getItem('sentinel_auth_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.user) {
            setCurrentUser(data.user);
            setActiveRole(data.user.role);
          }
        })
        .catch(() => {
          localStorage.removeItem('sentinel_auth_token');
        });
    }
  }, [setActiveRole]);

  const handleLoginSuccess = (user: UserAccount, token: string) => {
    setCurrentUser(user);
    setActiveRole(user.role);
    setActiveTab('overview');
  };

  const handleSignOut = async () => {
    const token = localStorage.getItem('sentinel_auth_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.error('Logout error:', e);
      }
    }
    localStorage.removeItem('sentinel_auth_token');
    setCurrentUser(null);
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

  // Dedicated full-page routes: Landing, Login, Register
  if (activeTab === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => setActiveTab('overview')}
        onGoToSignIn={() => setActiveTab('login')}
        onGoToDashboard={() => setActiveTab('overview')}
      />
    );
  }

  if (activeTab === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onGoToRegister={() => setActiveTab('register')}
        onBackToHome={() => setActiveTab('overview')}
      />
    );
  }

  if (activeTab === 'register') {
    return (
      <RegisterPage
        onRegisterSuccess={handleLoginSuccess}
        onGoToLogin={() => setActiveTab('login')}
        onBackToHome={() => setActiveTab('overview')}
      />
    );
  }

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
        onNavigateToLanding={() => setActiveTab('landing')}
        onNavigateToLogin={() => setActiveTab('login')}
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
              onClick={() => setActiveTab('landing')}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
            >
              Public Presentation Page
            </button>
            <span>·</span>
            <span>College Hackathon MVP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
