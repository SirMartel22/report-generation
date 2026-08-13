import { NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth/session';
import { db } from '@/lib/db/prisma';

export async function GET(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subunit = searchParams.get('subunit');
    const status = searchParams.get('status');

    const reports = await db.report.findMany({
      where: {
        tenantId: session.tenant.id,
        isDeleted: false,
        ...(subunit && subunit !== 'ALL' ? { subunit } : {}),
        ...(status && status !== 'ALL' ? { status } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ reports });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load reports' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, subunit, reportType, textContent, imageUrl, imageDescription, audioUrl, tags } = body;

    if (!subunit || !session.tenant.subunitNames.includes(subunit)) {
      return NextResponse.json({ error: 'A valid tenant subunit is required.' }, { status: 400 });
    }

    const report = await db.report.create({
      data: {
        id: typeof id === 'string' ? id : undefined,
        userId: session.user.id,
        tenantId: session.tenant.id,
        subunit,
        reportType: reportType || 'TEXT',
        textContent,
        imageUrl,
        imageDescription,
        audioUrl,
        tags: JSON.stringify(Array.isArray(tags) ? tags : []),
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ report, success: true }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create report' },
      { status: 500 },
    );
  }
}
