import { redirect } from 'next/navigation';
import { AccountSecurityPanel } from '@/components/auth/AccountSecurityPanel';
import { getCurrentUser } from '@/lib/auth/session';
import { getHomePathForRole } from '@/lib/auth/roles';

export const metadata = {
  title: 'Sécurité du compte | Resacolo'
};

type SecurityAction = 'menu' | 'password' | 'email';

function normalizeAction(value: string | undefined): SecurityAction {
  if (value === 'password' || value === 'email') return value;
  return 'menu';
}

export default async function AccountSecurityPage({
  searchParams
}: {
  searchParams?: Promise<{ action?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/login?redirectTo=/compte/securite');
  }

  const params = searchParams ? await searchParams : {};
  const action = normalizeAction(params.action);
  const backHref = getHomePathForRole(session.role);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Compte</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Sécurité</h1>
          <p className="mt-1 text-sm text-slate-600">
            Connecté en tant que <span className="font-medium text-slate-800">{session.email}</span>
          </p>
          <a
            href={backHref}
            className="mt-3 inline-flex text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            ← Retour à mon espace
          </a>
        </div>
        <AccountSecurityPanel currentEmail={session.email} action={action} />
      </div>
    </div>
  );
}
