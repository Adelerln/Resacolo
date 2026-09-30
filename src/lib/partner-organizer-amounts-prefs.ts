export type PartnerOrganizerSettlement = {
  organizerId: string;
  seasonId: string | null;
  year: number | null;
  settledAt: string;
};

export type PartnerOrganizerAmountsPrefs = {
  archivedSeasonIds: string[];
  settlements: PartnerOrganizerSettlement[];
};

function emptyPrefs(): PartnerOrganizerAmountsPrefs {
  return { archivedSeasonIds: [], settlements: [] };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Clé d’archivage : saison + année (ex. uuid:2025). Ancien format = uuid seul. */
export function partnerSeasonArchiveKey(seasonId: string, year: number | null | undefined) {
  const id = seasonId.trim();
  if (!id) return '';
  if (typeof year === 'number' && Number.isFinite(year)) return `${id}:${Math.round(year)}`;
  return id;
}

export function parsePartnerSeasonArchiveKey(raw: string): { seasonId: string; year: number | null } {
  const value = raw.trim();
  if (!value) return { seasonId: '', year: null };
  const sep = value.lastIndexOf(':');
  if (sep <= 0) return { seasonId: value, year: null };
  const yearPart = value.slice(sep + 1);
  const year = Number.parseInt(yearPart, 10);
  if (!Number.isFinite(year) || String(year) !== yearPart) {
    return { seasonId: value, year: null };
  }
  return { seasonId: value.slice(0, sep), year };
}

export function isPartnerSeasonYearArchived(
  archivedKeys: Iterable<string>,
  seasonId: string | null | undefined,
  year: number | null | undefined
) {
  if (!seasonId?.trim()) return false;
  const set = archivedKeys instanceof Set ? archivedKeys : new Set(archivedKeys);
  if (set.has(seasonId)) return true; // legacy : toute la saison
  const keyed = partnerSeasonArchiveKey(seasonId, year ?? null);
  return keyed ? set.has(keyed) : false;
}

export function formatPartnerSeasonYearLabel(name: string, year: number | null | undefined) {
  const label = name.trim() || 'Saison';
  if (typeof year === 'number' && Number.isFinite(year)) return `${label} ${Math.round(year)}`;
  return label;
}

export function parsePartnerOrganizerAmountsPrefs(raw: unknown): PartnerOrganizerAmountsPrefs {
  const record = asRecord(raw);
  if (!record) return emptyPrefs();

  const archivedSeasonIds = Array.isArray(record.archivedSeasonIds)
    ? record.archivedSeasonIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];

  const settlements: PartnerOrganizerSettlement[] = [];
  if (Array.isArray(record.settlements)) {
    for (const entry of record.settlements) {
      const row = asRecord(entry);
      if (!row || typeof row.organizerId !== 'string' || !row.organizerId.trim()) continue;
      const seasonId =
        typeof row.seasonId === 'string' && row.seasonId.trim() ? row.seasonId.trim() : null;
      const year =
        typeof row.year === 'number' && Number.isFinite(row.year) ? Math.round(row.year) : null;
      const settledAt =
        typeof row.settledAt === 'string' && row.settledAt.trim()
          ? row.settledAt
          : new Date().toISOString();
      settlements.push({
        organizerId: row.organizerId.trim(),
        seasonId,
        year,
        settledAt
      });
    }
  }

  return { archivedSeasonIds, settlements };
}

export function settlementMatchesScope(
  settlement: PartnerOrganizerSettlement,
  scope: { organizerId: string; seasonId: string | null; year: number | null }
) {
  return (
    settlement.organizerId === scope.organizerId &&
    (settlement.seasonId ?? null) === (scope.seasonId ?? null) &&
    (settlement.year ?? null) === (scope.year ?? null)
  );
}
