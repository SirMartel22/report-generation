'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileText, Sparkles, CheckCircle2, Clock, Plus, ArrowRight, Mic, Image as ImageIcon, Layers, RefreshCw } from 'lucide-react';
import { getOfflineDB, LocalReport } from '@/lib/offline/db';

export default function DashboardPage() {
  const params = useParams();
  const tenantSlug = (params?.tenantSlug as string) || 'bhbc';

  const [reports, setReports] = useState<LocalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    synced: 0,
    pending: 0,
    conflicts: 0,
  });

  useEffect(() => {
    fetchReports();
  }, [tenantSlug]);

  const fetchReports = async () => {
    setLoading(true);
    let serverMapped: LocalReport[] = [];
    const token = typeof window !== 'undefined' ? localStorage.getItem('reportapp_token') : null;

    try {
      // 1. Try server fetch
      const headers: Record<string, string> = { 'X-Tenant-ID': tenantSlug };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/reports', { headers });

      if (res.ok) {
        const data = await res.json();
        serverMapped = (data.reports || []).map((r: any) => ({
          id: r.id,
          userId: r.userId,
          tenantId: r.tenantId,
          subunit: r.subunit,
          reportType: r.reportType,
          textContent: r.textContent,
          imageUrl: r.imageUrl,
          imageDescription: r.imageDescription,
          audioUrl: r.audioUrl,
          tags: r.tags ? (typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags) : [],
          status: 'SYNCED',
          version: r.version,
          createdAt: new Date(r.createdAt).getTime(),
          updatedAt: new Date(r.updatedAt).getTime(),
          submittedAt: new Date(r.submittedAt || r.createdAt).getTime(),
        }));
      }
    } catch (err) {
      console.error('Failed to fetch server reports:', err);
    }

    // 2. Load IndexedDB offline cache & merge
    try {
      const db = getOfflineDB(tenantSlug);
      const cached = await db.reports.toArray();

      const reportMap = new Map<string, LocalReport>();
      serverMapped.forEach((r) => reportMap.set(r.id, r));
      cached.forEach((r) => reportMap.set(r.id, r));

      const combined = Array.from(reportMap.values()).sort((a, b) => {
        const timeA = a.submittedAt || a.createdAt || 0;
        const timeB = b.submittedAt || b.createdAt || 0;
        return timeB - timeA;
      });
      setReports(combined);
      calculateStats(combined);
    } catch (e) {
      setReports(serverMapped);
      calculateStats(serverMapped);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (items: LocalReport[]) => {
    let synced = 0;
    let pending = 0;
    let conflicts = 0;

    items.forEach((item) => {
      if (item.status === 'SYNCED') synced++;
      else if (item.status === 'DRAFT' || item.status === 'SUBMITTED') pending++;
      else if (item.status === 'CONFLICT') conflicts++;
    });

    setStats({
      total: items.length,
      synced,
      pending,
      conflicts,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="glass-panel p-8 rounded-3xl border border-blue-500/20 glow-blue relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 relative z-10">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">PWA Active &bull; Multi-Tenant Isolated</span>
          <h1 className="text-3xl font-extrabold text-white">Operations Command Center</h1>
          <p className="text-sm text-slate-300 max-w-xl">
            Monitor real-time subunit reports, submit voice & image notes offline, and generate AI-compiled quarterly reports.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <Link
            href={`/${tenantSlug}/submit`}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Submit New Report
          </Link>
          <Link
            href={`/${tenantSlug}/quarterly`}
            className="glass-card hover:bg-slate-800 text-slate-200 text-xs font-semibold px-5 py-3 rounded-xl border border-slate-700 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            AI Quarterly Report
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Reports</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.total}</div>
          <p className="text-[11px] text-slate-500">Across all active subunits</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Synced Cloud</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">{stats.synced}</div>
          <p className="text-[11px] text-slate-500">Stored safely in database</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Pending Offline Sync</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400">{stats.pending}</div>
          <p className="text-[11px] text-slate-500">Stored locally in IndexedDB</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Active Subunits</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-purple-400">4</div>
          <p className="text-[11px] text-slate-500">Livestream, Socials, Video, Photo</p>
        </div>
      </div>

      {/* Main Grid: Submissions Feed & Quick Submission Tool */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Submissions Feed */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Recent Subunit Submissions</h3>
              <p className="text-xs text-slate-400">Live feed from local IndexedDB cache and database</p>
            </div>

            <button
              onClick={fetchReports}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Refresh Feed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {reports.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">No reports submitted yet.</p>
              <Link
                href={`/${tenantSlug}/submit`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 hover:underline"
              >
                Submit your first report &rarr;
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.slice(0, 5).map((report) => (
                <div
                  key={report.id}
                  className="bg-slate-900/70 border border-slate-800/80 hover:border-blue-500/30 p-4 rounded-2xl transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold rounded-full uppercase">
                        {report.subunit}
                      </span>
                      <span className="text-xs font-semibold text-slate-300">
                        {report.reportType} REPORT
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-500">
                      {new Date(report.submittedAt || report.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {report.textContent || report.imageDescription || 'Audio voice submission recorded.'}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-[11px]">
                    <span className="text-slate-500">Version {report.version || 1}</span>

                    {report.status === 'SYNCED' ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Synced Cloud
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1 font-semibold">
                        <Clock className="w-3.5 h-3.5" /> Offline Draft
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center pt-2">
            <Link
              href={`/${tenantSlug}/reports`}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5"
            >
              View All Subunit Reports
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Subunit Quick Submission Action Card */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-base font-bold text-white">Quick Submit</h3>
            <p className="text-xs text-slate-400">Choose submission mode. Works completely offline.</p>

            <div className="space-y-3">
              <Link
                href={`/${tenantSlug}/submit?type=TEXT`}
                className="w-full bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 p-3.5 rounded-2xl flex items-center gap-3 transition-all group"
              >
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-white">Text Report</p>
                  <p className="text-[10px] text-slate-400">Write operational updates</p>
                </div>
              </Link>

              <Link
                href={`/${tenantSlug}/submit?type=VOICE`}
                className="w-full bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 p-3.5 rounded-2xl flex items-center gap-3 transition-all group"
              >
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-white">Voice Note</p>
                  <p className="text-[10px] text-slate-400">Gemma 4 AI Audio Transcription</p>
                </div>
              </Link>

              <Link
                href={`/${tenantSlug}/submit?type=IMAGE`}
                className="w-full bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 p-3.5 rounded-2xl flex items-center gap-3 transition-all group"
              >
                <div className="p-2.5 bg-pink-500/10 text-pink-400 rounded-xl group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-white">Photo Evidence</p>
                  <p className="text-[10px] text-slate-400">Gemma 4 AI Image Captioning</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
