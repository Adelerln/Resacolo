import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatAccommodationType } from '@/lib/accommodation-types';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';
import { requireAdminSection } from '@/lib/auth/require';
import {
  extractGoogleMapsEmbedSrcFromInput,
  readMapIframeHtmlFromAiExtractedData
} from '@/lib/google-maps-iframe';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { accommodationStatusBadgeClassName, accommodationStatusLabel } from '@/lib/ui/labels';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

function displayValue(value: string | number | null | undefined) {
  if (value == null) return '—';
  const text = String(value).trim();
  return text.length > 0 ? text : '—';
}

function formatLocationMode(value: string | null | undefined) {
  const mode = String(value ?? '')
    .trim()
    .toLowerCase();
  if (mode === 'france') return 'France (fixe)';
  if (mode === 'abroad') return 'Étranger (fixe)';
  if (mode === 'itinerant') return 'Itinérant';
  return displayValue(value);
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export default async function AdminAccommodationDetailPage({ params: paramsPromise }: PageProps) {
  await requireAdminSection('accommodations');
  const params = await paramsPromise;
  const supabase = getServerSupabaseClient();

  const selectWithMap =
    'id,name,organizer_id,accommodation_type,location_mode,itinerant_zone,address_text,postal_code,city,department_code,region_text,country,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at,validated_at,validated_by_user_id,source_url,ai_extracted_data,center_latitude,center_longitude,map_iframe_html,created_at';
  const selectLegacy =
    'id,name,organizer_id,accommodation_type,location_mode,itinerant_zone,address_text,postal_code,city,department_code,region_text,country,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at,validated_at,validated_by_user_id,source_url,ai_extracted_data,center_latitude,center_longitude,created_at';

  const primary = await supabase.from('accommodations').select(selectWithMap).eq('id', params.id).maybeSingle();
  const missingMapColumn =
    primary.error && String(primary.error.message ?? '').toLowerCase().includes('map_iframe_html');
  const fallback = missingMapColumn
    ? await supabase.from('accommodations').select(selectLegacy).eq('id', params.id).maybeSingle()
    : null;

  const accommodation = missingMapColumn
    ? fallback?.data
      ? { ...fallback.data, map_iframe_html: null as string | null }
      : null
    : primary.data;

  if (!accommodation) {
    notFound();
  }

  const [{ data: organizer }, { data: mediaRaw }, { data: stayLinksRaw }] = await Promise.all([
    supabase.from('organizers').select('id,name').eq('id', accommodation.organizer_id).maybeSingle(),
    supabase
      .from('accommodation_media')
      .select('url,position')
      .eq('accommodation_id', accommodation.id)
      .order('position', { ascending: true }),
    supabase.from('stay_accommodations').select('stay_id').eq('accommodation_id', accommodation.id)
  ]);

  const stayIds = Array.from(new Set((stayLinksRaw ?? []).map((link) => link.stay_id)));
  const { data: staysRaw } = stayIds.length
    ? await supabase.from('stays').select('id,title,status').in('id', stayIds)
    : { data: [] as Array<{ id: string; title: string; status: string }> | null };

  const locationMeta = extractAccommodationLocationMeta(accommodation.description, {
    accommodationType: accommodation.accommodation_type,
    locationMode: accommodation.location_mode,
    itinerantZone: accommodation.itinerant_zone,
    addressText: accommodation.address_text,
    postalCode: accommodation.postal_code,
    city: accommodation.city,
    departmentCode: accommodation.department_code,
    regionText: accommodation.region_text,
    country: accommodation.country
  });

  const mapIframeHtml =
    accommodation.map_iframe_html ?? readMapIframeHtmlFromAiExtractedData(accommodation.ai_extracted_data);
  const mapEmbedSrc = mapIframeHtml ? extractGoogleMapsEmbedSrcFromInput(mapIframeHtml) : null;
  const mediaUrls = (mediaRaw ?? []).map((item) => item.url).filter(Boolean);
  const linkedStays = (staysRaw ?? []).slice().sort((left, right) =>
    left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/hebergements" className="text-xs font-medium text-slate-500 hover:text-slate-800">
            ← Liste des hébergements
          </Link>
          <h1 className="admin-page-title mt-1">{accommodation.name}</h1>
          <p className="admin-page-subtitle mt-1">
            Fiche hébergement · {organizer?.name ?? 'Organisateur inconnu'}
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${accommodationStatusBadgeClassName(accommodation.status)}`}
        >
          {accommodationStatusLabel(accommodation.status)}
        </span>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="admin-section-title">Informations générales</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Organisateur">
            {organizer ? (
              <Link
                href={`/admin/organizers/${organizer.id}`}
                className="font-medium text-slate-800 hover:underline"
              >
                {organizer.name}
              </Link>
            ) : (
              '—'
            )}
          </DetailItem>
          <DetailItem label="Type">{formatAccommodationType(accommodation.accommodation_type)}</DetailItem>
          <DetailItem label="Mode de localisation">
            {formatLocationMode(accommodation.location_mode)}
          </DetailItem>
          <DetailItem label="Créé le">
            {new Date(accommodation.created_at).toLocaleString('fr-FR')}
          </DetailItem>
          <DetailItem label="Mis à jour le">
            {new Date(accommodation.updated_at).toLocaleString('fr-FR')}
          </DetailItem>
          <DetailItem label="Validé le">
            {accommodation.validated_at
              ? new Date(accommodation.validated_at).toLocaleString('fr-FR')
              : '—'}
          </DetailItem>
          <DetailItem label="Identifiant">
            <span className="font-mono text-xs">{accommodation.id}</span>
          </DetailItem>
          <DetailItem label="URL source">
            {accommodation.source_url ? (
              <a
                href={accommodation.source_url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sky-700 hover:underline"
              >
                {accommodation.source_url}
              </a>
            ) : (
              '—'
            )}
          </DetailItem>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="admin-section-title">Adresse / localisation</h2>
        <p className="mt-1 text-sm text-slate-500">{locationMeta.locationLabel ?? 'Non renseignée'}</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Adresse">{displayValue(accommodation.address_text)}</DetailItem>
          <DetailItem label="Code postal">{displayValue(accommodation.postal_code)}</DetailItem>
          <DetailItem label="Ville">{displayValue(accommodation.city)}</DetailItem>
          <DetailItem label="Département">{displayValue(accommodation.department_code)}</DetailItem>
          <DetailItem label="Région">{displayValue(accommodation.region_text)}</DetailItem>
          <DetailItem label="Pays">{displayValue(accommodation.country)}</DetailItem>
          <DetailItem label="Zone itinérante">{displayValue(accommodation.itinerant_zone)}</DetailItem>
          <DetailItem label="Latitude">{displayValue(accommodation.center_latitude)}</DetailItem>
          <DetailItem label="Longitude">{displayValue(accommodation.center_longitude)}</DetailItem>
        </dl>
        {mapEmbedSrc ? (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <iframe
              src={mapEmbedSrc}
              title={`Carte ${accommodation.name}`}
              className="h-[320px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="admin-section-title">Contenus renseignés</h2>
        <dl className="mt-4 grid gap-5">
          <DetailItem label="Description">{displayValue(locationMeta.description ?? accommodation.description)}</DetailItem>
          <DetailItem label="Couchage">{displayValue(accommodation.bed_info)}</DetailItem>
          <DetailItem label="Sanitaires">{displayValue(accommodation.bathroom_info)}</DetailItem>
          <DetailItem label="Restauration">{displayValue(accommodation.catering_info)}</DetailItem>
          <DetailItem label="Accessibilité / PMR">{displayValue(accommodation.accessibility_info)}</DetailItem>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="admin-section-title">Médias</h2>
        {mediaUrls.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mediaUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              >
                <div className="relative aspect-[4/3] w-full bg-slate-100">
                  <Image
                    src={url}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition group-hover:scale-[1.02]"
                  />
                </div>
                <p className="truncate px-3 py-2 text-xs text-slate-500">{url}</p>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Aucune image renseignée.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="admin-section-title">Séjours liés</h2>
        {linkedStays.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {linkedStays.map((stay) => (
              <li key={stay.id}>
                <Link
                  href={`/admin/sejours/${stay.id}`}
                  className="text-sm font-medium text-slate-800 hover:underline"
                >
                  {stay.title}
                </Link>
                <span className="ml-2 text-xs text-slate-500">{stay.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Aucun séjour lié.</p>
        )}
      </section>
    </div>
  );
}
