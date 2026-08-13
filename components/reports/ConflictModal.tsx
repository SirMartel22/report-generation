'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, Server, HardDrive } from 'lucide-react';
import { LocalReport } from '@/lib/offline/db';

interface ConflictModalProps {
  report: LocalReport;
  onResolve: (choice: 'keep_local' | 'use_server') => Promise<void>;
  onClose: () => void;
}

export default function ConflictModal({ report, onResolve, onClose }: ConflictModalProps) {
  const [loading, setLoading] = useState(false);

  const handleChoice = async (choice: 'keep_local' | 'use_server') => {
    setLoading(true);
    try {
      await onResolve(choice);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const serverContent = report.serverVersion?.textContent || 'No content';
  const clientContent = report.clientVersion?.textContent || report.textContent || 'No content';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Sync Conflict Detected</h3>
            <p className="text-sm text-slate-400">
              This report was edited on another device while you were offline. Please choose which version to keep.
            </p>
          </div>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Local Device Version */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4" />
                Your Local Version
              </span>
              <span className="text-[10px] text-slate-500">Updated offline</span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-lg text-xs text-slate-200 font-mono min-h-[120px] max-h-[200px] overflow-y-auto whitespace-pre-wrap border border-slate-800">
              {clientContent}
            </div>
            <button
              disabled={loading}
              onClick={() => handleChoice('keep_local')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              Keep My Version
            </button>
          </div>

          {/* Server Version */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                <Server className="w-4 h-4" />
                Server Version
              </span>
              <span className="text-[10px] text-slate-500">Latest from cloud</span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-lg text-xs text-slate-200 font-mono min-h-[120px] max-h-[200px] overflow-y-auto whitespace-pre-wrap border border-slate-800">
              {serverContent}
            </div>
            <button
              disabled={loading}
              onClick={() => handleChoice('use_server')}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              Use Server Version
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
