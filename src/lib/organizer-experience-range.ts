import { mockOrganizers } from '@/lib/mockOrganizers';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export type OrganizerExperienceRange = {
  minYears: number;
  maxYears: number;
};

function normalizeExperienceYears(foundedYear: number, currentYear: number) {
  const years = currentYear - foundedYear;
  return Number.isFinite(years) ? Math.max(0, Math.trunc(years)) : null;
}

function deriveOrganizerExperienceRangeFromYears(
  foundedYears: Array<number | null | undefined>,
  currentYear = new Date().getFullYear()
): OrganizerExperienceRange | null {
  const experienceYears = foundedYears
    .filter((year): year is number => typeof year === 'number' && Number.isFinite(year))
    .map((year) => normalizeExperienceYears(year, currentYear))
    .filter((year): year is number => year != null);

  if (experienceYears.length === 0) {
    return null;
  }

  return {
    minYears: Math.min(...experienceYears),
    maxYears: Math.max(...experienceYears)
  };
}

export async function getOrganizerExperienceRange(): Promise<OrganizerExperienceRange | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase.from('organizers').select('founded_year');

  if (!error) {
    const rangeFromDb = deriveOrganizerExperienceRangeFromYears(
      (data ?? []).map((organizer) => organizer.founded_year)
    );
    if (rangeFromDb) {
      return rangeFromDb;
    }
  } else {
    console.warn('Supabase (organizers founded_year) indisponible :', error.message);
  }

  return deriveOrganizerExperienceRangeFromYears(mockOrganizers.map((organizer) => organizer.creationYear));
}
