import Link from 'next/link';
import { Sparkles, Shield, WifiOff, FileText, Bot, ArrowRight, CheckCircle2, Zap, Layers, Users, BarChart3 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/25">
              R
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white">Report<span className="text-blue-500">App</span></span>
              <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">v2.0 PWA</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 flex items-center gap-2"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Multi-Tenant &bull; Offline-First PWA &bull; Gemma 4 AI Powered</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.1] mb-6">
          Capture Operations <span className="gradient-text">Offline</span>. Compile Reports with <span className="text-blue-500">AI</span>.
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          The SaaS platform designed for churches, teams, and field organizations. Separate isolated database privacy, background PWA offline sync, and instant quarterly AI compilation.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md justify-center mb-16">
          <Link
            href="/login"
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-base font-bold px-8 py-4 rounded-xl transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 group"
          >
            Launch Demo Tenant (BHBC)
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto glass-card hover:bg-slate-800/80 text-slate-200 text-base font-semibold px-8 py-4 rounded-xl border border-slate-700 transition-all flex items-center justify-center"
          >
            Create Organization
          </Link>
        </div>

        {/* Core Pillars Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mt-8">
          <div className="glass-card p-8 rounded-2xl border border-slate-800 hover:border-blue-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">100% Tenant Isolation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Every organization gets complete database isolation. Zero data leaks across teams, with strict GDPR privacy compliance built in.
            </p>
          </div>

          <div className="glass-card p-8 rounded-2xl border border-slate-800 hover:border-blue-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <WifiOff className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Offline-First PWA Sync</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Submit reports without internet connectivity. Queued in IndexedDB and automatically synced with conflict resolution when back online.
            </p>
          </div>

          <div className="glass-card p-8 rounded-2xl border border-slate-800 hover:border-blue-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-6 border border-pink-500/20 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Gemma 4 AI Assistant</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Automated audio transcription for voice notes, AI photo captioning, and 75% faster quarterly executive report compilation.
            </p>
          </div>
        </div>

        {/* Pricing & Features Section */}
        <div className="w-full mt-24">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold text-white mb-3">Flexible Plans for Every Organization</h2>
            <p className="text-slate-400 text-sm">Start free, upgrade when your subunits and reporting needs expand.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {/* Free Tier */}
            <div className="glass-panel p-8 rounded-3xl border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Free Starter</span>
                <div className="text-4xl font-extrabold text-white mt-2 mb-4">$0 <span className="text-sm font-normal text-slate-500">/ mo</span></div>
                <p className="text-xs text-slate-400 mb-6">Ideal for small pilot teams and demo testing.</p>
                <ul className="space-y-3 text-xs text-slate-300 mb-8">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Up to 2 Subunits</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> 50 Reports per month</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> IndexedDB Offline Storage</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Basic AI Transcription</li>
                </ul>
              </div>
              <Link href="/signup" className="w-full text-center bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-3 rounded-xl transition-colors">
                Start Free
              </Link>
            </div>

            {/* Pro Tier (Featured) */}
            <div className="glass-panel p-8 rounded-3xl border-2 border-blue-500/60 glow-blue relative flex flex-col justify-between">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                Most Popular
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Pro Organization</span>
                <div className="text-4xl font-extrabold text-white mt-2 mb-4">$29 <span className="text-sm font-normal text-slate-500">/ mo</span></div>
                <p className="text-xs text-slate-400 mb-6">For active teams needing full AI and PDF export capabilities.</p>
                <ul className="space-y-3 text-xs text-slate-300 mb-8">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" /> Unlimited Subunits & Users</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" /> 5,000 Reports per month</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" /> Gemma 4 AI Quarterly Compilation</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" /> Export PDF & Word Documents</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" /> Push Notification Reminders</li>
                </ul>
              </div>
              <Link href="/signup" className="w-full text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30">
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Enterprise Tier */}
            <div className="glass-panel p-8 rounded-3xl border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Enterprise</span>
                <div className="text-4xl font-extrabold text-white mt-2 mb-4">Custom</div>
                <p className="text-xs text-slate-400 mb-6">For multi-region organizations requiring custom SLAs.</p>
                <ul className="space-y-3 text-xs text-slate-300 mb-8">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" /> Dedicated Database Instance</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" /> Custom Domain Routing</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" /> Dedicated Support & SLA</li>
                </ul>
              </div>
              <Link href="/signup" className="w-full text-center bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-3 rounded-xl transition-colors">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <p>&copy; 2026 ReportApp SaaS Platform. Multi-Tenant PWA Architecture.</p>
      </footer>
    </div>
  );
}
