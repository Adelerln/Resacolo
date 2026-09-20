import { requireRole } from '@/lib/auth/require';
import { listAdminInboundRequests } from '@/lib/admin-inbound-requests.server';
import {
  groupWeeklyStockReportLogsByRun,
  listWeeklyStockReportEmailLogs
} from '@/lib/weekly-stock-report-email-logs.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Sp = {
  report_date?: string;
  status?: string;
};

function formatDateTimeFr(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function formatDateFr(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function statusBadge(status: string) {
  if (status === 'sent') {
    return 'border-emerald-700/60 bg-emerald-950/40 text-emerald-200';
  }
  if (status === 'failed') {
    return 'border-rose-700/60 bg-rose-950/40 text-rose-200';
  }
  return 'border-amber-700/60 bg-amber-950/40 text-amber-100';
}

function statusLabel(status: string) {
  if (status === 'sent') return 'Envoyé';
  if (status === 'failed') return 'Échec';
  return 'Ignoré';
}

function inboundKindLabel(kind: string) {
  if (kind === 'PARTNER') return 'Partenaire';
  if (kind === 'ORGANIZER') return 'Organisateur';
  return kind;
}

function inboundStatusLabel(status: string) {
  if (status === 'RESOLVED') return 'Traité';
  if (status === 'IN_PROGRESS') return 'En cours';
  return 'Nouveau';
}

function inboundStatusBadge(status: string) {
  if (status === 'RESOLVED') {
    return 'border-emerald-700/60 bg-emerald-950/40 text-emerald-200';
  }
  if (status === 'IN_PROGRESS') {
    return 'border-amber-700/60 bg-amber-950/40 text-amber-100';
  }
  return 'border-sky-700/60 bg-sky-950/40 text-sky-100';
}

function inboundContactLabel(row: {
  contact_first_name: string | null;
  contact_last_name: string | null;
  organization_name: string | null;
}) {
  const name = [row.contact_first_name, row.contact_last_name].filter(Boolean).join(' ').trim();
  return name || row.organization_name || '—';
}

export default async function MnemosWeeklyStockEmailsPage({
  searchParams
}: {
  searchParams?: Promise<Sp>;
}) {
  await requireRole('MNEMOS');
  const sp = searchParams ? await searchParams : {};
  const reportDate = sp.report_date?.trim() || null;
  const status =
    sp.status === 'sent' || sp.status === 'failed' || sp.status === 'skipped' ? sp.status : null;

  const [{ rows, error, tableMissing }, inbound] = await Promise.all([
    listWeeklyStockReportEmailLogs({
      limit: 400,
      reportDate,
      status
    }),
    listAdminInboundRequests({ limit: 80 })
  ]);
  const runs = groupWeeklyStockReportLogsByRun(rows);
  const totalSent = rows.filter((row) => row.status === 'sent').length;
  const totalFailed = rows.filter((row) => row.status === 'failed').length;
  const totalSkipped = rows.filter((row) => row.status === 'skipped').length;
  const openInboundCount = inbound.rows.filter((row) => row.status !== 'RESOLVED').length;
  const partnerInboundCount = inbound.rows.filter((row) => row.kind === 'PARTNER').length;
  const organizerInboundCount = inbound.rows.filter((row) => row.kind === 'ORGANIZER').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Mails stocks & demandes</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Journal des e-mails « point stocks » envoyés aux organisateurs chaque lundi à 9h, et aperçu
          indicatif des demandes partenaires / organisateurs reçues via les formulaires publics.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Demandes partenaires & organisateurs</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Indicatif Mnemos — le traitement se fait dans Admin → Demandes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-sky-700/50 px-2.5 py-1 text-sky-100">
              {openInboundCount} ouverte{openInboundCount > 1 ? 's' : ''}
            </span>
            <span className="rounded-full border border-violet-700/50 px-2.5 py-1 text-violet-100">
              {partnerInboundCount} partenaire{partnerInboundCount > 1 ? 's' : ''}
            </span>
            <span className="rounded-full border border-orange-700/50 px-2.5 py-1 text-orange-100">
              {organizerInboundCount} organisateur{organizerInboundCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {inbound.tableMissing ? (
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            Table des demandes absente. Appliquez la migration{' '}
            <code className="text-amber-50">20260914_admin_inbound_requests.sql</code> sur Supabase.
          </div>
        ) : null}

        {inbound.error && !inbound.tableMissing ? (
          <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
            Impossible de charger les demandes : {inbound.error.message}
          </div>
        ) : null}

        {!inbound.tableMissing && !inbound.error && inbound.rows.length === 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">
            Aucune demande partenaire ou organisateur pour le moment.
          </div>
        ) : null}

        {inbound.rows.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/40">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Structure</th>
                    <th className="px-4 py-2 font-medium">Contact</th>
                    <th className="px-4 py-2 font-medium">E-mail</th>
                    <th className="px-4 py-2 font-medium">Statut</th>
                    <th className="px-4 py-2 font-medium">Reçu le</th>
                    <th className="px-4 py-2 font-medium">Aperçu</th>
                  </tr>
                </thead>
                <tbody>
                  {inbound.rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-800/80 text-slate-300">
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            row.kind === 'PARTNER'
                              ? 'border-violet-700/60 bg-violet-950/40 text-violet-100'
                              : 'border-orange-700/60 bg-orange-950/40 text-orange-100'
                          }`}
                        >
                          {inboundKindLabel(row.kind)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-100">
                        {row.organization_name || '—'}
                        {row.formula ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">
                            {row.formula}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">{inboundContactLabel(row)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{row.contact_email}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${inboundStatusBadge(row.status)}`}
                        >
                          {inboundStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {formatDateTimeFr(row.created_at)}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-slate-500">
                        {row.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <div className="border-t border-slate-800 pt-6">
        <h2 className="text-lg font-semibold text-white">Mails stocks (lundi 9h)</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Vérifie rapidement si le cron a tourné et si chaque mail organisateur est parti.
        </p>
      </div>

      {tableMissing ? (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          La table de logs est absente. Appliquez la migration{' '}
          <code className="text-amber-50">20260916_create_weekly_stock_report_email_logs.sql</code> sur
          Supabase, puis relancez un envoi.
        </div>
      ) : null}

      {error && !tableMissing ? (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          Impossible de charger les logs : {error.message}
        </div>
      ) : null}

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
        <label className="text-sm text-slate-300">
          Date du rapport
          <input
            type="date"
            name="report_date"
            defaultValue={reportDate ?? ''}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-sm text-slate-300">
          Statut
          <select
            name="status"
            defaultValue={status ?? ''}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option value="">Tous</option>
            <option value="sent">Envoyés</option>
            <option value="failed">Échecs</option>
            <option value="skipped">Ignorés</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Filtrer
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-emerald-300/80">Envoyés</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-100">{totalSent}</p>
        </div>
        <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-rose-300/80">Échecs</p>
          <p className="mt-1 text-2xl font-semibold text-rose-100">{totalFailed}</p>
        </div>
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-amber-300/80">Ignorés</p>
          <p className="mt-1 text-2xl font-semibold text-amber-100">{totalSkipped}</p>
        </div>
      </div>

      {runs.length === 0 && !tableMissing && !error ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-400">
          Aucun envoi journalisé pour le moment. Les prochains crons du lundi écriront ici.
        </div>
      ) : null}

      <div className="space-y-4">
        {runs.map((run) => (
          <section
            key={run.runId}
            className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-white capitalize">
                  {formatDateFr(run.reportDate)}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Run {run.runId.slice(0, 8)} · démarré {formatDateTimeFr(run.createdAt)}
                  {run.dryRun ? ' · dry-run' : ''}
                  {run.forceRun ? ' · forcé' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-emerald-700/50 px-2.5 py-1 text-emerald-200">
                  {run.sent} envoyé{run.sent > 1 ? 's' : ''}
                </span>
                <span className="rounded-full border border-rose-700/50 px-2.5 py-1 text-rose-200">
                  {run.failed} échec{run.failed > 1 ? 's' : ''}
                </span>
                <span className="rounded-full border border-amber-700/50 px-2.5 py-1 text-amber-100">
                  {run.skipped} ignoré{run.skipped > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Organisateur</th>
                    <th className="px-4 py-2 font-medium">Destinataire</th>
                    <th className="px-4 py-2 font-medium">Statut</th>
                    <th className="px-4 py-2 font-medium">Stocks</th>
                    <th className="px-4 py-2 font-medium">Heure</th>
                    <th className="px-4 py-2 font-medium">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {run.rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-800/80 text-slate-300">
                      <td className="px-4 py-2.5 font-medium text-slate-100">
                        {row.organizer_name || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{row.recipient_email}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadge(row.status)}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">
                        {row.active_session_count != null ? (
                          <>
                            {row.active_session_count} sess. · {row.remaining_places ?? '—'} places ·{' '}
                            {row.full_session_count ?? 0} complet
                            {row.full_session_count === 1 ? '' : 's'}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {formatDateTimeFr(row.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {row.error_message ? (
                          <span className="text-rose-300/90">{row.error_message}</span>
                        ) : row.subject ? (
                          <span className="text-slate-500">{row.subject}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
