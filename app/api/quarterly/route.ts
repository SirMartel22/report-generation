import { NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth/session';
import { db } from '@/lib/db/prisma';
import { summarizeQuarterlyReport } from '@/lib/ai/gemma';

export async function GET(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quarterlyReports = await db.quarterlyReportGeneration.findMany({
      where: { tenantId: session.tenant.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ quarterlyReports });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load quarterly reports' },
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
    const { startDate, endDate, subunits, formats } = body;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch reports in range
    const reports = await db.report.findMany({
      where: {
        tenantId: session.tenant.id,
        isDeleted: false,
        submittedAt: {
          gte: start,
          lte: end,
        },
        subunit: {
          in: subunits && subunits.length > 0 ? subunits : undefined,
        },
      },
      include: {
        user: { select: { name: true } },
      },
    });

    const aiSummary = await summarizeQuarterlyReport({
      tenantName: session.tenant.name,
      startDate: start.toLocaleDateString(),
      endDate: end.toLocaleDateString(),
      subunits: subunits || ['All Subunits'],
      rawReports: reports.map((r) => ({
        subunit: r.subunit,
        reportType: r.reportType,
        textContent: r.textContent || undefined,
        imageDescription: r.imageDescription || undefined,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : r.createdAt.toISOString(),
        user: r.user?.name,
      })),
    });

    const quarterlyDoc = await db.quarterlyReportGeneration.create({
      data: {
        generatedBy: session.user.id,
        tenantId: session.tenant.id,
        startDate: start,
        endDate: end,
        subunits: JSON.stringify(subunits || []),
        reportFormat: JSON.stringify(formats || ['PDF']),
        content: aiSummary,
        totalReportsIncluded: reports.length,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, quarterlyReport: quarterlyDoc });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to generate quarterly report' },
      { status: 500 },
    );
  }
}
