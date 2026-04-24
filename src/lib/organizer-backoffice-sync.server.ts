import 'server-only';

import type { User } from '@supabase/supabase-js';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/db';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { OrganizerAccessRole } from '@/lib/organizer-access';
import type { Database } from '@/types/supabase';

type OrganizerBackofficeAccessRow = Database['public']['Tables']['organizer_backoffice_access']['Row'];
type OrganizerMemberRow = Database['public']['Tables']['organizer_members']['Row'];

type OrganizerAccessSyncIdentity = {
  appUserId: string;
  email: string;
  supabaseUserId: string;
  firstName: string | null;
  lastName: string | null;
};

const ACCESS_CODE_PREFIX = 'ORG-';

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function splitDisplayName(name: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const normalized = String(name ?? '').trim();
  if (!normalized) {
    return { firstName: null, lastName: null };
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

async function findSupabaseUserByEmail(email: string): Promise<User | null> {
  const supabase = getServerSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  const perPage = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Impossible de rechercher l'utilisateur Supabase (${error.message}).`);
    }

    const users = data?.users ?? [];
    const matched = users.find((user) => normalizeEmail(user.email ?? '') === normalizedEmail) ?? null;
    if (matched) {
      return matched;
    }

    if (users.length < perPage) {
      break;
    }
  }

  return null;
}

export async function ensurePrismaUserForOrganizerAccess(input: {
  email: string;
  tempPassword?: string | null;
  displayName?: string | null;
}): Promise<{ id: string; email: string; created: boolean }> {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) {
    throw new Error('Email utilisateur invalide.');
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true }
  });
  if (existing) {
    return { id: existing.id, email: existing.email, created: false };
  }

  const tempPassword = String(input.tempPassword ?? '').trim();
  if (!tempPassword) {
    throw new Error('Utilisateur applicatif introuvable (Prisma) et mot de passe temporaire absent.');
  }

  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.displayName?.trim() || null,
      status: 'ACTIVE',
      passwordHash: hashPassword(tempPassword)
    },
    select: { id: true, email: true }
  });

  return { id: created.id, email: created.email, created: true };
}

export async function removePrismaUserIfExists(userId: string | null | undefined) {
  if (!userId) return;
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}

export async function resolveOrganizerAccessIdentityByEmail(
  email: string
): Promise<OrganizerAccessSyncIdentity> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email utilisateur invalide.');
  }

  const prismaUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true }
  });
  if (!prismaUser) {
    throw new Error("Utilisateur applicatif introuvable pour cet email.");
  }

  const supabaseUser = await findSupabaseUserByEmail(normalizedEmail);
  if (!supabaseUser) {
    throw new Error("Utilisateur Supabase introuvable pour cet email.");
  }

  const { firstName, lastName } = splitDisplayName(prismaUser.name);
  return {
    appUserId: prismaUser.id,
    email: prismaUser.email,
    supabaseUserId: supabaseUser.id,
    firstName,
    lastName
  };
}

export async function resolveOrganizerAccessIdentityByAppUserId(
  appUserId: string
): Promise<OrganizerAccessSyncIdentity> {
  const normalizedAppUserId = appUserId.trim();
  if (!normalizedAppUserId) {
    throw new Error('Identifiant applicatif invalide.');
  }

  const prismaUser = await prisma.user.findUnique({
    where: { id: normalizedAppUserId },
    select: { id: true, email: true, name: true }
  });
  if (!prismaUser) {
    throw new Error('Utilisateur applicatif introuvable.');
  }

  const supabaseUser = await findSupabaseUserByEmail(prismaUser.email);
  if (!supabaseUser) {
    throw new Error('Utilisateur Supabase introuvable pour cet utilisateur applicatif.');
  }

  const { firstName, lastName } = splitDisplayName(prismaUser.name);
  return {
    appUserId: prismaUser.id,
    email: prismaUser.email,
    supabaseUserId: supabaseUser.id,
    firstName,
    lastName
  };
}

export async function resolveOrganizerAccessIdentityBySupabaseUserId(input: {
  supabaseUserId: string;
  emailHint?: string | null;
}): Promise<OrganizerAccessSyncIdentity> {
  const supabaseUserId = input.supabaseUserId.trim();
  if (!supabaseUserId) {
    throw new Error('Identifiant utilisateur Supabase invalide.');
  }

  let email = normalizeEmail(input.emailHint ?? '');
  if (!email) {
    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase.auth.admin.getUserById(supabaseUserId);
    if (error) {
      throw new Error(`Impossible de charger l'utilisateur Supabase (${error.message}).`);
    }

    email = normalizeEmail(data.user?.email ?? '');
  }

  if (!email) {
    throw new Error("Email utilisateur introuvable côté Supabase.");
  }

  const prismaUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true }
  });
  if (!prismaUser) {
    throw new Error("Utilisateur applicatif introuvable pour cet email Supabase.");
  }

  const { firstName, lastName } = splitDisplayName(prismaUser.name);
  return {
    appUserId: prismaUser.id,
    email: prismaUser.email,
    supabaseUserId,
    firstName,
    lastName
  };
}

async function readBackofficeAccessRow(
  appUserId: string
): Promise<OrganizerBackofficeAccessRow | null> {
  const supabase = getServerSupabaseClient();
  const { data } = await supabase
    .from('organizer_backoffice_access')
    .select('*')
    .eq('app_user_id', appUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function restoreBackofficeAccessRow(
  appUserId: string,
  previousRow: OrganizerBackofficeAccessRow | null
) {
  const supabase = getServerSupabaseClient();
  if (!previousRow) {
    await supabase
      .from('organizer_backoffice_access')
      .delete()
      .eq('app_user_id', appUserId);
    return;
  }

  await supabase.from('organizer_backoffice_access').upsert(
    {
      organizer_id: previousRow.organizer_id,
      app_user_id: previousRow.app_user_id,
      access_code: previousRow.access_code,
      role: previousRow.role,
      granted_by: previousRow.granted_by,
      granted_at: previousRow.granted_at,
      revoked_by: previousRow.revoked_by,
      revoked_at: previousRow.revoked_at,
      revoke_reason: previousRow.revoke_reason,
      created_at: previousRow.created_at,
      updated_at: previousRow.updated_at
    },
    { onConflict: 'app_user_id' }
  );
}

async function generateUniqueAccessCode() {
  const supabase = getServerSupabaseClient();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `${ACCESS_CODE_PREFIX}${Math.floor(100000 + Math.random() * 900000)}`;
    const { data } = await supabase
      .from('organizer_backoffice_access')
      .select('id')
      .eq('access_code', code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Impossible de generer un matricule d'acces unique.");
}

async function readOrganizerMemberRow(
  organizerId: string,
  supabaseUserId: string
): Promise<OrganizerMemberRow | null> {
  const supabase = getServerSupabaseClient();
  const { data } = await supabase
    .from('organizer_members')
    .select('*')
    .eq('organizer_id', organizerId)
    .eq('user_id', supabaseUserId)
    .maybeSingle();

  return data ?? null;
}

export async function upsertBackofficeAccessAndMirrorOrganizerMember(input: {
  organizerId: string;
  role: OrganizerAccessRole;
  identity: OrganizerAccessSyncIdentity;
}) {
  const organizerId = input.organizerId.trim();
  if (!organizerId) {
    throw new Error('Organisateur invalide.');
  }

  const supabase = getServerSupabaseClient();
  const previousAccessRow = await readBackofficeAccessRow(input.identity.appUserId);
  const previousMemberRow = await readOrganizerMemberRow(organizerId, input.identity.supabaseUserId);
  const accessCode = previousAccessRow?.access_code ?? (await generateUniqueAccessCode());

  const { error: upsertAccessError } = await supabase.from('organizer_backoffice_access').upsert(
    {
      organizer_id: organizerId,
      app_user_id: input.identity.appUserId,
      access_code: accessCode,
      role: input.role,
      granted_by: input.identity.email,
      granted_at: previousAccessRow?.granted_at ?? new Date().toISOString(),
      revoked_by: null,
      revoked_at: null,
      revoke_reason: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'app_user_id' }
  );

  if (upsertAccessError) {
    throw new Error(`Impossible d'enregistrer l'accès back-office (${upsertAccessError.message}).`);
  }

  const memberPatch = {
    role: input.role,
    first_name: input.identity.firstName,
    last_name: input.identity.lastName
  };

  const memberMutation = previousMemberRow
    ? await supabase
        .from('organizer_members')
        .update(memberPatch)
        .eq('id', previousMemberRow.id)
    : await supabase.from('organizer_members').insert({
        organizer_id: organizerId,
        user_id: input.identity.supabaseUserId,
        role: input.role,
        first_name: input.identity.firstName,
        last_name: input.identity.lastName
      });

  if (memberMutation.error) {
    await restoreBackofficeAccessRow(input.identity.appUserId, previousAccessRow).catch(
      () => undefined
    );
    throw new Error(`Impossible de synchroniser organizer_members (${memberMutation.error.message}).`);
  }

  return {
    organizerId,
    appUserId: input.identity.appUserId,
    supabaseUserId: input.identity.supabaseUserId,
    email: input.identity.email,
    role: input.role
  };
}

export async function removeBackofficeAccessAndMirrorOrganizerMember(input: {
  organizerId: string;
  identity: OrganizerAccessSyncIdentity;
}) {
  const organizerId = input.organizerId.trim();
  if (!organizerId) {
    throw new Error('Organisateur invalide.');
  }

  const supabase = getServerSupabaseClient();
  const previousAccessRow = await readBackofficeAccessRow(input.identity.appUserId);

  const { error: updateAccessError } = await supabase
    .from('organizer_backoffice_access')
    .update({
      revoked_by: input.identity.email,
      revoked_at: new Date().toISOString(),
      revoke_reason: 'Revoked from mnemos',
      updated_at: new Date().toISOString()
    })
    .eq('app_user_id', input.identity.appUserId);

  if (updateAccessError) {
    throw new Error(`Impossible de supprimer l'acces back-office (${updateAccessError.message}).`);
  }

  const { error: deleteMemberError } = await supabase
    .from('organizer_members')
    .delete()
    .eq('organizer_id', organizerId)
    .eq('user_id', input.identity.supabaseUserId);

  if (deleteMemberError) {
    await restoreBackofficeAccessRow(input.identity.appUserId, previousAccessRow).catch(
      () => undefined
    );
    throw new Error(`Impossible de synchroniser organizer_members (${deleteMemberError.message}).`);
  }
}

export async function syncBackofficeAccessFromOrganizerMember(input: {
  organizerId: string;
  supabaseUserId: string;
  role: OrganizerAccessRole;
  emailHint?: string | null;
}) {
  const organizerId = input.organizerId.trim();
  if (!organizerId) {
    throw new Error('Organisateur invalide.');
  }

  const identity = await resolveOrganizerAccessIdentityBySupabaseUserId({
    supabaseUserId: input.supabaseUserId,
    emailHint: input.emailHint
  });

  const supabase = getServerSupabaseClient();
  const previousAccessRow = await readBackofficeAccessRow(identity.appUserId);
  const accessCode = previousAccessRow?.access_code ?? (await generateUniqueAccessCode());
  const { error } = await supabase.from('organizer_backoffice_access').upsert(
    {
      organizer_id: organizerId,
      app_user_id: identity.appUserId,
      access_code: accessCode,
      role: input.role,
      granted_by: identity.email,
      granted_at: previousAccessRow?.granted_at ?? new Date().toISOString(),
      revoked_by: null,
      revoked_at: null,
      revoke_reason: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'app_user_id' }
  );

  if (error) {
    throw new Error(`Impossible de synchroniser organizer_backoffice_access (${error.message}).`);
  }

  return {
    organizerId,
    appUserId: identity.appUserId,
    supabaseUserId: identity.supabaseUserId,
    role: input.role
  };
}
