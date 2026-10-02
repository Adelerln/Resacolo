import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

function normalizeEmail(value: string | null | undefined) {
  const email = String(value ?? '')
    .trim()
    .toLowerCase();
  return email.includes('@') ? email : null;
}

async function emailForMemberUserId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return normalizeEmail(data.user?.email);
  } catch (error) {
    console.warn('[organizer-notification-recipients] user email lookup failed', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function emailForOrganizerMemberId(
  supabase: SupabaseClient<Database>,
  memberId: string | null | undefined,
  organizerId: string
): Promise<string | null> {
  const id = memberId?.trim();
  if (!id) return null;

  const { data: member, error } = await supabase
    .from('organizer_members')
    .select('user_id,organizer_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !member || member.organizer_id !== organizerId) {
    return null;
  }

  return emailForMemberUserId(supabase, member.user_id);
}

async function fallbackOrganizerContactEmails(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  contactEmail: string | null | undefined
): Promise<string[]> {
  const emails = new Set<string>();
  const contact = normalizeEmail(contactEmail);
  if (contact) emails.add(contact);

  if (emails.size > 0) return Array.from(emails);

  const { data: owners } = await supabase
    .from('organizer_members')
    .select('user_id')
    .eq('organizer_id', organizerId)
    .eq('role', 'OWNER')
    .limit(5);

  await Promise.all(
    (owners ?? []).map(async (owner) => {
      const ownerEmail = await emailForMemberUserId(supabase, owner.user_id);
      if (ownerEmail) emails.add(ownerEmail);
    })
  );

  return Array.from(emails);
}

/** Email principal pour les notifications de commande / statut organisateur. */
export async function resolveOrganizerOrderStatusNotificationEmail(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  contactEmail?: string | null
): Promise<string | null> {
  let designatedMemberId: string | null = null;
  let resolvedContact = contactEmail;

  const { data: row, error } = await supabase
    .from('organizers')
    .select('contact_email,order_status_notify_member_id')
    .eq('id', organizerId)
    .maybeSingle();

  if (!error && row) {
    designatedMemberId = row.order_status_notify_member_id;
    if (resolvedContact == null) {
      resolvedContact = row.contact_email;
    }
  }

  const designated = await emailForOrganizerMemberId(supabase, designatedMemberId, organizerId);
  if (designated) return designated;

  const fallbacks = await fallbackOrganizerContactEmails(supabase, organizerId, resolvedContact);
  return fallbacks[0] ?? null;
}

/** Email principal pour le récap hebdomadaire des places. */
export async function resolveOrganizerWeeklyRecapEmail(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  contactEmail?: string | null
): Promise<string | null> {
  let designatedMemberId: string | null = null;
  let resolvedContact = contactEmail;

  const { data: row, error } = await supabase
    .from('organizers')
    .select('contact_email,weekly_recap_notify_member_id')
    .eq('id', organizerId)
    .maybeSingle();

  if (!error && row) {
    designatedMemberId = row.weekly_recap_notify_member_id;
    if (resolvedContact == null) {
      resolvedContact = row.contact_email;
    }
  }

  const designated = await emailForOrganizerMemberId(supabase, designatedMemberId, organizerId);
  if (designated) return designated;

  const fallbacks = await fallbackOrganizerContactEmails(supabase, organizerId, resolvedContact);
  return fallbacks[0] ?? null;
}

/** Emails pour alertes transfert de demandes (même logique que commandes). */
export async function resolveOrganizerInquiryNotificationEmails(
  supabase: SupabaseClient<Database>,
  organizerId: string
): Promise<{ organizerName: string; emails: string[] }> {
  const { data: organizer, error } = await supabase
    .from('organizers')
    .select('id,name,contact_email,order_status_notify_member_id')
    .eq('id', organizerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const emails = new Set<string>();
  const primary = await resolveOrganizerOrderStatusNotificationEmail(
    supabase,
    organizerId,
    organizer?.contact_email
  );
  if (primary) emails.add(primary);

  if (emails.size === 0) {
    const fallbacks = await fallbackOrganizerContactEmails(
      supabase,
      organizerId,
      organizer?.contact_email
    );
    for (const email of fallbacks) emails.add(email);
  }

  return {
    organizerName: organizer?.name?.trim() || 'Organisateur',
    emails: Array.from(emails)
  };
}
