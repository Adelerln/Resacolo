import { AccountSecurityPanel } from '@/components/auth/AccountSecurityPanel';
import { requirePartner } from '@/lib/auth/require';

export const metadata = {
  title: 'Sécurité du compte'
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SecurityAction = 'menu' | 'password' | 'email';

function normalizeAction(value: string | undefined): SecurityAction {
  if (value === 'password' || value === 'email') return value;
  return 'menu';
}

export default async function PartenaireSecurityPage({
  searchParams
}: {
  searchParams?: Promise<{ action?: string }>;
}) {
  const session = await requirePartner();
  const resolved = searchParams ? await searchParams : undefined;
  const action = normalizeAction(resolved?.action);
  const basePath = '/partenaire/securite';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Sécurité du compte</h1>
        <p className="admin-page-subtitle mt-1">
          Connecté en tant que <span className="font-medium text-slate-800">{session.email}</span>.
          Modifiez votre mot de passe ou votre e-mail.
        </p>
      </div>
      <AccountSecurityPanel
        currentEmail={session.email}
        action={action}
        basePath={basePath}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      />
    </div>
  );
}
