import { requireRole } from '@/lib/auth/require';
import { MnemosFieldLabel } from '@/components/mnemos/MnemosFieldLabel';
import { readContactFormNotificationSettings } from '@/lib/contact-form-notifications.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { saveContactFormNotificationSettings } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Sp = {
  saved?: string;
  err?: string;
};

export default async function MnemosContactNotificationsPage({
  searchParams
}: {
  searchParams?: Promise<Sp>;
}) {
  await requireRole('MNEMOS');
  const sp = searchParams ? await searchParams : {};
  const supabase = getServerSupabaseClient();
  const settings = await readContactFormNotificationSettings(supabase);
  const emailsText = settings.emails.join('\n');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Notifications</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Ces adresses reçoivent un e-mail dès qu&apos;une demande arrive via le formulaire public{' '}
          <strong className="text-slate-300">/contact</strong>. Les alertes partenariat / rejoindre Resacolo se
          configurent dans Admin → Demandes. Les demandes contact restent aussi listées dans l&apos;onglet
          Demandes.
          <strong className="text-slate-300">/contact</strong> ou via{' '}
          <strong className="text-slate-300">Assistance technique</strong> dans l&apos;espace organisateur.
          Les demandes restent aussi listées dans Mnemos (Demandes / Assistance organismes).
        </p>
      </div>

      {settings.tableMissing ? (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          La table de réglages est absente. Appliquez la migration{' '}
          <code className="text-amber-50">20260913_contact_form_notification_settings.sql</code> sur
          Supabase, puis enregistrez à nouveau.
        </div>
      ) : null}

      {sp.err ? (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {decodeURIComponent(sp.err)}
        </div>
      ) : null}

      {sp.saved ? (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          Destinataires enregistrés.
        </div>
      ) : null}

      <form
        action={saveContactFormNotificationSettings}
        className="max-w-xl space-y-4 rounded-xl border border-slate-700 bg-slate-900/50 p-5"
      >
        <label className="block text-sm text-slate-300">
          <MnemosFieldLabel>Adresses e-mail (une par ligne)</MnemosFieldLabel>
          <textarea
            name="emails"
            required
            rows={6}
            defaultValue={emailsText}
            placeholder={'jeanne@thalie.org\nadele@thalie.org'}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-white"
          />
        </label>
        <p className="text-xs text-slate-500">
          Séparez aussi par virgule si besoin. Les doublons sont ignorés. Nécessite SMTP configuré
          (variables <code className="text-slate-400">SMTP_*</code>).
        </p>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Enregistrer
        </button>
      </form>
    </div>
  );
}
