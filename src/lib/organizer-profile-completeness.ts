import type { SupabaseClient } from '@supabase/supabase-js';
import { extractOrganizerDurationMeta } from '@/lib/organizer-rich-text';
import type { Database } from '@/types/supabase';

export type OrganizerCompletenessInput = {
  name: string | null;
  contact_email: string | null;
  hero_intro_text: string | null;
  description: string | null;
  founded_year: number | null;
  age_min: number | null;
  age_max: number | null;
  logo_path: string | null;
  logo_url: string | null;
  education_project_path: string | null;
  season_keys: string[] | null;
  stay_type_keys: string[] | null;
  activity_keys: string[] | null;
};

function nonEmpty(s: string | null | undefined) {
  return Boolean(s && String(s).trim().length > 0);
}

function richTextMeaningful(html: string | null | undefined, minPlainLen: number) {
  if (!html) return false;
  const plain = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length >= minPlainLen;
}

/**
 * Score 0–100 pour pilotage admin (ResaColo). Réévalué à chaque enregistrement fiche organisme.
 */
export function computeOrganizerProfileCompletenessPercent(row: OrganizerCompletenessInput): number {
  let score = 0;
  if (nonEmpty(row.name)) score += 10;
  if (nonEmpty(row.contact_email)) score += 10;
  if (nonEmpty(row.hero_intro_text)) score += 10;
  const descBody = extractOrganizerDurationMeta(row.description).description;
  if (richTextMeaningful(descBody, 35)) score += 10;
  if (row.founded_year != null && Number.isFinite(row.founded_year)) score += 5;
  if (row.age_min != null && row.age_max != null) score += 5;
  if (nonEmpty(row.logo_path) || nonEmpty(row.logo_url)) score += 10;
  if (nonEmpty(row.education_project_path)) score += 10;
  if ((row.season_keys?.length ?? 0) > 0) score += 10;
  if ((row.activity_keys?.length ?? 0) > 0) score += 10;
  if ((row.stay_type_keys?.length ?? 0) > 0) score += 10;

  return Math.min(100, Math.round(score));
}

const completenessSelect =
  'name,contact_email,hero_intro_text,description,founded_year,age_min,age_max,logo_path,logo_url,education_project_path,season_keys,stay_type_keys,activity_keys';

/** Recalcule et persiste `profile_completeness_percent` (appelé après enregistrement fiche organisme). */
export async function syncOrganizerProfileCompletenessPercent(
  supabase: SupabaseClient<Database>,
  organizerId: string
) {
  const { data: row, error } = await supabase
    .from('organizers')
    .select(completenessSelect)
    .eq('id', organizerId)
    .maybeSingle();

  if (error || !row) return;

  const pct = computeOrganizerProfileCompletenessPercent({
    name: row.name,
    contact_email: row.contact_email,
    hero_intro_text: row.hero_intro_text,
    description: row.description,
    founded_year: row.founded_year,
    age_min: row.age_min,
    age_max: row.age_max,
    logo_path: row.logo_path,
    logo_url: row.logo_url ?? null,
    education_project_path: row.education_project_path,
    season_keys: row.season_keys ?? [],
    stay_type_keys: row.stay_type_keys ?? [],
    activity_keys: row.activity_keys ?? []
  });

  await supabase.from('organizers').update({ profile_completeness_percent: pct }).eq('id', organizerId);
}
