'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import {
  partnerSeasonArchiveKey,
  settlementMatchesScope
} from '@/lib/partner-organizer-amounts-prefs';
import {
  readPartnerOrganizerAmountsPrefs,
  writePartnerOrganizerAmountsPrefs
} from '@/lib/partner-organizer-amounts-prefs.server';

function buildReturnPath(formData: FormData) {
  const saison = String(formData.get('saison') ?? '').trim();
  const annee = String(formData.get('annee') ?? '').trim();
  const params = new URLSearchParams();
  if (saison) params.set('saison', saison);
  if (annee) params.set('annee', annee);
  const query = params.toString();
  return query ? `/partenaire/montants-organisateurs?${query}` : '/partenaire/montants-organisateurs';
}

async function requirePartnerOrganizerAmountsAccess() {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);
  if (!collectivityId || !canAccessPartnerSection(accessRole, 'organizer-amounts')) {
    redirect('/partenaire');
  }
  return { collectivityId };
}

export async function archivePartnerSeasonAction(formData: FormData) {
  const { collectivityId } = await requirePartnerOrganizerAmountsAccess();
  const seasonId = String(formData.get('season_id') ?? '').trim();
  const yearRaw = String(formData.get('year') ?? '').trim();
  const yearParsed = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const year = yearParsed != null && Number.isFinite(yearParsed) ? yearParsed : null;
  if (!seasonId) redirect(buildReturnPath(formData));

  const archiveKey = partnerSeasonArchiveKey(seasonId, year);
  if (!archiveKey) redirect(buildReturnPath(formData));

  const prefs = await readPartnerOrganizerAmountsPrefs(collectivityId);
  if (!prefs.archivedSeasonIds.includes(archiveKey)) {
    prefs.archivedSeasonIds = [...prefs.archivedSeasonIds, archiveKey];
    await writePartnerOrganizerAmountsPrefs(collectivityId, prefs);
  }

  revalidatePath('/partenaire/montants-organisateurs');
  redirect(buildReturnPath(formData));
}

export async function unarchivePartnerSeasonAction(formData: FormData) {
  const { collectivityId } = await requirePartnerOrganizerAmountsAccess();
  const seasonId = String(formData.get('season_id') ?? '').trim();
  const yearRaw = String(formData.get('year') ?? '').trim();
  const yearParsed = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const year = yearParsed != null && Number.isFinite(yearParsed) ? yearParsed : null;
  const archiveKeyRaw = String(formData.get('archive_key') ?? '').trim();
  if (!seasonId && !archiveKeyRaw) redirect(buildReturnPath(formData));

  const archiveKey = archiveKeyRaw || partnerSeasonArchiveKey(seasonId, year);

  const prefs = await readPartnerOrganizerAmountsPrefs(collectivityId);
  prefs.archivedSeasonIds = prefs.archivedSeasonIds.filter(
    (id) => id !== archiveKey && !(year == null && id === seasonId)
  );
  await writePartnerOrganizerAmountsPrefs(collectivityId, prefs);

  revalidatePath('/partenaire/montants-organisateurs');
  redirect(buildReturnPath(formData));
}

export async function settlePartnerOrganizerDebtAction(formData: FormData) {
  const { collectivityId } = await requirePartnerOrganizerAmountsAccess();
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  if (!organizerId) redirect(buildReturnPath(formData));

  const seasonId = String(formData.get('saison') ?? '').trim() || null;
  const yearRaw = String(formData.get('annee') ?? '').trim();
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const parsedYear = year != null && Number.isFinite(year) ? year : null;

  const prefs = await readPartnerOrganizerAmountsPrefs(collectivityId);
  const scope = { organizerId, seasonId, year: parsedYear };
  const withoutCurrent = prefs.settlements.filter((row) => !settlementMatchesScope(row, scope));
  prefs.settlements = [
    ...withoutCurrent,
    {
      organizerId,
      seasonId,
      year: parsedYear,
      settledAt: new Date().toISOString()
    }
  ];
  await writePartnerOrganizerAmountsPrefs(collectivityId, prefs);

  revalidatePath('/partenaire/montants-organisateurs');
  redirect(buildReturnPath(formData));
}

export async function unsettlePartnerOrganizerDebtAction(formData: FormData) {
  const { collectivityId } = await requirePartnerOrganizerAmountsAccess();
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  if (!organizerId) redirect(buildReturnPath(formData));

  const seasonId = String(formData.get('saison') ?? '').trim() || null;
  const yearRaw = String(formData.get('annee') ?? '').trim();
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const parsedYear = year != null && Number.isFinite(year) ? year : null;

  const prefs = await readPartnerOrganizerAmountsPrefs(collectivityId);
  prefs.settlements = prefs.settlements.filter(
    (row) => !settlementMatchesScope(row, { organizerId, seasonId, year: parsedYear })
  );
  await writePartnerOrganizerAmountsPrefs(collectivityId, prefs);

  revalidatePath('/partenaire/montants-organisateurs');
  redirect(buildReturnPath(formData));
}
