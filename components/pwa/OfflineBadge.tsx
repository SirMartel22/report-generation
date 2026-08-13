'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { getOfflineDB } from '@/lib/offline/db';

export default function OfflineBadge({ tenantId }: { tenantId: string }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const updateStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Check pending count in Dexie
    const checkQueue = async () => {
      try {
        const db = getOfflineDB(tenantId);
        const count = await db.syncQueue.count();
        setPendingCount(count);
      } catch (err) {
        // ignore
      }
    };

    checkQueue();
    const interval = setInterval(checkQueue, 3000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, [tenantId]);

  return (
    <div className="flex items-center gap-2">
      {isOnline ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Wifi className="w-3.5 h-3.5" />
          Online
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
          <WifiOff className="w-3.5 h-3.5" />
          Offline Mode
        </span>
      )}

      {pendingCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <RefreshCw className="w-3 h-3 animate-spin" />
          {pendingCount} pending sync
        </span>
      )}
    </div>
  );
}
