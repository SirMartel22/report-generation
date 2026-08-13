import { NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth/session';

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      ...session.user,
      role: session.membership.role,
      subunit: session.membership.subunit,
    },
    tenant: session.tenant,
  });
}
