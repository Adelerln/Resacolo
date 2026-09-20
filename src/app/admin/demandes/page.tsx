import { requireAdminSection } from '@/lib/auth/require';
import {
  readAdminInboundRequestSettings,
  type AdminInboundRequestKind,
  type AdminInboundRequestStatus
} from '@/lib/admin-inbound-requests.server';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { resolveAdminInboundRequest, saveAdminInboundRequestSettings } from './actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSingleParam(searchParams: SearchParams | undefined, key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR');
}

function kindLabel(kind: string) {
  if (kind === 'PARTNER') return 'Partenariat';
  if (kind === 'ORGANIZER') return 'Organisateur';
  return kind;
}

function kindClassName(kind: string) {
  if (kind === 'PARTNER') return 'bg-violet-50 text-violet-800 border-violet-200';
  if (kind === 'ORGANIZER') return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function statusLabel(status: string) {
  if (status === 'RESOLVED') return 'Traité';
  if (status === 'IN_PROGRESS') return 'En cours';
  return 'Nouveau';
}

function statusClassName(status: string) {
  if (status === 'RESOLVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'IN_PROGRESS') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-sky-50 text-sky-800 border-sky-200';
}

function contactDisplay(row: {
  contact_first_name: string | null;
  contact_last_name: string | null;
  organization_name: string | null;
}) {
  const name = [row.contact_first_name, row.contact_last_name].filter(Boolean).join(' ').trim();
  return name || row.organization_name || '—';
}

export default async function AdminDemandesPage({ searchParams }: PageProps) {
  await requireAdminSection('requests');
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const supabase = getServerSupabaseClient();

  const settings = await readAdminInboundRequestSettings(supabase);
  const { data: requestsRaw, error: requestsError } = await supabase
    .from('admin_inbound_requests')
    .select(
      'id,kind,status,organization_name,contact_first_name,contact_last_name,contact_email,contact_phone,formula,atout_france,sdjes,website_url,message,resolved_at,created_at'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const tableMissing =
    settings.tableMissing || (requestsError ? isMissingPublicTableError(requestsError) : false);
  if (requestsError && !isMissingPublicTableError(requestsError)) {
    throw new Error(requestsError.message);
  }

  const requests = requestsRaw ?? [];
  const openRequests = requests.filter((row) => row.status !== 'RESOLVED');
  const resolvedRequests = requests.filter((row) => row.status === 'RESOLVED');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="admin-page-title">Demandes</h1>
        <p className="admin-page-subtitle mt-1">
          Demandes de partenariat et de rejoindre Resacolo. Configurez les destinataires d&apos;alerte e-mail,
          puis marquez les demandes comme traitées.
        </p>
      </div>

      {tableMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tables absentes. Appliquez la migration{' '}
          <code className="font-mono text-xs">20260914_admin_inbound_requests.sql</code> sur Supabase.
        </div>
      ) : null}

      {getSingleParam(resolvedSearchParams, 'err') ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getSingleParam(resolvedSearchParams, 'err')}
        </div>
      ) : null}

      {getSingleParam(resolvedSearchParams, 'saved') ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Destinataires enregistrés.
        </div>
      ) : null}

      {getSingleParam(resolvedSearchParams, 'resolved') ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Demande marquée comme traitée.
        </div>
      ) : null}

      <form
        action={saveAdminInboundRequestSettings}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
      >
        <div className="md:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Alertes e-mail</h2>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          E-mail demandes <strong>Partenaires</strong>
          <input
            name="partner_notification_email"
            type="email"
            required
            defaultValue={settings.partnerNotificationEmail ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="partenariats@exemple.fr"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          E-mail demandes <strong>Organisateurs</strong>
          <input
            name="organizer_notification_email"
            type="email"
            required
            defaultValue={settings.organizerNotificationEmail ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="organisateurs@exemple.fr"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Enregistrer les destinataires
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">À traiter</h2>
            <p className="text-sm text-slate-600">{openRequests.length} demande(s) ouverte(s)</p>
          </div>
        </div>
        <RequestList rows={openRequests} showResolve />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Traitées</h2>
          <p className="text-sm text-slate-600">{resolvedRequests.length} demande(s)</p>
        </div>
        <RequestList rows={resolvedRequests} showResolve={false} />
      </section>
    </div>
  );
}

function RequestList({
  rows,
  showResolve
}: {
  rows: Array<{
    id: string;
    kind: string;
    status: string;
    organization_name: string | null;
    contact_first_name: string | null;
    contact_last_name: string | null;
    contact_email: string;
    contact_phone: string | null;
    formula: string | null;
    atout_france: string | null;
    sdjes: string | null;
    website_url: string | null;
    message: string;
    resolved_at: string | null;
    created_at: string;
  }>;
  showResolve: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        Aucune demande.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <article key={row.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${kindClassName(
                    row.kind
                  )}`}
                >
                  {kindLabel(row.kind as AdminInboundRequestKind)}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClassName(
                    row.status as AdminInboundRequestStatus
                  )}`}
                >
                  {statusLabel(row.status)}
                </span>
                <span className="text-xs text-slate-500">{formatDateTime(row.created_at)}</span>
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                {contactDisplay(row)}
                {row.organization_name && row.organization_name !== contactDisplay(row) ? (
                  <span className="font-normal text-slate-500"> · {row.organization_name}</span>
                ) : null}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                <a className="text-sky-700 hover:underline" href={`mailto:${row.contact_email}`}>
                  {row.contact_email}
                </a>
                {row.contact_phone ? <span>{row.contact_phone}</span> : null}
                {row.formula ? <span>{row.formula}</span> : null}
                {row.atout_france ? <span>AF {row.atout_france}</span> : null}
                {row.sdjes ? <span>{row.sdjes}</span> : null}
                {row.website_url ? (
                  <a
                    href={row.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 hover:underline"
                  >
                    Site
                  </a>
                ) : null}
              </p>
            </div>
            {showResolve ? (
              <form action={resolveAdminInboundRequest}>
                <input type="hidden" name="request_id" value={row.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Marquer comme traité
                </button>
              </form>
            ) : row.resolved_at ? (
              <p className="text-xs text-slate-500">Traité le {formatDateTime(row.resolved_at)}</p>
            ) : null}
          </div>

          <p className="mt-2 line-clamp-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed text-slate-700">
            {row.message}
          </p>
        </article>
      ))}
    </div>
  );
}
