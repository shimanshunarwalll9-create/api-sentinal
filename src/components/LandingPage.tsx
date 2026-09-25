import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Activity,
  ArrowRight,
  Menu,
  X,
  Lock,
  Zap,
  Globe,
  CheckCircle2,
  ChevronRight,
  Database,
  Cpu,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onGoToSignIn: () => void;
  onGoToDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onGoToSignIn,
  onGoToDashboard,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Animated stats count-up using IntersectionObserver & prefers-reduced-motion
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsAnimated, setStatsAnimated] = useState(false);
  const [inferenceTime, setInferenceTime] = useState(0);
  const [uptime, setUptime] = useState(0);
  const [contextWindows, setContextWindows] = useState(0);

  // Handle ESC key for mobile navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Handle resize to close mobile menu
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  // Stats count-up animation
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setInferenceTime(120);
      setUptime(99.99);
      setContextWindows(2.4);
      setStatsAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !statsAnimated) {
          setStatsAnimated(true);

          // Animate Inference Time (to 120ms)
          let startInf = 0;
          const infTimer = setInterval(() => {
            startInf += 4;
            if (startInf >= 120) {
              setInferenceTime(120);
              clearInterval(infTimer);
            } else {
              setInferenceTime(startInf);
            }
          }, 25);

          // Animate Uptime (to 99.99%)
          let startUp = 90.0;
          const upTimer = setInterval(() => {
            startUp += 0.45;
            if (startUp >= 99.99) {
              setUptime(99.99);
              clearInterval(upTimer);
            } else {
              setUptime(Number(startUp.toFixed(2)));
            }
          }, 35);

          // Animate Context Windows (to 2.4M)
          let startCtx = 0.0;
          const ctxTimer = setInterval(() => {
            startCtx += 0.1;
            if (startCtx >= 2.4) {
              setContextWindows(2.4);
              clearInterval(ctxTimer);
            } else {
              setContextWindows(Number(startCtx.toFixed(1)));
            }
          }, 40);
        }
      },
      { threshold: 0.25 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => observer.disconnect();
  }, [statsAnimated]);

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Video exactly as requested */}
      <video
        className="bg-video"
        autoPlay
        muted
        loop
        playsInline
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
          type="video/mp4"
        />
      </video>

      {/* Dark tint overlay for pristine readability */}
      <div className="absolute inset-0 bg-black/60 pointer-events-none z-0" />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navigation Bar */}
        <header className="w-full border-b border-white/10 backdrop-blur-md bg-black/40 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-display text-lg tracking-wider text-white uppercase font-bold">
                API Sentinel
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/80">
              <a href="#hero" className="hover:text-white transition-colors">
                Home
              </a>
              <a href="#product" className="hover:text-white transition-colors">
                Product
              </a>
              <a href="#case-studies" className="hover:text-white transition-colors">
                Case Studies
              </a>
              <a href="#contact" className="hover:text-white transition-colors">
                Contact
              </a>
              <button
                onClick={onGoToSignIn}
                className="hover:text-white transition-colors"
              >
                Sign In
              </button>
            </nav>

            {/* Direct SOC Access Button */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={onGoToDashboard}
                className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-semibold tracking-wide uppercase transition-colors border border-white/20 cursor-pointer"
              >
                Security Console
              </button>
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 text-white/80 hover:text-white rounded-lg focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Overlay Navigation */}
          {mobileMenuOpen && (
            <div
              className="md:hidden fixed inset-0 top-20 bg-black/95 backdrop-blur-xl border-t border-white/10 p-6 flex flex-col justify-between z-50 animate-fade-in"
              onClick={() => setMobileMenuOpen(false)}
            >
              <nav className="flex flex-col gap-6 text-lg font-medium text-white/90">
                <a href="#hero" className="hover:text-white py-2">
                  Home
                </a>
                <a href="#product" className="hover:text-white py-2">
                  Product
                </a>
                <a href="#case-studies" className="hover:text-white py-2">
                  Case Studies
                </a>
                <a href="#contact" className="hover:text-white py-2">
                  Contact
                </a>
                <button
                  onClick={onGoToSignIn}
                  className="text-left hover:text-white py-2"
                >
                  Sign In
                </button>
              </nav>

              <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
                <button
                  onClick={onGetStarted}
                  className="w-full py-3 bg-white text-black font-bold rounded-lg text-center cursor-pointer"
                >
                  Get Started
                </button>
                <button
                  onClick={onGoToDashboard}
                  className="w-full py-3 bg-white/10 border border-white/20 text-white font-bold rounded-lg text-center cursor-pointer"
                >
                  Security Console
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Hero Section */}
        <section id="hero" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 flex flex-col justify-center">
          <div className="max-w-4xl">
            {/* Headline: Solid white, no gradient, no shimmer, retro display font */}
            <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-none uppercase">
              Intelligence<br />Designed To Evolve
            </h1>

            {/* Subheading exactly as requested */}
            <p className="mt-8 text-lg sm:text-xl text-white/70 max-w-2xl leading-relaxed">
              Build applications that reason, adapt and collaborate using a modular AI platform designed for production.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <button
                onClick={onGetStarted}
                className="px-8 py-4 bg-white text-black hover:bg-white/90 text-sm font-bold uppercase tracking-wider rounded transition-all shadow-xl flex items-center gap-2 group cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onGoToDashboard}
                className="px-8 py-4 bg-black/60 hover:bg-white/10 text-white text-sm font-semibold uppercase tracking-wider rounded border border-white/30 backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Launch Security Console</span>
              </button>
            </div>
          </div>

          {/* Trust Section */}
          <div className="mt-20 pt-10 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {/* Overlapping circular avatars */}
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-black flex items-center justify-center text-xs font-bold text-white shadow">
                  M
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-black flex items-center justify-center text-xs font-bold text-white shadow">
                  A
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-600 border-2 border-black flex items-center justify-center text-xs font-bold text-white shadow">
                  G
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-white">
                  Trusted by 2000+ Enterprises
                </div>
                <div className="text-xs text-white/50 font-mono">
                  Microsoft · Amazon · Google
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 text-xs font-mono text-white/60 uppercase tracking-widest">
              <span>Zero-Trust Gateway</span>
              <span>·</span>
              <span>Behavioral Clustering</span>
              <span>·</span>
              <span>Explainable Scoring</span>
            </div>
          </div>
        </section>

        {/* Stats Section with Animated Count-up */}
        <section ref={statsRef} className="border-y border-white/10 bg-black/80 backdrop-blur-md py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {/* Stat 1: Inference Time */}
              <div className="space-y-1">
                <div className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight flex items-baseline">
                  <span className="text-cyan-400 mr-2 text-3xl font-mono">&lt;</span>
                  <span>{inferenceTime}ms</span>
                </div>
                <div className="text-xs uppercase tracking-wider text-white/50 font-medium">
                  Inference Time
                </div>
              </div>

              {/* Stat 2: Platform Uptime */}
              <div className="space-y-1">
                <div className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight flex items-baseline">
                  <span className="text-emerald-400 mr-2 text-3xl font-mono">%</span>
                  <span>{uptime}%</span>
                </div>
                <div className="text-xs uppercase tracking-wider text-white/50 font-medium">
                  Platform Uptime
                </div>
              </div>

              {/* Stat 3: Autonomous Runtime */}
              <div className="space-y-1">
                <div className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight flex items-baseline">
                  <span className="text-indigo-400 mr-2 text-3xl font-mono">*</span>
                  <span>24/7</span>
                </div>
                <div className="text-xs uppercase tracking-wider text-white/50 font-medium">
                  Autonomous Runtime
                </div>
              </div>

              {/* Stat 4: Context Windows */}
              <div className="space-y-1">
                <div className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight flex items-baseline">
                  <span className="text-amber-400 mr-2 text-3xl font-mono">#</span>
                  <span>{contextWindows}M</span>
                </div>
                <div className="text-xs uppercase tracking-wider text-white/50 font-medium">
                  Context Windows
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Product Capabilities Overview */}
        <section id="product" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="max-w-3xl space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              Next-Generation Perimeter Intelligence
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-bold uppercase text-white leading-tight">
              From Individual Anomalies to Distributed Coordinated Defense
            </h2>
            <p className="text-white/70 text-sm sm:text-base leading-relaxed">
              Modern attackers no longer rely on high-volume single-IP flooding. They distribute requests across thousands of rotating residential proxies, stolen user accounts, and parallel endpoints. API Sentinel builds real-time behavioral fingerprints and links synchronized entities into an explainable relationship graph.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-xl bg-white/5 border border-white/10 space-y-4 hover:border-white/20 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg uppercase font-bold text-white">
                Behavioral Fingerprinting
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Evaluates request intervals, method ratios, endpoint sequences, and sudden velocity variances across rolling 60-second sliding windows.
              </p>
            </div>

            <div className="p-8 rounded-xl bg-white/5 border border-white/10 space-y-4 hover:border-white/20 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg uppercase font-bold text-white">
                Distributed Clustering
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Detects locked-step botnet coordination across disparate IP subnets and accounts. Differentiates legitimate flash surges from attacks.
              </p>
            </div>

            <div className="p-8 rounded-xl bg-white/5 border border-white/10 space-y-4 hover:border-white/20 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg uppercase font-bold text-white">
                Adaptive Mitigation
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Applies deterministic security actions (Allow, Monitor, Rate Limit, Temporary Block) with an assistive Gemini 3.8 Flash AI incident briefing.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto border-t border-white/10 py-10 bg-black text-xs text-white/50 font-mono">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              API Sentinel © 2026 · Real-Time API Security & Distributed Abuse Pattern Recognition
            </div>
            <div className="flex items-center gap-6">
              <button onClick={onGoToSignIn} className="hover:text-white cursor-pointer">
                Operator Sign In
              </button>
              <button onClick={onGoToDashboard} className="hover:text-white cursor-pointer">
                Security Console
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
