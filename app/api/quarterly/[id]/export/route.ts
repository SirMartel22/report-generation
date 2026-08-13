import { NextResponse } from 'next/server';
import { db } from '@/lib/db/prisma';
import { generateQuarterlyPDF } from '@/lib/export/pdfGenerator';
import { generateQuarterlyDocx } from '@/lib/export/docxGenerator';
import { getRequestSession } from '@/lib/auth/session';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'pdf').toLowerCase();

    const quarterlyReport = await db.quarterlyReportGeneration.findUnique({
      where: { id },
      include: {
        tenant: true,
      },
    });

    if (!quarterlyReport) {
      return NextResponse.json({ error: 'Quarterly Report not found' }, { status: 404 });
    }

    if (quarterlyReport.tenantId !== session.tenant.id) {
      return NextResponse.json({ error: 'Quarterly Report not found' }, { status: 404 });
    }

    const tenantName = quarterlyReport.tenant?.name || 'Organization';
    const dateRange = `${new Date(quarterlyReport.startDate).toLocaleDateString()} - ${new Date(quarterlyReport.endDate).toLocaleDateString()}`;
    const title = `Quarterly Report (${dateRange})`;

    if (format === 'docx' || format === 'word') {
      const buffer = await generateQuarterlyDocx(title, tenantName, dateRange, quarterlyReport.content);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="Quarterly_Report_${id.substring(0, 8)}.docx"`,
        },
      });
    }

    // Default to PDF
    const pdfBytes = await generateQuarterlyPDF(title, tenantName, dateRange, quarterlyReport.content);
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Quarterly_Report_${id.substring(0, 8)}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to export report' },
      { status: 500 },
    );
  }
}
