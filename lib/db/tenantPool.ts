import { db } from './prisma';
import type { Prisma } from '@prisma/client';

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  subscriptionTier: string;
  subunitNames: string[];
}

/**
 * Retrieves the tenant record by slug or domain or ID, ensuring tenant isolation.
 */
export async function getTenantContext(tenantIdentifier: string): Promise<TenantContext | null> {
  const tenant = await db.tenant.findFirst({
    where: {
      OR: [
        { slug: tenantIdentifier },
        { id: tenantIdentifier },
        { domain: tenantIdentifier }
      ],
      deletedAt: null,
    },
  });

  if (!tenant) return null;

  let subunitNames: string[] = ["Livestream", "Socials", "Videography", "Photography"];
  try {
    if (tenant.subunitNames) {
      subunitNames = JSON.parse(tenant.subunitNames);
    }
  } catch {
    // fallback
  }

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    domain: tenant.domain,
    subscriptionTier: tenant.subscriptionTier,
    subunitNames,
  };
}

/**
 * Scoped query helper for tenant data isolation.
 */
export class TenantDatabaseClient {
  constructor(public tenantId: string) {}

  async getReports(filters?: { subunit?: string; status?: string; userId?: string }) {
    const whereClause: Prisma.ReportWhereInput = {
      tenantId: this.tenantId,
      isDeleted: false,
    };

    if (filters?.subunit) whereClause.subunit = filters.subunit;
    if (filters?.status) whereClause.status = filters.status;
    if (filters?.userId) whereClause.userId = filters.userId;

    return db.report.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });
  }

  async getReportById(id: string) {
    return db.report.findFirst({
      where: {
        id,
        tenantId: this.tenantId,
        isDeleted: false,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  async createReport(data: {
    id?: string;
    userId: string;
    subunit: string;
    reportType: string;
    textContent?: string;
    imageUrl?: string;
    imageDescription?: string;
    audioUrl?: string;
    tags?: string[];
    submittedAt?: Date;
    status?: string;
  }) {
    return db.report.create({
      data: {
        id: data.id,
        userId: data.userId,
        tenantId: this.tenantId,
        subunit: data.subunit,
        reportType: data.reportType,
        textContent: data.textContent,
        imageUrl: data.imageUrl,
        imageDescription: data.imageDescription,
        audioUrl: data.audioUrl,
        tags: JSON.stringify(data.tags || []),
        status: data.status || 'SUBMITTED',
        submittedAt: data.submittedAt || new Date(),
      }
    });
  }

  async updateReport(id: string, userId: string, data: {
    textContent?: string;
    imageDescription?: string;
    status?: string;
    version?: number;
  }) {
    // Check version
    const existing = await this.getReportById(id);
    if (!existing) throw new Error('Report not found');

    if (data.version && data.version < existing.version) {
      const conflictError = Object.assign(new Error('Conflict: Server has newer version'), {
        status: 409,
        serverVersion: existing,
      });
      throw conflictError;
    }

    return db.report.update({
      where: { id },
      data: {
        textContent: data.textContent !== undefined ? data.textContent : existing.textContent,
        imageDescription: data.imageDescription !== undefined ? data.imageDescription : existing.imageDescription,
        status: data.status !== undefined ? data.status : existing.status,
        version: existing.version + 1,
        syncedAt: new Date(),
      }
    });
  }

  async deleteReport(id: string, userId: string, reason?: string) {
    const report = await this.getReportById(id);
    if (!report) throw new Error('Report not found');

    await db.deletedReport.create({
      data: {
        reportId: id,
        userId: report.userId,
        deletedBy: userId,
        reason,
      }
    });

    return db.report.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      }
    });
  }
}
