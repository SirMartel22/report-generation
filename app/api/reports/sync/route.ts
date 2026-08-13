import { NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth/session';
import { db } from '@/lib/db/prisma';

interface SyncReportData {
  id: string;
  subunit?: string;
  reportType?: string;
  textContent?: string;
  imageUrl?: string;
  imageDescription?: string;
  audioUrl?: string;
  tags?: string[];
  version?: number;
  submittedAt?: number | string;
}

interface SyncItem {
  data?: SyncReportData;
}

export async function POST(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { items?: SyncItem[] };
    const items = Array.isArray(body.items) ? body.items : [];
    const syncedIds: string[] = [];
    const conflicts: Array<{ id: string; serverVersion: unknown; clientVersion: SyncReportData }> = [];
    const errors: Array<{ id: string; message: string }> = [];

    for (const item of items) {
      const data = item.data;
      if (!data?.id) continue;

      const canSubmitToSubunit =
        Boolean(data.subunit && session.tenant.subunitNames.includes(data.subunit)) &&
        (session.membership.role !== 'SUBUNIT_HEAD' || session.membership.subunit === data.subunit);
      if (!data.subunit || !canSubmitToSubunit) {
        errors.push({ id: data.id, message: 'Invalid tenant subunit' });
        continue;
      }

      try {
        const existing = await db.report.findFirst({
          where: { id: data.id, tenantId: session.tenant.id },
        });

        if (!existing) {
          await db.report.create({
            data: {
              id: data.id,
              userId: session.user.id,
              tenantId: session.tenant.id,
              subunit: data.subunit,
              reportType: data.reportType || 'TEXT',
              textContent: data.textContent,
              imageUrl: data.imageUrl,
              imageDescription: data.imageDescription,
              audioUrl: data.audioUrl,
              tags: JSON.stringify(Array.isArray(data.tags) ? data.tags : []),
              status: 'SUBMITTED',
              version: 1,
              syncedAt: new Date(),
              submittedAt: new Date(data.submittedAt || Date.now()),
            },
          });
          syncedIds.push(data.id);
        } else if (data.version && data.version < existing.version) {
          conflicts.push({ id: data.id, serverVersion: existing, clientVersion: data });
        } else {
          await db.report.update({
            where: { id: existing.id },
            data: {
              textContent: data.textContent ?? existing.textContent,
              imageDescription: data.imageDescription ?? existing.imageDescription,
              status: 'SUBMITTED',
              version: existing.version + 1,
              syncedAt: new Date(),
            },
          });
          syncedIds.push(data.id);
        }
      } catch (error: unknown) {
        errors.push({
          id: data.id,
          message: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }

    return NextResponse.json({ success: errors.length === 0, syncedIds, conflicts, errors });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to synchronize reports' },
      { status: 500 },
    );
  }
}
