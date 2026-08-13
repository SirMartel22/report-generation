import type { LocalReport } from '@/lib/offline/db';

function parseTags(value: unknown): string[] {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) && parsed.every((tag) => typeof tag === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export function mapServerReport(value: unknown): LocalReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as Record<string, unknown>;
  if (
    typeof report.id !== 'string' ||
    typeof report.userId !== 'string' ||
    typeof report.tenantId !== 'string' ||
    typeof report.subunit !== 'string'
  ) {
    return null;
  }

  const reportType =
    report.reportType === 'VOICE' || report.reportType === 'IMAGE' ? report.reportType : 'TEXT';
  const createdAt = new Date(String(report.createdAt)).getTime();
  const updatedAt = new Date(String(report.updatedAt)).getTime();
  const submittedAt = new Date(String(report.submittedAt || report.createdAt)).getTime();

  return {
    id: report.id,
    userId: report.userId,
    tenantId: report.tenantId,
    subunit: report.subunit,
    reportType,
    textContent: typeof report.textContent === 'string' ? report.textContent : undefined,
    imageUrl: typeof report.imageUrl === 'string' ? report.imageUrl : undefined,
    imageDescription:
      typeof report.imageDescription === 'string' ? report.imageDescription : undefined,
    audioUrl: typeof report.audioUrl === 'string' ? report.audioUrl : undefined,
    tags: parseTags(report.tags),
    status: 'SYNCED',
    version: typeof report.version === 'number' ? report.version : 1,
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    submittedAt: Number.isNaN(submittedAt) ? undefined : submittedAt,
  };
}
