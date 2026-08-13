import Dexie, { Table } from 'dexie';

export interface LocalReport {
  id: string;
  userId: string;
  tenantId: string;
  subunit: string;
  reportType: 'TEXT' | 'VOICE' | 'IMAGE';
  textContent?: string;
  imageUrl?: string;
  imageDescription?: string;
  audioUrl?: string;
  tags?: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'SYNCED' | 'CONFLICT';
  version: number;
  syncedAt?: number;
  submittedAt?: number;
  createdAt: number;
  updatedAt: number;
  // Conflict details if status === 'CONFLICT'
  serverVersion?: ServerReportSnapshot;
  clientVersion?: LocalReport;
}

export type ServerReportSnapshot = Omit<LocalReport, 'createdAt' | 'updatedAt'> & {
  createdAt: number | string;
  updatedAt: number | string;
};

export interface SyncQueueItem {
  id?: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  reportId: string;
  tenantId: string;
  data: LocalReport;
  timestamp: number;
  retries: number;
}

export interface OfflineQuarterlyReport {
  id: string;
  tenantId: string;
  title: string;
  startDate: string;
  endDate: string;
  content: string;
  downloadedAt: number;
  blob?: Blob;
}

export class ReportAppOfflineDB extends Dexie {
  reports!: Table<LocalReport, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  quarterlyReports!: Table<OfflineQuarterlyReport, string>;

  constructor(tenantId: string = 'default') {
    super(`reportapp_${tenantId}`);

    this.version(1).stores({
      reports: 'id, userId, subunit, status, submittedAt, createdAt',
      syncQueue: '++id, reportId, tenantId, action, timestamp',
      quarterlyReports: 'id, tenantId, downloadedAt',
    });
  }
}

// Map of active tenant DB instances
const dbInstances = new Map<string, ReportAppOfflineDB>();

export function getOfflineDB(tenantId: string): ReportAppOfflineDB {
  if (typeof window === 'undefined') {
    // SSR fallback dummy object
    return new ReportAppOfflineDB('ssr');
  }

  if (!dbInstances.has(tenantId)) {
    dbInstances.set(tenantId, new ReportAppOfflineDB(tenantId));
  }
  return dbInstances.get(tenantId)!;
}
