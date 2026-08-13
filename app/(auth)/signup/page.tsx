'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Mail, Lock, User, Globe, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOrgNameChange = (val: string) => {
    setTenantName(val);
    setTenantSlug(val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName,
          tenantSlug,
          name,
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      localStorage.setItem('reportapp_token', data.token);
      localStorage.setItem('reportapp_user', JSON.stringify(data.user));
      localStorage.setItem('reportapp_tenant', JSON.stringify(data.tenant));

      router.push(`/${data.tenant.slug}/dashboard`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-lg w-full glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/30">
              R
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight">Report<span className="text-blue-500">App</span></span>
          </Link>
          <h2 className="text-2xl font-bold text-white">Create Your Organization</h2>
          <p className="text-xs text-slate-400">Initialize isolated tenant database & start 14-day trial</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Organization Name</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  placeholder="Acme Ministry"
                  className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">URL Slug</label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="acme"
                  className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Your Full Name (Admin)</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Admin Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@acme.org"
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Admin Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Create Tenant & Start Trial
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          Already have a tenant?{' '}
          <Link href="/login" className="text-blue-400 hover:underline font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
