'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Search, Filter, CheckCircle2, Clock, AlertTriangle, Layers } from 'lucide-react';
import { getOfflineDB, LocalReport } from '@/lib/offline/db';
import ConflictModal from '@/components/reports/ConflictModal';
import { SyncManager } from '@/lib/offline/syncManager';
import { mapServerReport } from '@/lib/reports/client';

export default function ReportsHistoryPage() {
  const params = useParams();
  const tenantSlug = (params?.tenantSlug as string) || 'bhbc';

  const [reports, setReports] = useState<LocalReport[]>([]);
  const [selectedSubunit, setSelectedSubunit] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConflictReport, setSelectedConflictReport] = useState<LocalReport | null>(null);

  const subunits = ['ALL', 'Livestream', 'Socials', 'Videography', 'Photography'];

  const loadReports = useCallback(async () => {
    let serverMapped: LocalReport[] = [];
    try {
      // 1. Try server fetch
      const res = await fetch('/api/reports');

      if (res.ok) {
        const data = (await res.json()) as { reports?: unknown[] };
        serverMapped = (data.reports || [])
          .map(mapServerReport)
          .filter((report): report is LocalReport => report !== null);
      }
    } catch (err) {
      console.error('Failed to fetch server reports:', err);
    }

    // 2. Load IndexedDB local reports (for unsynced offline submissions)
    try {
      const db = getOfflineDB(tenantSlug);
      const cached = await db.reports.toArray();

      // Merge server reports and local IndexedDB reports (prefer local unsynced/draft over server)
      const reportMap = new Map<string, LocalReport>();
      serverMapped.forEach((r) => reportMap.set(r.id, r));
      cached.forEach((r) => reportMap.set(r.id, r)); // Local overrides if present

      const combined = Array.from(reportMap.values()).sort((a, b) => {
        const timeA = a.submittedAt || a.createdAt || 0;
        const timeB = b.submittedAt || b.createdAt || 0;
        return timeB - timeA;
      });
      setReports(combined);
    } catch {
      setReports(serverMapped);
    }
  }, [tenantSlug]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadReports(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadReports]);

  const handleResolveConflict = async (choice: 'keep_local' | 'use_server') => {
    if (!selectedConflictReport) return;
    const syncManager = new SyncManager(tenantSlug);
    await syncManager.resolveConflict(selectedConflictReport.id, choice);
    setSelectedConflictReport(null);
    await loadReports();
  };

  const filteredReports = reports.filter((report) => {
    if (selectedSubunit !== 'ALL' && report.subunit !== selectedSubunit) return false;
    if (selectedStatus !== 'ALL' && report.status !== selectedStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const textMatch = report.textContent?.toLowerCase().includes(q);
      const subMatch = report.subunit.toLowerCase().includes(q);
      return textMatch || subMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Subunit Operational Reports History</h1>
          <p className="text-xs text-slate-400">View, search, and manage all subunit submissions across tenant</p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports or subunits..."
            className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Subunit:
          </span>
          {subunits.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubunit(sub)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedSubunit === sub
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900/70 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-2">Sync Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="SYNCED">Synced Cloud</option>
            <option value="SUBMITTED">Submitted / Draft</option>
            <option value="CONFLICT">Sync Conflict</option>
          </select>
        </div>
      </div>

      {/* Reports List Grid */}
      {filteredReports.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No reports found matching your filter criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="glass-panel p-6 rounded-3xl border border-slate-800/90 hover:border-blue-500/40 transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold rounded-full uppercase">
                      {report.subunit}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      {report.reportType}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500">
                    {new Date(report.submittedAt || report.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {report.textContent || report.imageDescription || 'Audio voice submission recorded.'}
                </p>

                {report.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-800 max-h-48">
                    <img src={report.imageUrl} alt="Report evidence" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Version {report.version || 1}</span>

                {report.status === 'CONFLICT' ? (
                  <button
                    onClick={() => setSelectedConflictReport(report)}
                    className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-500/30 transition-colors animate-pulse"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Resolve Conflict
                  </button>
                ) : report.status === 'SYNCED' ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Synced
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5" /> Pending Sync
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conflict Resolution Modal Trigger */}
      {selectedConflictReport && (
        <ConflictModal
          report={selectedConflictReport}
          onResolve={handleResolveConflict}
          onClose={() => setSelectedConflictReport(null)}
        />
      )}
    </div>
  );
}
