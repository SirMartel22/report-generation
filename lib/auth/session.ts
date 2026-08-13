import 'server-only';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/prisma';
import { UserTokenPayload, verifyToken } from '@/lib/auth/jwt';

export const SESSION_COOKIE_NAME = 'reportapp_session';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface AuthorizedSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  membership: {
    role: string;
    subunit: string | null;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    brandColor: string;
    subscriptionTier: string;
    subunitNames: string[];
  };
}

function parseSubunits(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
      ? parsed
      : [];
  } catch {
    return [];
  }
}

async function resolveSession(payload: UserTokenPayload | null): Promise<AuthorizedSession | null> {
  if (!payload) return null;

  const membership = await db.userTenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId: payload.userId,
        tenantId: payload.tenantId,
      },
    },
    include: {
      user: true,
      tenant: true,
    },
  });

  if (!membership || membership.tenant.deletedAt) return null;

  return {
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
    },
    membership: {
      role: membership.role,
      subunit: membership.subunit,
    },
    tenant: {
      id: membership.tenant.id,
      slug: membership.tenant.slug,
      name: membership.tenant.name,
      brandColor: membership.tenant.brandColor,
      subscriptionTier: membership.tenant.subscriptionTier,
      subunitNames: parseSubunits(membership.tenant.subunitNames),
    },
  };
}

export async function getSession(): Promise<AuthorizedSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return resolveSession(token ? verifyToken(token) : null);
}

export async function getRequestSession(request: Request): Promise<AuthorizedSession | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const token = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  return resolveSession(token ? verifyToken(decodeURIComponent(token)) : null);
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: 'high',
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
