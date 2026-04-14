import { requireRole } from '@/lib/auth/require';
import { ORGANIZER_ACCESS_ROLE_VALUES } from '@/lib/organizer-access';

type PageProps = { params: Promise<{ id: string }>; searchParams?: { error?: string } };

export default async function AdminOrganizerMemberNewPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  await requireRole('ADMIN');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ajouter un membre</h1>
        <p className="text-sm text-slate-600">Créer ou lier un utilisateur à cet organisme.</p>
      </div>

      {searchParams?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      <form
        action={`/api/admin/organizers/${params.id}/members`}
        method="post"
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Prénom
            <input
              name="first_name"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Nom
            <input
              name="last_name"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Mot de passe temporaire (si création)
          <input
            name="temp_password"
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Rôle
          <select
            name="role"
            defaultValue="EDITOR"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {ORGANIZER_ACCESS_ROLE_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Ajouter
        </button>
      </form>
    </div>
  );
}
