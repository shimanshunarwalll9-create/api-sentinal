import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import type { UserAccount } from '../types/sentinel';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount, token: string) => void;
  onGoToRegister: () => void;
  onBackToHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onGoToRegister,
  onBackToHome,
}) => {
  const [email, setEmail] = useState('admin@sentinel.internal');
  const [password, setPassword] = useState('admin123!');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('sentinel_auth_token', data.token);
        onLoginSuccess(data.user, data.token);
      } else {
        setErrorMsg(data.error || 'Authentication failed. Please verify credentials.');
      }
    } catch {
      setErrorMsg('Network error connecting to Sentinel authentication gateway.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPreset = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Subtle Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-black to-black pointer-events-none" />

      {/* Return Home Button */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-mono text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Landing Page</span>
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-xl">
            <Shield className="w-6 h-6" />
          </div>
        </div>
        <h2 className="mt-4 text-center font-display text-2xl font-bold uppercase tracking-wider text-white">
          Sign In to API Sentinel
        </h2>
        <p className="mt-1 text-center text-xs text-white/60 font-mono">
          Real-Time API Security & Distributed Abuse Pattern Recognition
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 py-8 px-6 sm:px-10 rounded-2xl shadow-2xl space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-white/70 uppercase tracking-wider mb-1">
                Operator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sentinel.internal"
                  className="w-full bg-black/60 border border-white/15 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono text-white/70 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert('Demo Reset: Use one of the quick presets below or register a new test account.')}
                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/60 border border-white/15 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-white text-black hover:bg-white/90 text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Console'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                // Instant demo Google sign in
                handleQuickPreset('analyst@sentinel.internal', 'analyst123!');
              }}
              className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/15 text-white/90 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google (SSO)</span>
            </button>
          </form>

          {/* Quick Presets for Hackathon Judges */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider block">
              Quick Role Sign-In Presets (Click to autofill):
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPreset('admin@sentinel.internal', 'admin123!')}
                className="p-2 rounded bg-black/40 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-cyan-300 transition-colors text-center"
              >
                <div className="font-bold">Admin</div>
                <div className="text-[9px] text-white/40">Full Access</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('analyst@sentinel.internal', 'analyst123!')}
                className="p-2 rounded bg-black/40 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-indigo-300 transition-colors text-center"
              >
                <div className="font-bold">Analyst</div>
                <div className="text-[9px] text-white/40">Investigate</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('viewer@sentinel.internal', 'viewer123!')}
                className="p-2 rounded bg-black/40 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-emerald-300 transition-colors text-center"
              >
                <div className="font-bold">Viewer</div>
                <div className="text-[9px] text-white/40">Read-Only</div>
              </button>
            </div>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={onGoToRegister}
              className="text-xs font-mono text-white/70 hover:text-white"
            >
              Don't have an operator account? <span className="text-cyan-400 font-semibold underline">Create account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
