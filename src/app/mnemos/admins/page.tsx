import { requireRole } from '@/lib/auth/require';
import { PASSWORD_POLICY_HTML_PATTERN, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { MnemosFieldLabel } from '@/components/mnemos/MnemosFieldLabel';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Sp = {
  error?: string;
  success?: string;
};

function normalizeVisibleStaffRole(rawRole: string | null | undefined) {
  const normalized = String(rawRole ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!normalized || normalized.includes('MNEMOS')) return null;
  if (normalized === 'SALES_ADMIN' || normalized === 'ADMIN_SALES') return 'ADMIN_SALES' as const;
  if (normalized === 'ADMIN' || normalized.includes('SUPPORT') || normalized.includes('PLATFORM_ADMIN')) {
    return 'ADMIN' as const;
  }
  if (normalized.includes('ADMIN')) return 'ADMIN' as const;
  return null;
}

function splitFullName(fullName: string | null | undefined) {
  const normalized = String(fullName ?? '').trim();
  if (!normalized) return { firstName: '—', lastName: '' };
  const [firstName, ...rest] = normalized.split(/\s+/);
  return { firstName: firstName || '—', lastName: rest.join(' ').trim() };
}

export default async function MnemosAdminsPage({
  searchParams
}: {
  searchParams?: Promise<Sp>;
}) {
  await requireRole('MNEMOS');
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();

  const { data: staffUsersRaw } = await supabase
    .from('staff_users')
    .select('user_id,role,created_at')
    .order('created_at', { ascending: false });

  const adminUsers = (staffUsersRaw ?? [])
    .map((row) => ({ ...row, role: normalizeVisibleStaffRole(row.role) }))
    .filter((row): row is typeof row & { role: 'ADMIN' } => row.role === 'ADMIN');

  const authUsersById = new Map(
    await Promise.all(
      adminUsers.map(async (row) => {
        const { data } = await supabase.auth.admin.getUserById(row.user_id);
        return [row.user_id, data.user ?? null] as const;
      })
    )
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Comptes admin</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Créez des comptes administrateurs Resacolo (rôle ADMIN) depuis Mnemos. Ils pourront accéder à
          l&apos;espace <code className="text-slate-300">/admin</code>.
        </p>
      </div>

      {sp.error ? (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {decodeURIComponent(sp.error)}
        </div>
      ) : null}

      {sp.success === 'staff-user-created' ? (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          Compte administrateur créé.
        </div>
      ) : null}

      <form
        action="/api/admin/staff-users"
        method="post"
        className="max-w-xl space-y-4 rounded-xl border border-slate-700 bg-slate-900/50 p-5"
      >
        <input type="hidden" name="redirect_to" value="/mnemos/admins" />
        <input type="hidden" name="role" value="ADMIN" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">
            <MnemosFieldLabel>Prénom</MnemosFieldLabel>
            <input
              name="first_name"
              required
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-sm text-slate-300">
            <MnemosFieldLabel>Nom</MnemosFieldLabel>
            <input
              name="last_name"
              required
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <label className="block text-sm text-slate-300">
          <MnemosFieldLabel>E-mail</MnemosFieldLabel>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-sm text-slate-300">
          <MnemosFieldLabel>Mot de passe temporaire</MnemosFieldLabel>
          <input
            name="temp_password"
            type="password"
            required
            pattern={PASSWORD_POLICY_HTML_PATTERN}
            title={PASSWORD_POLICY_MESSAGE}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <p className="mt-1 text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Créer le compte admin
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Admins existants</h2>
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Nom</th>
                <th className="px-4 py-3 font-semibold">E-mail</th>
                <th className="px-4 py-3 font-semibold">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {adminUsers.map((row) => {
                const user = authUsersById.get(row.user_id);
                const fullName =
                  String(user?.user_metadata?.full_name ?? '').trim() ||
                  String(user?.user_metadata?.name ?? '').trim() ||
                  null;
                const { firstName, lastName } = splitFullName(fullName);
                return (
                  <tr key={row.user_id}>
                    <td className="px-4 py-3 text-slate-200">
                      {firstName} {lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{user?.email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(row.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                );
              })}
              {adminUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    Aucun compte admin pour le moment.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
