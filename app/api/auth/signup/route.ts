import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/prisma';
import { signToken } from '@/lib/auth/jwt';
import { setSessionCookie } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, tenantName, tenantSlug } = body;

    if (!email || !password || !name || !tenantName || !tenantSlug) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const slugClean = tenantSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');

    // Check if slug or email exists
    const existingTenant = await db.tenant.findUnique({ where: { slug: slugClean } });
    if (existingTenant) {
      return NextResponse.json({ error: 'Tenant URL slug already taken.' }, { status: 409 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create Tenant
    const tenant = await db.tenant.create({
      data: {
        slug: slugClean,
        name: tenantName,
        domain: `${slugClean}.reportapp.com`,
        subscriptionTier: 'free',
        subunitNames: JSON.stringify(['Livestream', 'Socials', 'Videography', 'Photography']),
      },
    });

    // Create Subscription
    await db.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: 'free',
        maxUsers: 5,
        maxReportsPerMonth: 50,
      },
    });

    // Create User
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashedPassword,
        name,
      },
    });

    // Create Membership as Admin
    await db.userTenantMembership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: 'ADMIN',
      },
    });

    // Sign Token
    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: 'ADMIN',
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error: unknown) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed' },
      { status: 500 },
    );
  }
}
