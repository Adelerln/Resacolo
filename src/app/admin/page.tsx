import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

const ACTIVE_ORDER_STATUSES = new Set(['REQUESTED', 'VALIDATED', 'BOOKED', 'PAID', 'CONFIRMED']);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminHome() {
  await requireRole('ADMIN');
  const supabase = getServerSupabaseClient();

  const [{ data: staysRaw }, { data: ordersRaw }, { data: organizersRaw }, { data: membersRaw }] =
    await Promise.all([
      supabase.from('stays').select('id,status'),
      supabase.from('orders').select('id,status'),
      supabase.from('organizer_admin_overview').select('id,profile_completeness_percent'),
      supabase.from('organizer_members').select('id')
    ]);

  const stays = staysRaw ?? [];
  const orders = ordersRaw ?? [];
  const organizers = organizersRaw ?? [];
  const members = membersRaw ?? [];

  const totalStays = stays.length;
  const publishedStays = stays.filter((stay) => stay.status === 'PUBLISHED').length;
  const draftOrHiddenStays = stays.filter(
    (stay) => stay.status === 'DRAFT' || stay.status === 'HIDDEN'
  ).length;
  const archivedStays = stays.filter((stay) => stay.status === 'ARCHIVED').length;

  const activeOrders = orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status)).length;
  const requestedOrders = orders.filter((order) => order.status === 'REQUESTED').length;

  const lowProfileOrganizers = organizers.filter(
    (organizer) => Number(organizer.profile_completeness_percent ?? 0) < 70
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="admin-page-title">Dashboard admin</h1>
        <p className="admin-page-subtitle mt-1">
          Vue d&apos;ensemble des séjours, réservations et organismes.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="admin-kpi-label">Séjours publiés</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{publishedStays}</p>
          <p className="mt-1 text-xs text-slate-500">{totalStays} au total</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="admin-kpi-label">Séjours à traiter</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{draftOrHiddenStays}</p>
          <p className="mt-1 text-xs text-slate-500">Brouillons + masqués</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="admin-kpi-label">Réservations actives</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{activeOrders}</p>
          <p className="mt-1 text-xs text-slate-500">{requestedOrders} demandes à qualifier</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="admin-kpi-label">Organismes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{organizers.length}</p>
          <p className="mt-1 text-xs text-slate-500">{lowProfileOrganizers} profils &lt; 70%</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="admin-section-title">Actions rapides</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link
            href="/admin/sejours"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Gérer les séjours ({totalStays}, dont {archivedStays} archivés)
          </Link>
          <Link
            href="/admin/organizers"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Gérer les organismes ({members.length} membres liés)
          </Link>
          <Link
            href="/admin/finances"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Voir les recettes
          </Link>
          <Link
            href="/admin/utilisateurs"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Gérer les utilisateurs back-office
          </Link>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="admin-section-title">Points d&apos;attention</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
            {requestedOrders} réservation(s) au statut <span className="font-semibold">REQUESTED</span>.
          </div>
          <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
            {lowProfileOrganizers} organisme(s) avec une complétude profil inférieure à 70%.
          </div>
        </div>
      </section>
      <p className="admin-page-subtitle">
        Accès rapide aux séjours, réservations et utilisateurs.
      </p>
    </div>
  );
}
