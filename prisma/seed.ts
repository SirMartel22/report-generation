import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create primary tenant (BHBC Media Ministry)
  const bhbcTenant = await prisma.tenant.upsert({
    where: { slug: 'bhbc' },
    update: {},
    create: {
      slug: 'bhbc',
      name: 'BHBC Media Ministry',
      domain: 'bhbc.reportapp.com',
      subscriptionTier: 'pro',
      brandColor: '#2563eb',
      subunitNames: JSON.stringify(['Livestream', 'Socials', 'Videography', 'Photography']),
    },
  });
  console.log('✅ Created Tenant:', bhbcTenant.name);

  // Create demo admin user
  const hashedPassword = await bcrypt.hash('password123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@bhbc.org' },
    update: {},
    create: {
      email: 'admin@bhbc.org',
      passwordHash: hashedPassword,
      name: 'Pastor David (Admin)',
      globalRole: 'USER',
    },
  });

  // Create admin membership
  await prisma.userTenantMembership.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: bhbcTenant.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      tenantId: bhbcTenant.id,
      role: 'ADMIN',
    },
  });
  console.log('✅ Created Admin User:', adminUser.email);

  // Create Subunit Head user (Livestream)
  const subunitHead = await prisma.user.upsert({
    where: { email: 'livestream@bhbc.org' },
    update: {},
    create: {
      email: 'livestream@bhbc.org',
      passwordHash: hashedPassword,
      name: 'Sarah Jenkins (Livestream Lead)',
      globalRole: 'USER',
    },
  });

  await prisma.userTenantMembership.upsert({
    where: {
      userId_tenantId: {
        userId: subunitHead.id,
        tenantId: bhbcTenant.id,
      },
    },
    update: {},
    create: {
      userId: subunitHead.id,
      tenantId: bhbcTenant.id,
      role: 'SUBUNIT_HEAD',
      subunit: 'Livestream',
    },
  });
  console.log('✅ Created Subunit Head User:', subunitHead.email);

  // Create Subscription record
  await prisma.subscription.upsert({
    where: { tenantId: bhbcTenant.id },
    update: {},
    create: {
      tenantId: bhbcTenant.id,
      plan: 'pro',
      maxUsers: 50,
      maxReportsPerMonth: 5000,
      maxOfflineCacheReports: 20,
      features: JSON.stringify(['offline_sync', 'push_notifications', 'gemma_ai', 'pdf_export']),
    },
  });

  // Create sample reports
  const sampleReports = [
    {
      userId: subunitHead.id,
      tenantId: bhbcTenant.id,
      subunit: 'Livestream',
      reportType: 'TEXT',
      textContent: 'Sunday Service Livestream reached 450 concurrent viewers across YouTube and Facebook. Peak engagement during worship set. Audio bit rate remained steady at 320kbps with zero frame drops.',
      status: 'SUBMITTED',
      tags: JSON.stringify(['SundayService', 'Livestream', 'Metrics']),
      submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      userId: subunitHead.id,
      tenantId: bhbcTenant.id,
      subunit: 'Socials',
      reportType: 'IMAGE',
      textContent: 'Weekly Instagram highlights clip reached 2.4k views. Graphic posts performed 35% higher than average.',
      imageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=800',
      imageDescription: 'Engagement dashboard graphic showing total impressions of 12,400 across Instagram and Facebook for Q3 week 4.',
      status: 'SUBMITTED',
      tags: JSON.stringify(['Socials', 'Instagram', 'Metrics']),
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      userId: subunitHead.id,
      tenantId: bhbcTenant.id,
      subunit: 'Videography',
      reportType: 'VOICE',
      textContent: 'Voice recording transcribed by Gemma AI: Captured b-roll of youth retreat event on Saturday. Edited trailer draft is 90% ready for review.',
      audioUrl: '/audio/sample_voice_report.mp3',
      status: 'SUBMITTED',
      tags: JSON.stringify(['YouthRetreat', 'VideoTrailer']),
      submittedAt: new Date(),
    },
  ];

  for (const rep of sampleReports) {
    await prisma.report.create({ data: rep });
  }

  console.log('✅ Created Sample Reports');
  console.log('🌱 Database Seeding Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
