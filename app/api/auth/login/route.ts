import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/prisma';
import { signToken } from '@/lib/auth/jwt';
import { setSessionCookie } from '@/lib/auth/session';

function isRole(role: string): role is 'ADMIN' | 'SUBUNIT_HEAD' | 'SYSTEM_ADMIN' {
  return role === 'ADMIN' || role === 'SUBUNIT_HEAD' || role === 'SYSTEM_ADMIN';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required.' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (!user.memberships || user.memberships.length === 0) {
      return NextResponse.json({ error: 'User does not belong to any tenant.' }, { status: 403 });
    }

    // Default to first membership
    const membership = user.memberships[0];

    if (!isRole(membership.role)) {
      return NextResponse.json({ error: 'Invalid tenant role.' }, { status: 403 });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
      subunit: membership.subunit,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: membership.role,
        subunit: membership.subunit,
      },
      tenant: {
        id: membership.tenant.id,
        slug: membership.tenant.slug,
        name: membership.tenant.name,
        brandColor: membership.tenant.brandColor,
        subscriptionTier: membership.tenant.subscriptionTier,
      },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error: unknown) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed' },
      { status: 500 },
    );
  }
}
