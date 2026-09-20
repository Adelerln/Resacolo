import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MnemosPaymentReminderAlertsPage() {
  await requireRole('MNEMOS');
  const supabase = getServerSupabaseClient();

  const { data: rows, error } = await supabase
    .from('orders')
    .select(
      'id, status, created_at, payment_reminder_missing_email_alerted_at, deposit_reminder_sent_at, balance_reminder_sent_at, client_user_id'
    )
    .not('payment_reminder_missing_email_alerted_at', 'is', null)
    .order('payment_reminder_missing_email_alerted_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Alertes email relances</h1>
        <p className="mt-1 text-sm text-slate-400">
          Commandes pour lesquelles une relance acompte/solde était due, mais aucun e-mail client fiable n’a été trouvé.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error.message}
          <p className="mt-2 text-xs text-rose-200/80">
            Vérifiez que la migration{' '}
            <code>20260920_payment_reminders_and_cancellations.sql</code> est appliquée.
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Alerte</th>
              <th className="px-4 py-3">Commande</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Relances</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="px-4 py-3">
                  {row.payment_reminder_missing_email_alerted_at
                    ? new Date(row.payment_reminder_missing_email_alerted_at).toLocaleString('fr-FR')
                    : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.client_user_id}</td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  acompte={row.deposit_reminder_sent_at ? 'oui' : 'non'} · solde=
                  {row.balance_reminder_sent_at ? 'oui' : 'non'}
                </td>
              </tr>
            ))}
            {!error && (rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-slate-500">
                  Aucune alerte pour le moment.{' '}
                  <Link href="/mnemos/cancellations" className="text-violet-300 underline">
                    Voir les annulations
                  </Link>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
