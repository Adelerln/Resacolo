'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { canManageBackofficeAccess } from '@/lib/mnemos-backoffice-access-admins';
import { isOrganizerAccessRole } from '@/lib/organizer-access';
import {
  removeBackofficeAccessAndMirrorOrganizerMember,
  resolveOrganizerAccessIdentityByAppUserId,
  resolveOrganizerAccessIdentityByEmail,
  upsertBackofficeAccessAndMirrorOrganizerMember
} from '@/lib/organizer-backoffice-sync.server';

function ensureOrganizerId(formData: FormData): string {
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  if (!organizerId) {
    redirect('/mnemos/organizers');
  }
  return organizerId;
}

function redirectWithAccessError(organizerId: string, message: string): never {
  redirect(`/mnemos/organizers/${organizerId}?access_error=${encodeURIComponent(message)}`);
}

function redirectWithAccessSuccess(organizerId: string): never {
  revalidatePath('/mnemos/organizers');
  revalidatePath(`/mnemos/organizers/${organizerId}`);
  revalidatePath('/admin/utilisateurs');
  revalidatePath(`/admin/organizers/${organizerId}`);
  redirect(`/mnemos/organizers/${organizerId}?access_saved=1`);
}

function ensureOrganizerAccessRole(organizerId: string, value: string) {
  if (!isOrganizerAccessRole(value)) {
    redirectWithAccessError(organizerId, 'Rôle invalide.');
  }

  return value;
}

export async function addBackofficeAccess(formData: FormData) {
  const session = await requireRole('ADMIN');
  if (!canManageBackofficeAccess(session.email)) {
    redirectWithAccessError(ensureOrganizerId(formData), 'Vous ne pouvez pas gerer ces acces.');
  }
  const organizerId = ensureOrganizerId(formData);
  const email = String(formData.get('email') ?? '').trim();
  const role = ensureOrganizerAccessRole(organizerId, String(formData.get('role') ?? '').trim());

  if (!email) {
    redirectWithAccessError(organizerId, 'Email requis.');
  }

  try {
    const identity = await resolveOrganizerAccessIdentityByEmail(email);
    await upsertBackofficeAccessAndMirrorOrganizerMember({
      organizerId,
      role,
      identity
    });
  } catch (error) {
    redirectWithAccessError(
      organizerId,
      error instanceof Error ? error.message : 'Impossible d’ajouter cet accès.'
    );
  }

  redirectWithAccessSuccess(organizerId);
}

export async function updateBackofficeAccessRole(formData: FormData) {
  const session = await requireRole('ADMIN');
  if (!canManageBackofficeAccess(session.email)) {
    redirectWithAccessError(ensureOrganizerId(formData), 'Vous ne pouvez pas gerer ces acces.');
  }
  const organizerId = ensureOrganizerId(formData);
  const appUserId = String(formData.get('app_user_id') ?? '').trim();
  const role = ensureOrganizerAccessRole(organizerId, String(formData.get('role') ?? '').trim());

  if (!appUserId) {
    redirectWithAccessError(organizerId, 'Utilisateur applicatif introuvable.');
  }

  try {
    const identity = await resolveOrganizerAccessIdentityByAppUserId(appUserId);
    await upsertBackofficeAccessAndMirrorOrganizerMember({
      organizerId,
      role,
      identity
    });
  } catch (error) {
    redirectWithAccessError(
      organizerId,
      error instanceof Error ? error.message : 'Impossible de modifier cet accès.'
    );
  }

  redirectWithAccessSuccess(organizerId);
}

export async function removeBackofficeAccess(formData: FormData) {
  const session = await requireRole('ADMIN');
  if (!canManageBackofficeAccess(session.email)) {
    redirectWithAccessError(ensureOrganizerId(formData), 'Vous ne pouvez pas gerer ces acces.');
  }
  const organizerId = ensureOrganizerId(formData);
  const appUserId = String(formData.get('app_user_id') ?? '').trim();

  if (!appUserId) {
    redirectWithAccessError(organizerId, 'Utilisateur applicatif introuvable.');
  }

  try {
    const identity = await resolveOrganizerAccessIdentityByAppUserId(appUserId);
    await removeBackofficeAccessAndMirrorOrganizerMember({
      organizerId,
      identity
    });
  } catch (error) {
    redirectWithAccessError(
      organizerId,
      error instanceof Error ? error.message : 'Impossible de supprimer cet accès.'
    );
  }

  redirectWithAccessSuccess(organizerId);
}
