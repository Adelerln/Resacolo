import type { SupabaseClient } from '@supabase/supabase-js';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import type { Database } from '@/types/supabase';

export const WEEKLY_STOCK_REPORT_START_DATE = '2026-09-28';

export type StockAvailability = 'available' | 'almost_full' | 'full';

export type WeeklyStockSessionRow = {
  sessionId: string;
  stayTitle: string;
  startDate: string;
  endDate: string;
  ageMin: number | null;
  ageMax: number | null;
  reserved: number;
  remaining: number;
  availability: StockAvailability;
};

export type WeeklyStockSeasonGroup = {
  seasonId: string | null;
  seasonName: string;
  sessions: WeeklyStockSessionRow[];
  sessionCount: number;
  remainingPlaces: number;
};

export type WeeklyStockOrganizerReport = {
  organizerId: string;
  organizerName: string;
  contactEmail: string;
  activeSessionCount: number;
  remainingPlaces: number;
  fullSessionCount: number;
  seasons: WeeklyStockSeasonGroup[];
};

type ParisClock = {
  dateIso: string;
  weekday: string;
  hour: number;
};

const INACTIVE_SESSION_STATUSES = new Set(['COMPLETED', 'ARCHIVED']);

const SEASON_HEADER_STYLES: Record<string, { bg: string; border: string; title: string; meta: string }> = {
  ete: { bg: '#fff7ed', border: '#fed7aa', title: '#c2410c', meta: '#9a3412' },
  été: { bg: '#fff7ed', border: '#fed7aa', title: '#c2410c', meta: '#9a3412' },
  toussaint: { bg: '#eff6ff', border: '#bfdbfe', title: '#1d4ed8', meta: '#1e40af' },
  hiver: { bg: '#f1f5f9', border: '#cbd5e1', title: '#334155', meta: '#475569' },
  printemps: { bg: '#f0fdf4', border: '#bbf7d0', title: '#15803d', meta: '#166534' },
  automne: { bg: '#fff7ed', border: '#fdba74', title: '#c2410c', meta: '#9a3412' },
  default: { bg: '#f8fafc', border: '#e2e8f0', title: '#334155', meta: '#64748b' }
};

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getStockAvailability(remaining: number): StockAvailability {
  if (remaining <= 0) return 'full';
  if (remaining <= 2) return 'almost_full';
  return 'available';
}

export function getParisClock(now = new Date()): ParisClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const weekday = get('weekday');
  const hour = Number.parseInt(get('hour'), 10);

  return {
    dateIso: `${year}-${month}-${day}`,
    weekday,
    hour: Number.isFinite(hour) ? hour : -1
  };
}

export function shouldRunWeeklyStockReport(now = new Date(), options?: { bypassSchedule?: boolean }) {
  if (options?.bypassSchedule) {
    return { ok: true as const, clock: getParisClock(now) };
  }

  const clock = getParisClock(now);
  if (clock.dateIso < WEEKLY_STOCK_REPORT_START_DATE) {
    return { ok: false as const, reason: 'before-start-date' as const, clock };
  }
  if (clock.weekday !== 'Mon') {
    return { ok: false as const, reason: 'not-monday' as const, clock };
  }
  if (clock.hour !== 9) {
    return { ok: false as const, reason: 'not-9am-paris' as const, clock };
  }
  return { ok: true as const, clock };
}

function formatDateFr(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC'
  });
}

function formatReportDateLong(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function formatAgeRange(ageMin: number | null, ageMax: number | null) {
  if (ageMin == null && ageMax == null) return null;
  if (ageMin != null && ageMax != null) return `${ageMin}–${ageMax} ans`;
  if (ageMin != null) return `dès ${ageMin} ans`;
  return `jusqu'à ${ageMax} ans`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function seasonHeaderStyle(seasonName: string) {
  const key = normalizeKey(seasonName);
  return SEASON_HEADER_STYLES[key] ?? SEASON_HEADER_STYLES.default;
}

function availabilityBadge(availability: StockAvailability) {
  if (availability === 'full') {
    return {
      label: 'Complet',
      bg: '#fee2e2',
      color: '#b91c1c',
      remainingColor: '#dc2626'
    };
  }
  if (availability === 'almost_full') {
    return {
      label: 'Presque plein',
      bg: '#fef3c7',
      color: '#b45309',
      remainingColor: '#d97706'
    };
  }
  return {
    label: 'Disponible',
    bg: '#dcfce7',
    color: '#15803d',
    remainingColor: '#16a34a'
  };
}

function chunkIds<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function buildWeeklyStockReports(
  supabase: SupabaseClient<Database>
): Promise<WeeklyStockOrganizerReport[]> {
  const { data: organizers, error: organizersError } = await supabase
    .from('organizers')
    .select('id,name,contact_email')
    .not('contact_email', 'is', null);

  if (organizersError) {
    throw new Error(`Impossible de lire les organisateurs: ${organizersError.message}`);
  }

  const organizersWithEmail = (organizers ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name?.trim() || 'Organisateur',
      contactEmail: row.contact_email?.trim().toLowerCase() ?? ''
    }))
    .filter((row) => row.contactEmail.includes('@'));

  if (organizersWithEmail.length === 0) return [];

  const organizerIds = organizersWithEmail.map((row) => row.id);
  const stays: Array<{
    id: string;
    organizer_id: string;
    title: string;
    season_id: string | null;
    age_min: number | null;
    age_max: number | null;
  }> = [];

  for (const ids of chunkIds(organizerIds, 100)) {
    const { data, error } = await supabase
      .from('stays')
      .select('id,organizer_id,title,season_id,age_min,age_max')
      .eq('status', 'PUBLISHED')
      .in('organizer_id', ids);

    if (error) {
      throw new Error(`Impossible de lire les séjours: ${error.message}`);
    }
    stays.push(...(data ?? []));
  }

  if (stays.length === 0) {
    return organizersWithEmail
      .map((organizer) => ({
        organizerId: organizer.id,
        organizerName: organizer.name,
        contactEmail: organizer.contactEmail,
        activeSessionCount: 0,
        remainingPlaces: 0,
        fullSessionCount: 0,
        seasons: [] as WeeklyStockSeasonGroup[]
      }))
      .sort((a, b) => a.organizerName.localeCompare(b.organizerName, 'fr'));
  }

  const stayById = new Map(stays.map((stay) => [stay.id, stay]));
  const stayIds = stays.map((stay) => stay.id);
  const sessions: Array<{
    id: string;
    stay_id: string;
    start_date: string;
    end_date: string;
    capacity_total: number;
    status: string;
  }> = [];

  for (const ids of chunkIds(stayIds, 100)) {
    const { data, error } = await supabase
      .from('sessions')
      .select('id,stay_id,start_date,end_date,capacity_total,status')
      .in('stay_id', ids);

    if (error) {
      throw new Error(`Impossible de lire les sessions: ${error.message}`);
    }
    for (const session of data ?? []) {
      if (INACTIVE_SESSION_STATUSES.has(session.status)) continue;
      sessions.push(session);
    }
  }

  if (sessions.length === 0) {
    return organizersWithEmail
      .map((organizer) => ({
        organizerId: organizer.id,
        organizerName: organizer.name,
        contactEmail: organizer.contactEmail,
        activeSessionCount: 0,
        remainingPlaces: 0,
        fullSessionCount: 0,
        seasons: [] as WeeklyStockSeasonGroup[]
      }))
      .sort((a, b) => a.organizerName.localeCompare(b.organizerName, 'fr'));
  }

  const seasonIds = Array.from(
    new Set(stays.map((stay) => stay.season_id).filter((id): id is string => Boolean(id)))
  );
  const seasonNameById = new Map<string, string>();
  if (seasonIds.length > 0) {
    for (const ids of chunkIds(seasonIds, 100)) {
      const { data, error } = await supabase.from('seasons').select('id,name').in('id', ids);
      if (error) {
        throw new Error(`Impossible de lire les saisons: ${error.message}`);
      }
      for (const season of data ?? []) {
        seasonNameById.set(season.id, season.name?.trim() || 'Sans saison');
      }
    }
  }

  const reservedBySession = new Map<string, number>();
  for (const ids of chunkIds(
    sessions.map((session) => session.id),
    200
  )) {
    const counts = await getReservedSessionCounts(supabase, ids);
    for (const [sessionId, count] of counts) {
      reservedBySession.set(sessionId, count);
    }
  }

  const reportsByOrganizer = new Map<string, WeeklyStockOrganizerReport>();
  for (const organizer of organizersWithEmail) {
    reportsByOrganizer.set(organizer.id, {
      organizerId: organizer.id,
      organizerName: organizer.name,
      contactEmail: organizer.contactEmail,
      activeSessionCount: 0,
      remainingPlaces: 0,
      fullSessionCount: 0,
      seasons: []
    });
  }

  const seasonBuckets = new Map<string, Map<string, WeeklyStockSeasonGroup>>();

  for (const session of sessions) {
    const stay = stayById.get(session.stay_id);
    if (!stay) continue;
    const report = reportsByOrganizer.get(stay.organizer_id);
    if (!report) continue;

    const reserved = reservedBySession.get(session.id) ?? 0;
    const remaining = Math.max(0, (session.capacity_total ?? 0) - reserved);
    const availability = getStockAvailability(remaining);
    const seasonId = stay.season_id;
    const seasonKey = seasonId ?? 'none';
    const seasonName = seasonId ? seasonNameById.get(seasonId) ?? 'Sans saison' : 'Sans saison';

    let organizerSeasons = seasonBuckets.get(stay.organizer_id);
    if (!organizerSeasons) {
      organizerSeasons = new Map();
      seasonBuckets.set(stay.organizer_id, organizerSeasons);
    }

    let seasonGroup = organizerSeasons.get(seasonKey);
    if (!seasonGroup) {
      seasonGroup = {
        seasonId,
        seasonName,
        sessions: [],
        sessionCount: 0,
        remainingPlaces: 0
      };
      organizerSeasons.set(seasonKey, seasonGroup);
    }

    seasonGroup.sessions.push({
      sessionId: session.id,
      stayTitle: stay.title?.trim() || 'Séjour',
      startDate: session.start_date,
      endDate: session.end_date,
      ageMin: stay.age_min,
      ageMax: stay.age_max,
      reserved,
      remaining,
      availability
    });
    seasonGroup.sessionCount += 1;
    seasonGroup.remainingPlaces += remaining;
    report.activeSessionCount += 1;
    report.remainingPlaces += remaining;
    if (availability === 'full') report.fullSessionCount += 1;
  }

  const reports: WeeklyStockOrganizerReport[] = [];
  for (const report of reportsByOrganizer.values()) {
    const seasons = Array.from(seasonBuckets.get(report.organizerId)?.values() ?? []);

    for (const season of seasons) {
      season.sessions.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.stayTitle.localeCompare(b.stayTitle, 'fr'));
    }
    seasons.sort((a, b) => {
      const aDate = a.sessions[0]?.startDate ?? '9999';
      const bDate = b.sessions[0]?.startDate ?? '9999';
      return aDate.localeCompare(bDate) || a.seasonName.localeCompare(b.seasonName, 'fr');
    });

    reports.push({ ...report, seasons });
  }

  reports.sort((a, b) => a.organizerName.localeCompare(b.organizerName, 'fr'));
  return reports;
}

function renderSessionRows(sessions: WeeklyStockSessionRow[]) {
  return sessions
    .map((session) => {
      const badge = availabilityBadge(session.availability);
      const ageLabel = formatAgeRange(session.ageMin, session.ageMax);
      const dates = `${formatDateFr(session.startDate)} → ${formatDateFr(session.endDate)}`;
      const meta = ageLabel ? `${dates} · ${ageLabel}` : dates;

      return `
                <tr>
                  <td style="padding:12px;border-top:1px solid #f1f5f9;font-size:13px;color:#1d1f25;line-height:1.4;">
                    <strong>${escapeHtml(session.stayTitle)}</strong><br />
                    <span style="color:#64748b;font-size:12px;">${escapeHtml(meta)}</span>
                  </td>
                  <td align="center" style="padding:12px 8px;border-top:1px solid #f1f5f9;font-size:13px;color:#404040;">${session.reserved}</td>
                  <td align="center" style="padding:12px 8px;border-top:1px solid #f1f5f9;font-size:13px;font-weight:700;color:${badge.remainingColor};">${session.remaining}</td>
                  <td align="right" style="padding:12px;border-top:1px solid #f1f5f9;">
                    <span style="display:inline-block;padding:4px 8px;border-radius:999px;background-color:${badge.bg};font-size:11px;font-weight:600;color:${badge.color};">${badge.label}</span>
                  </td>
                </tr>`;
    })
    .join('');
}

function renderSeasonBlocks(seasons: WeeklyStockSeasonGroup[]) {
  if (seasons.length === 0) {
    return `
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
                <tr>
                  <td style="padding:24px 20px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#c2410c;">
                      Aucun séjour en stock pour le moment
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#9a3412;">
                      Vous n&apos;avez actuellement aucun séjour publié avec des sessions actives sur Resacolo.<br />
                      Ajoutez un séjour pour apparaître dans les recherches des familles.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }

  return seasons
    .map((season) => {
      const style = seasonHeaderStyle(season.seasonName);
      return `
          <tr>
            <td style="padding:0 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:10px 14px;background-color:${style.bg};border-radius:8px 8px 0 0;border:1px solid ${style.border};border-bottom:none;">
                    <p style="margin:0;font-size:15px;font-weight:700;color:${style.title};">
                      ${escapeHtml(season.seasonName)}
                      <span style="font-weight:500;color:${style.meta};"> · ${season.sessionCount} session${season.sessionCount > 1 ? 's' : ''} · ${season.remainingPlaces} place${season.remainingPlaces > 1 ? 's' : ''} restante${season.remainingPlaces > 1 ? 's' : ''}</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:0 0 8px 8px;overflow:hidden;">
                <tr style="background-color:#f8fafc;">
                  <td style="padding:10px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#64748b;">Séjour / session</td>
                  <td align="center" style="padding:10px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#64748b;">Réservées</td>
                  <td align="center" style="padding:10px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#64748b;">Restantes</td>
                  <td align="right" style="padding:10px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#64748b;">État</td>
                </tr>
                ${renderSessionRows(season.sessions)}
              </table>
            </td>
          </tr>`;
    })
    .join('');
}

export function renderWeeklyStockReportHtml(input: {
  report: WeeklyStockOrganizerReport;
  reportDateIso: string;
  dashboardUrl?: string;
  addStayUrl?: string;
}) {
  const reportDateLabel = formatReportDateLong(input.reportDateIso);
  const dashboardUrl = input.dashboardUrl ?? 'https://resacolo.com/organisme';
  const addStayUrl = input.addStayUrl ?? 'https://resacolo.com/organisme/stays/new';
  const { report } = input;
  const isEmpty = report.activeSessionCount === 0;
  const ctaUrl = isEmpty ? addStayUrl : dashboardUrl;
  const ctaLabel = isEmpty ? 'Ajouter un séjour' : 'Mettre à jour mes stocks';
  const ctaHint = isEmpty
    ? 'Cliquez sur le bouton pour créer un séjour et le mettre en stock sur Resacolo.'
    : 'Pensez à actualiser les places restantes pour éviter les sur-réservations.';
  const introHtml = isEmpty
    ? `Au <strong>${escapeHtml(reportDateLabel)}</strong>, vous n&apos;avez <strong>aucun séjour en stock</strong> sur Resacolo.`
    : `Voici le récapitulatif de vos places restantes sur Resacolo,<br />
                au <strong>${escapeHtml(reportDateLabel)}</strong>.`;
  const legendBlock = isEmpty
    ? ''
    : `
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#64748b;">Légende</p>
              <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8;">
                <span style="color:#15803d;font-weight:600;">Disponible</span> = 3 places ou plus &nbsp;·&nbsp;
                <span style="color:#b45309;font-weight:600;">Presque plein</span> = 1 ou 2 places &nbsp;·&nbsp;
                <span style="color:#b91c1c;font-weight:600;">Complet</span> = 0 place
              </p>
            </td>
          </tr>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Point stocks hebdomadaire — Resacolo</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f8f8;font-family:'Raleway',Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="height:4px;background-color:#52b0ea;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:32px 32px 16px;background-color:#ffffff;">
              <img
                src="https://ypesoxqzrodukhjgwfkg.supabase.co/storage/v1/object/public/brand-assets/email/logo-resacolo.png"
                alt="Resacolo"
                width="160"
                height="42"
                style="display:block;width:160px;max-width:100%;height:auto;border:0;"
              />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 24px;background-color:#ffffff;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#f48200;text-align:center;">
                Point stocks · Lundi 9h
              </p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.3;color:#1d1f25;text-align:center;">
                ${isEmpty ? 'Aucun séjour en stock' : 'État de vos séjours en stock'}
              </h1>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#404040;text-align:center;">
                Bonjour <strong>${escapeHtml(report.organizerName)}</strong>,
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#64748b;text-align:center;">
                ${introHtml}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                <tr>
                  <td width="33%" align="center" style="padding:18px 8px;">
                    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#1d1f25;">${report.activeSessionCount}</p>
                    <p style="margin:0;font-size:12px;color:#64748b;">Sessions actives</p>
                  </td>
                  <td width="33%" align="center" style="padding:18px 8px;border-left:1px solid #e2e8f0;">
                    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#16a34a;">${report.remainingPlaces}</p>
                    <p style="margin:0;font-size:12px;color:#64748b;">Places restantes</p>
                  </td>
                  <td width="33%" align="center" style="padding:18px 8px;border-left:1px solid #e2e8f0;">
                    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#dc2626;">${report.fullSessionCount}</p>
                    <p style="margin:0;font-size:12px;color:#64748b;">Sessions complètes</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${renderSeasonBlocks(report.seasons)}
          ${legendBlock}
          <tr>
            <td align="center" style="padding:0 40px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#f48200" style="border-radius:8px;background-color:#f48200;">
                    <a
                      href="${escapeHtml(ctaUrl)}"
                      target="_blank"
                      style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                    >
                      ${escapeHtml(ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;text-align:center;">
                ${escapeHtml(ctaHint)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                Vous recevez cet e-mail chaque lundi à 9h (heure de Paris).<br />
                Pour modifier vos préférences de notification, contactez Resacolo.
              </p>
              <p style="margin:0;font-size:12px;font-weight:500;color:#64748b;text-align:center;">
                <a href="https://resacolo.com" style="color:#52b0ea;text-decoration:none;">resacolo.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderWeeklyStockReportText(input: {
  report: WeeklyStockOrganizerReport;
  reportDateIso: string;
  dashboardUrl?: string;
  addStayUrl?: string;
}) {
  const { report } = input;
  const reportDateLabel = formatReportDateLong(input.reportDateIso);
  const dashboardUrl = input.dashboardUrl ?? 'https://resacolo.com/organisme';
  const addStayUrl = input.addStayUrl ?? 'https://resacolo.com/organisme/stays/new';
  const isEmpty = report.activeSessionCount === 0;
  const lines = [
    `Point stocks Resacolo — ${reportDateLabel}`,
    '',
    `Bonjour ${report.organizerName},`,
    ''
  ];

  if (isEmpty) {
    lines.push(
      `Au ${reportDateLabel}, vous n'avez aucun séjour en stock sur Resacolo.`,
      '',
      'Sessions actives : 0',
      'Places restantes : 0',
      'Sessions complètes : 0',
      '',
      `Ajouter un séjour : ${addStayUrl}`
    );
    return lines.join('\n');
  }

  lines.push(
    `Sessions actives : ${report.activeSessionCount}`,
    `Places restantes : ${report.remainingPlaces}`,
    `Sessions complètes : ${report.fullSessionCount}`,
    ''
  );

  for (const season of report.seasons) {
    lines.push(
      `${season.seasonName} — ${season.sessionCount} session(s), ${season.remainingPlaces} place(s) restante(s)`
    );
    for (const session of season.sessions) {
      const badge = availabilityBadge(session.availability).label;
      lines.push(
        `- ${session.stayTitle} (${formatDateFr(session.startDate)} → ${formatDateFr(session.endDate)}) : ${session.remaining} restante(s) / ${session.reserved} réservée(s) — ${badge}`
      );
    }
    lines.push('');
  }

  lines.push(`Mettre à jour vos stocks : ${dashboardUrl}`);
  return lines.join('\n');
}

export function buildWeeklyStockReportSubject(reportDateIso: string) {
  return `[Resacolo] Point stocks — semaine du ${formatDateFr(reportDateIso)}`;
}
