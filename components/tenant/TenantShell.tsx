'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FilePlus,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
} from 'lucide-react';
import OfflineBadge from '@/components/pwa/OfflineBadge';

interface TenantShellProps {
  children: React.ReactNode;
  tenantSlug: string;
  user: {
    name: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    subscriptionTier: string;
  };
}

export default function TenantShell({
  children,
  tenantSlug,
  user,
  tenant,
}: TenantShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  const isAdmin = user.role === 'ADMIN' || user.role === 'SYSTEM_ADMIN';
  const navItems = [
    { label: 'Dashboard', href: `/${tenantSlug}/dashboard`, icon: LayoutDashboard },
    { label: 'Submit Report', href: `/${tenantSlug}/submit`, icon: FilePlus },
    { label: 'All Reports', href: `/${tenantSlug}/reports`, icon: FileText },
    ...(isAdmin
      ? [
          { label: 'AI Quarterly Reports', href: `/${tenantSlug}/quarterly/generate`, icon: Sparkles },
          { label: 'Tenant Settings', href: `/${tenantSlug}/settings`, icon: Settings },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 glass-panel border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2 py-3 border-b border-slate-800/60">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/25">
              {tenant.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">{tenant.name}</h2>
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider block">
                {tenant.subscriptionTier} PLAN
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-md shadow-blue-500/5'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800/60 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass-panel border-b border-slate-800/80 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <span className="text-xs font-semibold text-slate-400 capitalize">
            Tenant &bull; <span className="text-white font-bold">{tenantSlug}</span>
          </span>
          <OfflineBadge tenantId={tenantSlug} />
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
