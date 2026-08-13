import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await getSession();

  if (!session) redirect('/login');
  if (session.membership.role !== 'ADMIN' && session.membership.role !== 'SYSTEM_ADMIN') {
    redirect(`/${tenantSlug}/dashboard`);
  }

  return children;
}
