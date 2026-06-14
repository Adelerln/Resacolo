import { PasswordInput } from '@/components/auth/PasswordInput';
import { requireAdminMutateSection } from '@/lib/auth/require';
import {
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_MIN_LENGTH
} from '@/lib/auth/password-policy';
import { PARTNER_OFFER_LABELS, PARTNER_OFFER_VALUES } from '@/lib/partner-offers';

type PageProps = { searchParams?: Promise<{ error?: string }> };

export default async function AdminPartnerNewPage({ searchParams }: PageProps) {
  await requireAdminMutateSection('partners');
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Créer un partenaire</h1>
        <p className="admin-page-subtitle mt-1">Créez la collectivité partenaire et son compte principal.</p>
      </div>

      {resolvedSearchParams?.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      <form action="/api/admin/partners" method="post" className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="space-y-4">
          <h2 className="admin-section-title text-base">Partenaire</h2>
          <label className="block text-sm font-medium text-slate-700">
            Nom du partenaire
            <input name="name" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Code de rattachement
            <input name="code" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 uppercase" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Offre
            <select name="offer_mode" defaultValue="IDENTITE" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
              {PARTNER_OFFER_VALUES.map((offer) => (
                <option key={offer} value={offer}>
                  {PARTNER_OFFER_LABELS[offer]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-4">
          <h2 className="admin-section-title text-base">Compte principal</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Prénom
              <input name="first_name" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Nom
              <input name="last_name" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Email du premier utilisateur
            <input name="user_email" type="email" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mot de passe temporaire
            <PasswordInput
              name="temp_password"
              minLength={PASSWORD_POLICY_MIN_LENGTH}
              pattern={PASSWORD_POLICY_HTML_PATTERN}
              title={PASSWORD_POLICY_MESSAGE}
              autoComplete="new-password"
              required
              className="mt-1"
              inputClassName="w-full rounded-lg border border-slate-200 px-3 py-2 pr-11"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">{PASSWORD_POLICY_MESSAGE}</span>
          </label>
        </div>

        <div className="flex items-center justify-start gap-3 sm:justify-end">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Créer le partenaire
          </button>
        </div>
      </form>
    </div>
  );
}
