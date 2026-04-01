import { requireRole } from '@/lib/auth/require';

type PageProps = { searchParams?: { error?: string } };

export default async function AdminOrganizerNewPage({ searchParams }: PageProps) {
  requireRole('ADMIN');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Créer un organisateur</h1>
        <p className="text-sm text-slate-600">Créer un organisme et son compte principal.</p>
      </div>

      {searchParams?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      <form
        action="/api/admin/organizers"
        method="post"
        encType="multipart/form-data"
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Organisme</h2>
          <label className="block text-sm font-medium text-slate-700">
            Nom de l’organisateur
            <input
              name="name"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email de contact
            <input
              name="contact_email"
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Année de création
            <input
              name="founded_year"
              type="number"
              min="1900"
              max="2100"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Âge min
              <input
                name="age_min"
                type="number"
                min="0"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Âge max
              <input
                name="age_max"
                type="number"
                min="0"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Texte de présentation
            <textarea
              name="description"
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Logo (PNG/JPG)
            <input
              name="logo"
              type="file"
              accept="image/*"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Projet éducatif (PDF)
            <input
              name="education_project"
              type="file"
              accept="application/pdf"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Compte principal</h2>
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
            Email du premier utilisateur
            <input
              name="user_email"
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mot de passe temporaire
            <input
              name="temp_password"
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
        </div>

        <div className="flex items-center justify-start gap-3 sm:justify-end">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Créer
          </button>
        </div>
      </form>
    </div>
  );
}
