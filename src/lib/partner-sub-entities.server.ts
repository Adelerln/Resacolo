import { getServerSupabaseClient } from '@/lib/supabase/server';
import { buildFeatureActivationMessage, isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import {
  isCollectivityMembersRoleConstraintError,
  PARTNER_MEMBERSHIP_ROLE_CONSTRAINT_MESSAGE,
  toStoredPartnerMembershipRole
} from '@/lib/partner-access';
import type { Database } from '@/types/supabase';

export type PartnerSubEntity = {
  id: string;
  collectivityId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type PartnerBeneficiaryRosterRow = {
  id: string;
  collectivityId: string;
  subEntityId: string | null;
  email: string;
  fullName: string | null;
  familyQuotient: number | null;
  familyQuotientExpiresOn: string | null;
  claimedUserId: string | null;
  claimedAt: string | null;
  createdAt: string;
};

function isSubEntitiesTableMissingError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? '');
  return (
    error?.code === 'PGRST205' ||
    message.includes("Could not find the table 'public.collectivity_sub_entities'") ||
    message.includes("Could not find the table 'public.collectivity_beneficiary_roster'")
  );
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseFamilyQuotient(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value) * 100) / 100;
}

export async function isPartnerSubEntitiesEnabled(collectivityId: string): Promise<boolean> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivities')
    .select('sub_entities_enabled')
    .eq('id', collectivityId)
    .maybeSingle();

  if (error) {
    if (isMissingAnyColumnError(error, ['sub_entities_enabled'])) return false;
    throw new Error(`Impossible de vérifier l'option sous-entités : ${error.message}`);
  }

  return Boolean(data?.sub_entities_enabled);
}

export async function setPartnerSubEntitiesEnabled(collectivityId: string, enabled: boolean) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('collectivities')
    .update({ sub_entities_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', collectivityId);

  if (error) {
    if (isMissingAnyColumnError(error, ['sub_entities_enabled'])) {
      throw new Error(buildFeatureActivationMessage('Les sous-entités partenaires'));
    }
    throw new Error(`Impossible de mettre à jour l'option sous-entités : ${error.message}`);
  }
}

export async function listPartnerSubEntities(collectivityId: string): Promise<PartnerSubEntity[]> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivity_sub_entities')
    .select('id,collectivity_id,name,created_at,updated_at')
    .eq('collectivity_id', collectivityId)
    .order('name', { ascending: true });

  if (error) {
    if (isSubEntitiesTableMissingError(error)) return [];
    throw new Error(`Impossible de charger les sous-entités : ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    collectivityId: row.collectivity_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function readPartnerSubEntity(input: {
  collectivityId: string;
  subEntityId: string;
}): Promise<PartnerSubEntity | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivity_sub_entities')
    .select('id,collectivity_id,name,created_at,updated_at')
    .eq('collectivity_id', input.collectivityId)
    .eq('id', input.subEntityId)
    .maybeSingle();

  if (error) {
    if (isSubEntitiesTableMissingError(error)) return null;
    throw new Error(`Impossible de charger la sous-entité : ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    collectivityId: data.collectivity_id,
    name: data.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

export async function createPartnerSubEntity(input: {
  collectivityId: string;
  name: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const enabled = await isPartnerSubEntitiesEnabled(input.collectivityId);
  if (!enabled) {
    throw new Error("Les sous-entités ne sont pas autorisées pour ce partenaire.");
  }

  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const password = input.password.trim();

  if (!name) throw new Error('Le nom de la sous-entité est requis.');
  if (!email || !/.+@.+\..+/.test(email)) throw new Error('Email de connexion invalide.');
  if (!firstName || !lastName) throw new Error('Prénom et nom du compte sous-entité sont requis.');
  if (!isPasswordPolicyValid(password)) throw new Error(PASSWORD_POLICY_MESSAGE);

  const supabase = getServerSupabaseClient();
  const fullName = `${firstName} ${lastName}`.trim();
  const now = new Date().toISOString();

  const { data: subEntity, error: insertError } = await supabase
    .from('collectivity_sub_entities')
    .insert({
      collectivity_id: input.collectivityId,
      name,
      created_at: now,
      updated_at: now
    })
    .select('id,collectivity_id,name,created_at,updated_at')
    .single();

  if (insertError || !subEntity) {
    if (isSubEntitiesTableMissingError(insertError)) {
      throw new Error(buildFeatureActivationMessage('Les sous-entités partenaires'));
    }
    if (insertError?.code === '23505') {
      throw new Error('Une sous-entité porte déjà ce nom.');
    }
    throw new Error(`Impossible de créer la sous-entité : ${insertError?.message ?? 'erreur inconnue'}`);
  }

  let userId: string | null = null;
  let createdUserId: string | null = null;

  try {
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = listData?.users?.find((user) => user.email?.toLowerCase() === email);
    if (existingUser) {
      userId = existingUser.id;
      await supabase.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          name: fullName
        }
      });
    } else {
      const { data: created, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          name: fullName
        }
      });
      if (createUserError || !created.user?.id) {
        throw new Error(createUserError?.message ?? 'Impossible de créer le compte sous-entité.');
      }
      userId = created.user.id;
      createdUserId = created.user.id;
    }

    const { error: memberError } = await supabase.from('collectivity_members').insert({
      collectivity_id: input.collectivityId,
      user_id: userId,
      role: toStoredPartnerMembershipRole('PARTNER_BENEFICIARY_MANAGER'),
      sub_entity_id: subEntity.id
    });

    if (memberError) {
      if (isCollectivityMembersRoleConstraintError(memberError)) {
        throw new Error(PARTNER_MEMBERSHIP_ROLE_CONSTRAINT_MESSAGE);
      }
      if (isMissingAnyColumnError(memberError, ['sub_entity_id'])) {
        throw new Error(buildFeatureActivationMessage('Les sous-entités partenaires'));
      }
      throw new Error(`Impossible de rattacher le compte à la sous-entité : ${memberError.message}`);
    }
  } catch (error) {
    await supabase.from('collectivity_sub_entities').delete().eq('id', subEntity.id);
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    }
    throw error;
  }

  return {
    id: subEntity.id,
    collectivityId: subEntity.collectivity_id,
    name: subEntity.name,
    createdAt: subEntity.created_at,
    updatedAt: subEntity.updated_at,
    loginEmail: email
  };
}

export async function renamePartnerSubEntity(input: {
  collectivityId: string;
  subEntityId: string;
  name: string;
}) {
  const name = input.name.trim();
  if (!name) throw new Error('Le nom de la sous-entité est requis.');

  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('collectivity_sub_entities')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', input.subEntityId)
    .eq('collectivity_id', input.collectivityId);

  if (error) {
    if (error.code === '23505') throw new Error('Une sous-entité porte déjà ce nom.');
    throw new Error(`Impossible de renommer la sous-entité : ${error.message}`);
  }
}

export async function deletePartnerSubEntity(input: {
  collectivityId: string;
  subEntityId: string;
}) {
  const supabase = getServerSupabaseClient();
  const { count, error: countError } = await supabase
    .from('clients')
    .select('user_id', { count: 'exact', head: true })
    .eq('collectivity_id', input.collectivityId)
    .eq('sub_entity_id', input.subEntityId);

  if (countError && !isMissingAnyColumnError(countError, ['sub_entity_id'])) {
    throw new Error(`Impossible de vérifier les ayants-droit rattachés : ${countError.message}`);
  }
  if ((count ?? 0) > 0) {
    throw new Error('Impossible de supprimer une sous-entité qui a encore des ayants-droit rattachés.');
  }

  const { error } = await supabase
    .from('collectivity_sub_entities')
    .delete()
    .eq('id', input.subEntityId)
    .eq('collectivity_id', input.collectivityId);

  if (error) {
    throw new Error(`Impossible de supprimer la sous-entité : ${error.message}`);
  }
}

export async function listSubEntitiesForCollectivityCode(code: string): Promise<{
  collectivityId: string;
  collectivityName: string;
  subEntitiesEnabled: boolean;
  subEntities: Array<{ id: string; name: string }>;
} | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return null;

  const supabase = getServerSupabaseClient();
  const { data: collectivity, error } = await supabase
    .from('collectivities')
    .select('id,name,sub_entities_enabled')
    .eq('code', normalizedCode)
    .maybeSingle();

  if (error) {
    if (isMissingAnyColumnError(error, ['sub_entities_enabled'])) {
      const { data: legacy } = await supabase
        .from('collectivities')
        .select('id,name')
        .eq('code', normalizedCode)
        .maybeSingle();
      if (!legacy) return null;
      return {
        collectivityId: legacy.id,
        collectivityName: legacy.name,
        subEntitiesEnabled: false,
        subEntities: []
      };
    }
    throw new Error(`Impossible de vérifier le code CSE : ${error.message}`);
  }
  if (!collectivity) return null;

  if (!collectivity.sub_entities_enabled) {
    return {
      collectivityId: collectivity.id,
      collectivityName: collectivity.name,
      subEntitiesEnabled: false,
      subEntities: []
    };
  }

  const subEntities = await listPartnerSubEntities(collectivity.id);
  return {
    collectivityId: collectivity.id,
    collectivityName: collectivity.name,
    subEntitiesEnabled: true,
    subEntities: subEntities.map((row) => ({ id: row.id, name: row.name }))
  };
}

export async function upsertBeneficiaryRosterRows(input: {
  collectivityId: string;
  subEntityId?: string | null;
  rows: Array<{
    email: string;
    fullName?: string | null;
    familyQuotient?: number | null;
    familyQuotientExpiresOn?: string | null;
  }>;
}) {
  if (input.subEntityId) {
    const subEntity = await readPartnerSubEntity({
      collectivityId: input.collectivityId,
      subEntityId: input.subEntityId
    });
    if (!subEntity) throw new Error('Sous-entité introuvable.');
  }

  const supabase = getServerSupabaseClient();
  const now = new Date().toISOString();
  let upserted = 0;

  for (const row of input.rows) {
    const email = normalizeEmail(row.email);
    if (!email || !/.+@.+\..+/.test(email)) continue;

    const payload: Database['public']['Tables']['collectivity_beneficiary_roster']['Insert'] = {
      collectivity_id: input.collectivityId,
      sub_entity_id: input.subEntityId ?? null,
      email,
      full_name: row.fullName?.trim() || null,
      family_quotient: parseFamilyQuotient(row.familyQuotient),
      family_quotient_expires_on: row.familyQuotientExpiresOn?.trim() || null,
      updated_at: now
    };

    const { data: existing, error: existingError } = await supabase
      .from('collectivity_beneficiary_roster')
      .select('id')
      .eq('collectivity_id', input.collectivityId)
      .ilike('email', email)
      .maybeSingle();

    if (existingError) {
      if (isSubEntitiesTableMissingError(existingError)) {
        throw new Error(buildFeatureActivationMessage("L'import d'ayants-droit pré-compte"));
      }
      throw new Error(`Impossible de préparer l'import : ${existingError.message}`);
    }

    if (existing?.id) {
      const { error } = await supabase
        .from('collectivity_beneficiary_roster')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw new Error(`Impossible de mettre à jour ${email} : ${error.message}`);
    } else {
      const { error } = await supabase.from('collectivity_beneficiary_roster').insert({
        ...payload,
        created_at: now
      });
      if (error) throw new Error(`Impossible d'importer ${email} : ${error.message}`);
    }
    upserted += 1;
  }

  return { upserted };
}

export async function listBeneficiaryRoster(input: {
  collectivityId: string;
  subEntityId?: string | null;
}): Promise<PartnerBeneficiaryRosterRow[]> {
  const supabase = getServerSupabaseClient();
  let query = supabase
    .from('collectivity_beneficiary_roster')
    .select(
      'id,collectivity_id,sub_entity_id,email,full_name,family_quotient,family_quotient_expires_on,claimed_user_id,claimed_at,created_at'
    )
    .eq('collectivity_id', input.collectivityId)
    .order('created_at', { ascending: false });

  if (input.subEntityId) {
    query = query.eq('sub_entity_id', input.subEntityId);
  }

  const { data, error } = await query;
  if (error) {
    if (isSubEntitiesTableMissingError(error)) return [];
    throw new Error(`Impossible de charger le fichier d'ayants-droit : ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    collectivityId: row.collectivity_id,
    subEntityId: row.sub_entity_id,
    email: row.email,
    fullName: row.full_name,
    familyQuotient: parseFamilyQuotient(row.family_quotient),
    familyQuotientExpiresOn: row.family_quotient_expires_on,
    claimedUserId: row.claimed_user_id,
    claimedAt: row.claimed_at,
    createdAt: row.created_at
  }));
}

/** Applique un éventuel roster pré-compte lors de l'inscription / première connexion. */
export async function claimBeneficiaryRosterForUser(input: {
  userId: string;
  email: string;
}) {
  const email = normalizeEmail(input.email);
  if (!email || !input.userId) return null;

  const supabase = getServerSupabaseClient();
  const { data: roster, error } = await supabase
    .from('collectivity_beneficiary_roster')
    .select(
      'id,collectivity_id,sub_entity_id,family_quotient,family_quotient_expires_on,full_name,claimed_user_id'
    )
    .is('claimed_user_id', null)
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSubEntitiesTableMissingError(error)) return null;
    console.warn('[claimBeneficiaryRosterForUser]', error.message);
    return null;
  }
  if (!roster) return null;

  const now = new Date().toISOString();
  const { error: clientError } = await supabase.from('clients').upsert(
    {
      user_id: input.userId,
      collectivity_id: roster.collectivity_id,
      sub_entity_id: roster.sub_entity_id,
      family_quotient: parseFamilyQuotient(roster.family_quotient),
      family_quotient_expires_on: roster.family_quotient_expires_on,
      full_name: roster.full_name
    },
    { onConflict: 'user_id' }
  );

  if (clientError) {
    if (isMissingAnyColumnError(clientError, ['sub_entity_id'])) {
      await supabase.from('clients').upsert(
        {
          user_id: input.userId,
          collectivity_id: roster.collectivity_id,
          family_quotient: parseFamilyQuotient(roster.family_quotient),
          family_quotient_expires_on: roster.family_quotient_expires_on,
          full_name: roster.full_name
        },
        { onConflict: 'user_id' }
      );
    } else {
      console.warn('[claimBeneficiaryRosterForUser] clients upsert', clientError.message);
      return null;
    }
  }

  await supabase
    .from('collectivity_beneficiary_roster')
    .update({
      claimed_user_id: input.userId,
      claimed_at: now,
      updated_at: now
    })
    .eq('id', roster.id);

  const { data: collectivity } = await supabase
    .from('collectivities')
    .select('code')
    .eq('id', roster.collectivity_id)
    .maybeSingle();
  if (collectivity?.code) {
    const code = String(collectivity.code).trim().toUpperCase();
    const { data: existingProfile } = await supabase
      .from('client_profiles')
      .select('user_id')
      .eq('user_id', input.userId)
      .maybeSingle();
    if (existingProfile) {
      await supabase
        .from('client_profiles')
        .update({ cse_organization: code, updated_at: now })
        .eq('user_id', input.userId);
    }
  }

  return {
    collectivityId: roster.collectivity_id,
    subEntityId: roster.sub_entity_id
  };
}

export function parseBeneficiaryRosterCsv(content: string): Array<{
  email: string;
  fullName: string | null;
  familyQuotient: number | null;
  familyQuotientExpiresOn: string | null;
}> {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headerCells = lines[0].split(delimiter).map((cell) => cell.trim().toLowerCase());
  const hasHeader =
    headerCells.some((cell) => cell.includes('mail') || cell === 'email') ||
    headerCells.some((cell) => cell.includes('qf') || cell.includes('quotient'));

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const emailIndex = hasHeader
    ? Math.max(
        0,
        headerCells.findIndex((cell) => cell.includes('mail') || cell === 'email')
      )
    : 0;
  const nameIndex = hasHeader
    ? headerCells.findIndex((cell) => cell.includes('nom') || cell.includes('name'))
    : 1;
  const qfIndex = hasHeader
    ? headerCells.findIndex((cell) => cell.includes('qf') || cell.includes('quotient'))
    : 2;
  const expiresIndex = hasHeader
    ? headerCells.findIndex((cell) => cell.includes('expir') || cell.includes('valid'))
    : 3;

  return dataLines
    .map((line) => {
      const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
      const email = normalizeEmail(cells[emailIndex] ?? '');
      const fullName = nameIndex >= 0 ? cells[nameIndex]?.trim() || null : null;
      const qfRaw = qfIndex >= 0 ? (cells[qfIndex] ?? '').replace(',', '.') : '';
      const qfParsed = qfRaw ? Number.parseFloat(qfRaw) : NaN;
      const expiresRaw = expiresIndex >= 0 ? (cells[expiresIndex] ?? '').trim() : '';
      const expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? expiresRaw : null;
      return {
        email,
        fullName,
        familyQuotient: Number.isFinite(qfParsed) && qfParsed >= 0 ? Math.round(qfParsed * 100) / 100 : null,
        familyQuotientExpiresOn: expiresOn
      };
    })
    .filter((row) => row.email.includes('@'));
}
