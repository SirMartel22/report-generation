'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Settings, HardDrive, Users, Layers, Trash2, CheckCircle2, Shield, UserPlus, Mail, Sparkles, RefreshCw } from 'lucide-react';
import { getOfflineDB } from '@/lib/offline/db';

export default function TenantSettingsPage() {
  const params = useParams();
  const tenantSlug = (params?.tenantSlug as string) || 'bhbc';

  const [activeTab, setActiveTab] = useState<'subunits' | 'storage' | 'team'>('subunits');
  const [subunits, setSubunits] = useState<string[]>([
    'Livestream',
    'Socials',
    'Videography',
    'Photography',
  ]);
  const [newSubunit, setNewSubunit] = useState('');

  // Storage Stats
  const [reportCount, setReportCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [storageSuccess, setStorageSuccess] = useState('');

  // Team Invite State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('SUBUNIT_HEAD');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    loadStorageStats();
  }, [tenantSlug]);

  const loadStorageStats = async () => {
    try {
      const db = getOfflineDB(tenantSlug);
      const rCount = await db.reports.count();
      const qCount = await db.syncQueue.count();
      setReportCount(rCount);
      setQueueCount(qCount);
    } catch (e) {
      // ignore
    }
  };

  const handleAddSubunit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubunit.trim()) return;
    if (!subunits.includes(newSubunit.trim())) {
      setSubunits([...subunits, newSubunit.trim()]);
    }
    setNewSubunit('');
  };

  const handleRemoveSubunit = (name: string) => {
    setSubunits(subunits.filter((s) => s !== name));
  };

  const handleClearOfflineCache = async () => {
    try {
      const db = getOfflineDB(tenantSlug);
      await db.reports.clear();
      await db.syncQueue.clear();
      loadStorageStats();
      setStorageSuccess('Local IndexedDB offline cache cleared successfully!');
      setTimeout(() => setStorageSuccess(''), 3000);
    } catch (e) {
      // ignore
    }
  };

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteSuccess(`Invitation link sent to ${inviteEmail}!`);
    setInviteEmail('');
    setTimeout(() => setInviteSuccess(''), 3500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Tenant Organization & PWA Settings</h1>
        <p className="text-xs text-slate-400">Manage customizable subunits, offline storage cache, and team permissions</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('subunits')}
          className={`pb-3.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'subunits'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" /> Subunit Customization
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`pb-3.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'storage'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <HardDrive className="w-4 h-4" /> Offline PWA Storage
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`pb-3.5 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'team'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> Team & Invitations
        </button>
      </div>

      {/* Tab 1: Subunits */}
      {activeTab === 'subunits' && (
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">Organization Subunit Structure</h3>
            <p className="text-xs text-slate-400">Adapt department/subunit names to your team's workflow</p>
          </div>

          <form onSubmit={handleAddSubunit} className="flex gap-3">
            <input
              type="text"
              value={newSubunit}
              onChange={(e) => setNewSubunit(e.target.value)}
              placeholder="Add new subunit (e.g. Sound Engineering)"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-600/30"
            >
              Add Subunit
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {subunits.map((sub) => (
              <div
                key={sub}
                className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between"
              >
                <span className="text-xs font-semibold text-white">{sub}</span>
                <button
                  onClick={() => handleRemoveSubunit(sub)}
                  className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Offline Storage */}
      {activeTab === 'storage' && (
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">IndexedDB Client Cache Management</h3>
            <p className="text-xs text-slate-400">Manage offline reports stored on this device</p>
          </div>

          {storageSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {storageSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Local Reports Cached</span>
              <div className="text-2xl font-extrabold text-white">{reportCount} items</div>
            </div>

            <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Pending Sync Queue</span>
              <div className="text-2xl font-extrabold text-amber-400">{queueCount} items</div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white">Clear Local Cache</h4>
              <p className="text-[11px] text-slate-500">Frees up device storage space without affecting cloud data</p>
            </div>

            <button
              onClick={handleClearOfflineCache}
              className="bg-rose-600/15 hover:bg-rose-600/25 text-rose-400 border border-rose-500/30 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
            >
              Clear IndexedDB Cache
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Team Invitations */}
      {activeTab === 'team' && (
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">Invite Team Members</h3>
            <p className="text-xs text-slate-400">Send unique invite tokens for subunit heads to join tenant</p>
          </div>

          {inviteSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {inviteSuccess}
            </div>
          )}

          <form onSubmit={handleInviteUser} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@organization.org"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30"
            >
              <UserPlus className="w-4 h-4" /> Send Invite Link
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-white">Active Team Members</h4>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                  A
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Pastor David (Admin)</p>
                  <p className="text-[10px] text-slate-400">admin@bhbc.org</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold rounded-full">
                ADMIN
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
                  S
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Sarah Jenkins (Livestream Lead)</p>
                  <p className="text-[10px] text-slate-400">livestream@bhbc.org</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold rounded-full">
                SUBUNIT_HEAD
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
