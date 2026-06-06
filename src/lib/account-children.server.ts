import type { Database, Json } from '@/types/supabase';
import type { FamilyProfileChild, FamilyProfileChildInput } from '@/types/family-profile';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type ClientChildRow = Database['public']['Tables']['client_children']['Row'];

export const CLIENT_CHILDREN_MISSING_ERROR =
  "Configuration incomplète: table 'public.client_children' absente. Appliquez les migrations Supabase avant de gérer les enfants.";

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim();
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
    birthdate: row.birthdate,
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
    birthdate: normalizeText(input.birthdate),
    gender: input.gender === 'MASCULIN' || input.gender === 'FEMININ' ? input.gender : '',
    additional_info: normalizeText(input.additionalInfo),
    updated_at: new Date().toISOString()
  };
}

async function ensureClientRow(userId: string) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase.from('clients').upsert(
    {
      user_id: userId
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`Impossible de préparer le compte client : ${error.message}`);
  }
}

async function syncLegacyChildrenMirror(userId: string) {
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
    throw new Error(`Impossible de relire les enfants du compte : ${error.message}`);
  }

  const children = (data ?? []).map(mapRowToFamilyChild);
  const { error: profileError } = await supabase
    .from('client_profiles')
    .update({
      children_json: toLegacyChildrenJson(children),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (profileError && !isMissingColumnError(profileError, 'children_json')) {
    throw new Error(`Impossible de synchroniser le profil famille : ${profileError.message}`);
  }

  return children;
}

export async function listFamilyChildren(userId: string): Promise<FamilyProfileChild[]> {
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

  return (data ?? []).map(mapRowToFamilyChild);
}

export async function createFamilyChild(input: {
  userId: string;
  child: FamilyProfileChildInput;
}): Promise<FamilyProfileChild> {
  const supabase = getServerSupabaseClient();
  await ensureClientRow(input.userId);
  const payload = normalizeChildPayload(input.child);
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
