import { getOfflineDB, LocalReport } from './db';

interface SyncConflict {
  id: string;
  serverVersion: unknown;
  clientVersion: unknown;
}

export class SyncManager {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Submit report locally first, then sync if online.
   */
  async submitReport(reportData: Partial<LocalReport>): Promise<{ report: LocalReport; synced: boolean; conflict?: boolean }> {
    const db = getOfflineDB(this.tenantId);
    const now = Date.now();
    const id = reportData.id || crypto.randomUUID();

    const localReport: LocalReport = {
      id,
      userId: reportData.userId || 'anonymous',
      tenantId: this.tenantId,
      subunit: reportData.subunit || 'General',
      reportType: reportData.reportType || 'TEXT',
      textContent: reportData.textContent,
      imageUrl: reportData.imageUrl,
      imageDescription: reportData.imageDescription,
      audioUrl: reportData.audioUrl,
      tags: reportData.tags || [],
      status: navigator.onLine ? 'SUBMITTED' : 'DRAFT',
      version: reportData.version || 1,
      createdAt: reportData.createdAt || now,
      updatedAt: now,
      submittedAt: now,
    };

    // Save to IndexedDB
    await db.reports.put(localReport);

    // Queue for sync
    await db.syncQueue.add({
      action: 'CREATE',
      reportId: id,
      tenantId: this.tenantId,
      data: localReport,
      timestamp: now,
      retries: 0,
    });

    // If online, trigger immediate sync
    if (typeof window !== 'undefined' && navigator.onLine) {
      const syncResult = await this.syncPendingQueue();
      const updated = await db.reports.get(id);
      return {
        report: updated || localReport,
        synced: syncResult.synced > 0,
        conflict: syncResult.conflicts.length > 0,
      };
    }

    return { report: localReport, synced: false };
  }

  /**
   * Process pending items in sync queue
   */
  async syncPendingQueue(): Promise<{ synced: number; failed: number; conflicts: SyncConflict[] }> {
    if (typeof window === 'undefined' || !navigator.onLine) {
      return { synced: 0, failed: 0, conflicts: [] };
    }

    const db = getOfflineDB(this.tenantId);
    const queue = await db.syncQueue.toArray();

    if (queue.length === 0) {
      return { synced: 0, failed: 0, conflicts: [] };
    }

    const results = { synced: 0, failed: 0, conflicts: [] as SyncConflict[] };

    for (const item of queue) {
      try {
        const response = await fetch('/api/reports/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items: [item] }),
        });

        if (response.ok) {
          const body = await response.json();
          if (body.syncedIds?.includes(item.reportId)) {
            // Remove from queue
            if (item.id) await db.syncQueue.delete(item.id);

            // Mark local report as SYNCED
            const local = await db.reports.get(item.reportId);
            if (local) {
              await db.reports.put({
                ...local,
                status: 'SYNCED',
                syncedAt: Date.now(),
              });
            }
            results.synced++;
          }

          if (body.conflicts && body.conflicts.length > 0) {
            for (const conflict of body.conflicts) {
              const local = await db.reports.get(conflict.id);
              if (local) {
                await db.reports.put({
                  ...local,
                  status: 'CONFLICT',
                  serverVersion: conflict.serverVersion,
                  clientVersion: conflict.clientVersion,
                });
                results.conflicts.push(conflict);
              }
            }
          }
        } else if (response.status === 409) {
          const conflictData = await response.json();
          const local = await db.reports.get(item.reportId);
          if (local) {
            await db.reports.put({
              ...local,
              status: 'CONFLICT',
              serverVersion: conflictData.serverVersion,
              clientVersion: item.data,
            });
            results.conflicts.push({
              id: item.reportId,
              serverVersion: conflictData.serverVersion,
              clientVersion: item.data,
            });
          }
          if (item.id) await db.syncQueue.delete(item.id);
        } else {
          item.retries++;
          if (item.retries < 5 && item.id) {
            await db.syncQueue.put(item);
          }
          results.failed++;
        }
      } catch {
        item.retries++;
        if (item.retries < 5 && item.id) {
          await db.syncQueue.put(item);
        }
        results.failed++;
      }
    }

    return results;
  }

  /**
   * User resolves conflict manually
   */
  async resolveConflict(reportId: string, choice: 'keep_local' | 'use_server' | 'merge'): Promise<void> {
    const db = getOfflineDB(this.tenantId);
    const local = await db.reports.get(reportId);
    if (!local) return;

    if (choice === 'keep_local') {
      const updatedLocal: LocalReport = {
        ...(local.clientVersion || local),
        status: 'SUBMITTED',
        version: (local.serverVersion?.version || 1) + 1,
        updatedAt: Date.now(),
      };
      delete updatedLocal.serverVersion;
      delete updatedLocal.clientVersion;

      await db.reports.put(updatedLocal);
      await this.submitReport(updatedLocal);
    } else if (choice === 'use_server') {
      if (local.serverVersion) {
        const serverReport: LocalReport = {
          ...local.serverVersion,
          status: 'SYNCED',
          syncedAt: Date.now(),
          createdAt: new Date(local.serverVersion.createdAt).getTime(),
          updatedAt: new Date(local.serverVersion.updatedAt).getTime(),
        };
        await db.reports.put(serverReport);
      }
    }
  }
}
