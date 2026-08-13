import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import TenantShell from '@/components/tenant/TenantShell';

export default async function TenantLayout({
  children,
  params,
}: LayoutProps<'/[tenantSlug]'>) {
  const { tenantSlug } = await params;
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.tenant.slug !== tenantSlug) {
    redirect(`/${session.tenant.slug}/dashboard`);
  }

  return (
    <TenantShell
      tenantSlug={tenantSlug}
      user={{
        name: session.user.name,
        role: session.membership.role,
      }}
      tenant={session.tenant}
    >
      {children}
    </TenantShell>
  );
}
