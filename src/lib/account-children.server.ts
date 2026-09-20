import type { Database, Json } from '@/types/supabase';
import type { FamilyProfileChild, FamilyProfileChildInput } from '@/types/family-profile';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type ClientChildRow = Database['public']['Tables']['client_children']['Row'];

export const CLIENT_CHILDREN_MISSING_ERROR =
  "Configuration incomplète: table 'public.client_children' absente. Appliquez les migrations Supabase avant de gérer les enfants.";

const CLIENTS_FK_RETRY_COUNT = 5;
const CLIENTS_FK_RETRY_DELAY_MS = 250;

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim();
}

/** PostgREST peut renvoyer `2015-03-15` ou `2015-03-15T00:00:00.000Z` selon le type SQL. */
export function normalizeChildBirthdate(value: string | null | undefined) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? raw;
}

function childIdentityKey(input: {
  firstName: string;
  lastName: string;
  birthdate: string;
}) {
  return [
    normalizeText(input.firstName).toLowerCase(),
    normalizeText(input.lastName).toLowerCase(),
    normalizeChildBirthdate(input.birthdate)
  ].join('|');
}

function isMissingClientChildrenTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const code = String(error.code ?? '').trim();
  const message = String(error.message ?? '');
  if (code === 'PGRST205') return true;
  return (
    message.includes('public.client_children') &&
    (message.includes('schema cache') || message.includes('Could not find the table') || message.includes('does not exist'))
  );
}

function isMissingColumnError(
  error: { code?: string; message?: string } | null | undefined,
  columnName: string
) {
  const message = String(error?.message ?? '');
  return message.includes(columnName) && message.includes('does not exist');
}

function isLegacyClientsUserForeignKeyError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const code = String(error.code ?? '').trim();
  const message = String(error.message ?? '').toLowerCase();
  return code === '23503' && message.includes('clients_user_id_fkey');
}

function isUniqueViolationError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return String(error.code ?? '').trim() === '23505';
}

function toLegacyChildrenJson(children: FamilyProfileChild[]): Json {
  return children.map((child) => ({
    firstName: child.firstName,
    lastName: child.lastName,
    birthdate: child.birthdate,
    gender: child.gender,
    additionalInfo: child.additionalInfo
  }));
}

function mapRowToFamilyChild(row: ClientChildRow): FamilyProfileChild {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthdate: normalizeChildBirthdate(row.birthdate),
    gender: row.gender === 'MASCULIN' || row.gender === 'FEMININ' ? row.gender : '',
    additionalInfo: row.additional_info,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeChildPayload(input: FamilyProfileChildInput) {
  return {
    first_name: normalizeText(input.firstName),
    last_name: normalizeText(input.lastName),
    birthdate: normalizeChildBirthdate(input.birthdate),
    gender: input.gender === 'MASCULIN' || input.gender === 'FEMININ' ? input.gender : '',
    additional_info: normalizeText(input.additionalInfo),
    updated_at: new Date().toISOString()
  };
}

async function ensureClientRow(userId: string) {
  const supabase = getServerSupabaseClient();
  for (let attempt = 0; attempt < CLIENTS_FK_RETRY_COUNT; attempt += 1) {
    const { error } = await supabase.from('clients').upsert(
      {
        user_id: userId
      },
      { onConflict: 'user_id' }
    );

    if (!error) {
      return;
    }

    if (isLegacyClientsUserForeignKeyError(error) && attempt < CLIENTS_FK_RETRY_COUNT - 1) {
      await new Promise((resolve) => setTimeout(resolve, CLIENTS_FK_RETRY_DELAY_MS));
      continue;
    }

    throw new Error(`Impossible de préparer le compte client : ${error.message}`);
  }
}

async function fetchFamilyChildRows(userId: string): Promise<ClientChildRow[]> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('client_children')
    .select('id,first_name,last_name,birthdate,gender,additional_info,created_at,updated_at,user_id')
    .eq('user_id', userId)
    .order('birthdate', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingClientChildrenTableError(error)) {
      throw new Error(CLIENT_CHILDREN_MISSING_ERROR);
    }
    throw new Error(`Impossible de charger les enfants du compte : ${error.message}`);
  }

  return data ?? [];
}

/** Conserve le plus ancien enregistrement par identité (prénom+nom+naissance), supprime les doublons. */
async function dedupeFamilyChildRows(userId: string, rows: ClientChildRow[]): Promise<ClientChildRow[]> {
  const groups = new Map<string, ClientChildRow[]>();
  for (const row of rows) {
    const key = childIdentityKey({
      firstName: row.first_name,
      lastName: row.last_name,
      birthdate: row.birthdate
    });
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  const keep: ClientChildRow[] = [];
  const deleteIds: string[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort((left, right) => {
      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.id.localeCompare(right.id);
    });
    keep.push(sorted[0]!);
    for (const duplicate of sorted.slice(1)) {
      deleteIds.push(duplicate.id);
    }
  }

  if (deleteIds.length > 0) {
    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from('client_children')
      .delete()
      .eq('user_id', userId)
      .in('id', deleteIds);
    if (error && !isMissingClientChildrenTableError(error)) {
      throw new Error(`Impossible de nettoyer les doublons d'enfants : ${error.message}`);
    }
  }

  return keep.sort((left, right) => {
    const birthCompare = normalizeChildBirthdate(right.birthdate).localeCompare(
      normalizeChildBirthdate(left.birthdate)
    );
    if (birthCompare !== 0) return birthCompare;
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });
}

async function syncLegacyChildrenMirror(userId: string) {
  const rows = await dedupeFamilyChildRows(userId, await fetchFamilyChildRows(userId));
  const children = rows.map(mapRowToFamilyChild);
  const supabase = getServerSupabaseClient();

  // Upsert (et non update) : sans fiche client_profiles, l'enfant était invisible au prochain chargement.
  const { error: profileError } = await supabase.from('client_profiles').upsert(
    {
      user_id: userId,
      children_json: toLegacyChildrenJson(children),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  );

  if (profileError && !isMissingColumnError(profileError, 'children_json')) {
    const message = String(profileError.message ?? '');
    if (
      message.includes('public.client_profiles') &&
      (message.includes('schema cache') || message.includes('Could not find the table') || message.includes('does not exist'))
    ) {
      return children;
    }
    throw new Error(`Impossible de synchroniser le profil famille : ${profileError.message}`);
  }

  return children;
}

async function findMatchingFamilyChild(
  userId: string,
  child: FamilyProfileChildInput
): Promise<FamilyProfileChild | null> {
  const targetKey = childIdentityKey(child);
  const rows = await fetchFamilyChildRows(userId);
  const match = rows.find(
    (row) =>
      childIdentityKey({
        firstName: row.first_name,
        lastName: row.last_name,
        birthdate: row.birthdate
      }) === targetKey
  );
  return match ? mapRowToFamilyChild(match) : null;
}

export async function listFamilyChildren(userId: string): Promise<FamilyProfileChild[]> {
  const rows = await fetchFamilyChildRows(userId);
  const hasDuplicates = rows.length !== new Set(rows.map((row) =>
    childIdentityKey({
      firstName: row.first_name,
      lastName: row.last_name,
      birthdate: row.birthdate
    })
  )).size;

  if (!hasDuplicates) {
    return rows.map(mapRowToFamilyChild);
  }

  return syncLegacyChildrenMirror(userId);
}

export async function createFamilyChild(input: {
  userId: string;
  child: FamilyProfileChildInput;
}): Promise<FamilyProfileChild> {
  const supabase = getServerSupabaseClient();
  await ensureClientRow(input.userId);
  const payload = normalizeChildPayload(input.child);

  if (!payload.first_name || !payload.last_name || !payload.birthdate) {
    throw new Error('Prénom, nom et date de naissance sont requis.');
  }

  const existing = await findMatchingFamilyChild(input.userId, {
    firstName: payload.first_name,
    lastName: payload.last_name,
    birthdate: payload.birthdate,
    gender: payload.gender === 'MASCULIN' || payload.gender === 'FEMININ' ? payload.gender : '',
    additionalInfo: payload.additional_info
  });
  if (existing) {
    // Même enfant déjà présent : on met à jour genre / infos plutôt que de créer un 5e doublon.
    if (
      existing.gender !== (payload.gender === 'MASCULIN' || payload.gender === 'FEMININ' ? payload.gender : '') ||
      existing.additionalInfo !== payload.additional_info
    ) {
      return updateFamilyChild({
        userId: input.userId,
        childId: existing.id,
        child: {
          firstName: payload.first_name,
          lastName: payload.last_name,
          birthdate: payload.birthdate,
          gender: payload.gender === 'MASCULIN' || payload.gender === 'FEMININ' ? payload.gender : '',
          additionalInfo: payload.additional_info
        }
      });
    }
    // Nettoie d'éventuels doublons déjà créés, puis renvoie l'entrée canonique.
    const cleaned = await syncLegacyChildrenMirror(input.userId);
    return cleaned.find((child) => child.id === existing.id) ?? existing;
  }

  const { data, error } = await supabase
    .from('client_children')
    .insert({
      user_id: input.userId,
      ...payload
    })
    .select('id,first_name,last_name,birthdate,gender,additional_info,created_at,updated_at,user_id')
    .single();

  if (error || !data) {
    if (isMissingClientChildrenTableError(error)) {
      throw new Error(CLIENT_CHILDREN_MISSING_ERROR);
    }
    if (isUniqueViolationError(error)) {
      const raced = await findMatchingFamilyChild(input.userId, {
        firstName: payload.first_name,
        lastName: payload.last_name,
        birthdate: payload.birthdate,
        gender: '',
        additionalInfo: ''
      });
      if (raced) return raced;
    }
    throw new Error(error?.message ?? "Impossible d'ajouter l'enfant.");
  }

  await syncLegacyChildrenMirror(input.userId);
  return mapRowToFamilyChild(data);
}

export async function updateFamilyChild(input: {
  userId: string;
  childId: string;
  child: FamilyProfileChildInput;
}): Promise<FamilyProfileChild> {
  const supabase = getServerSupabaseClient();
  const payload = normalizeChildPayload(input.child);

  // IDs synthétiques issus de children_json (ex. "prenom:nom:date") : créer plutôt que PATCH.
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.childId);
  if (!looksLikeUuid) {
    return createFamilyChild({ userId: input.userId, child: input.child });
  }

  const conflicting = await findMatchingFamilyChild(input.userId, {
    firstName: payload.first_name,
    lastName: payload.last_name,
    birthdate: payload.birthdate,
    gender: '',
    additionalInfo: ''
  });
  if (conflicting && conflicting.id !== input.childId) {
    throw new Error('Un enfant avec le même prénom, nom et date de naissance existe déjà.');
  }

  const { data, error } = await supabase
    .from('client_children')
    .update(payload)
    .eq('id', input.childId)
    .eq('user_id', input.userId)
    .select('id,first_name,last_name,birthdate,gender,additional_info,created_at,updated_at,user_id')
    .single();

  if (error || !data) {
    if (isMissingClientChildrenTableError(error)) {
      throw new Error(CLIENT_CHILDREN_MISSING_ERROR);
    }
    throw new Error(error?.message ?? "Impossible de modifier l'enfant.");
  }

  await syncLegacyChildrenMirror(input.userId);
  return mapRowToFamilyChild(data);
}

export async function deleteFamilyChild(input: { userId: string; childId: string }) {
  const supabase = getServerSupabaseClient();
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.childId);

  if (!looksLikeUuid) {
    // Enfant legacy uniquement présent dans children_json (id synthétique prenom:nom:date).
    const { data, error } = await supabase
      .from('client_profiles')
      .select('children_json')
      .eq('user_id', input.userId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message || "Impossible de supprimer l'enfant.");
    }
    const raw = Array.isArray(data?.children_json) ? data.children_json : [];
    const nextJson = raw.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
      const record = item as Record<string, unknown>;
      const firstName = typeof record.firstName === 'string' ? record.firstName.trim() : '';
      const lastName = typeof record.lastName === 'string' ? record.lastName.trim() : '';
      const birthdate = normalizeChildBirthdate(
        typeof record.birthdate === 'string' ? record.birthdate : ''
      );
      const syntheticId = `${firstName.toLowerCase()}:${lastName.toLowerCase()}:${birthdate}`;
      return syntheticId !== input.childId;
    });
    const { error: updateError } = await supabase
      .from('client_profiles')
      .update({ children_json: nextJson as Json, updated_at: new Date().toISOString() })
      .eq('user_id', input.userId);
    if (updateError) {
      throw new Error(updateError.message || "Impossible de supprimer l'enfant.");
    }
    return;
  }

  const { error } = await supabase
    .from('client_children')
    .delete()
    .eq('id', input.childId)
    .eq('user_id', input.userId);

  if (error) {
    if (isMissingClientChildrenTableError(error)) {
      throw new Error(CLIENT_CHILDREN_MISSING_ERROR);
    }
    throw new Error(error.message || "Impossible de supprimer l'enfant.");
  }

  await syncLegacyChildrenMirror(input.userId);
}

export async function migrateLegacyChildrenJsonToTable(input: {
  userId: string;
  children: FamilyProfileChild[];
}): Promise<FamilyProfileChild[]> {
  if (input.children.length === 0) {
    return [];
  }

  const existing = await listFamilyChildren(input.userId);
  if (existing.length > 0) {
    return existing;
  }

  await ensureClientRow(input.userId);
  const supabase = getServerSupabaseClient();
  const uniqueRows = new Map<
    string,
    {
      user_id: string;
      first_name: string;
      last_name: string;
      birthdate: string;
      gender: string;
      additional_info: string;
      updated_at: string;
    }
  >();

  for (const child of input.children) {
    if (!child.firstName.trim() || !child.lastName.trim() || !child.birthdate.trim()) {
      continue;
    }
    const payload = normalizeChildPayload({
      firstName: child.firstName,
      lastName: child.lastName,
      birthdate: child.birthdate,
      gender: child.gender,
      additionalInfo: child.additionalInfo
    });
    const key = childIdentityKey({
      firstName: payload.first_name,
      lastName: payload.last_name,
      birthdate: payload.birthdate
    });
    if (!uniqueRows.has(key)) {
      uniqueRows.set(key, {
        user_id: input.userId,
        ...payload
      });
    }
  }

  const rows = Array.from(uniqueRows.values());
  if (rows.length === 0) {
    return existing;
  }

  const { error } = await supabase.from('client_children').insert(rows);
  if (error) {
    if (isMissingClientChildrenTableError(error)) {
      throw new Error(CLIENT_CHILDREN_MISSING_ERROR);
    }
    throw new Error(`Impossible de migrer les enfants du compte : ${error.message}`);
  }

  return syncLegacyChildrenMirror(input.userId);
}

export async function resolveFamilyChildForCheckout(input: {
  userId: string;
  childId: string | null | undefined;
  firstName?: string | null;
  lastName?: string | null;
  birthdate?: string | null;
}): Promise<FamilyProfileChild | null> {
  const rows = await dedupeFamilyChildRows(input.userId, await fetchFamilyChildRows(input.userId));
  const children = rows.map(mapRowToFamilyChild);
  const childId = normalizeText(input.childId);
  if (childId) {
    const byId = children.find((child) => child.id === childId);
    if (byId) return byId;
  }

  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  const birthdate = normalizeChildBirthdate(input.birthdate);
  if (!firstName || !lastName || !birthdate) {
    return null;
  }

  const key = childIdentityKey({ firstName, lastName, birthdate });
  return (
    children.find(
      (child) =>
        childIdentityKey({
          firstName: child.firstName,
          lastName: child.lastName,
          birthdate: child.birthdate
        }) === key
    ) ?? null
  );
}
