'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import { getServerSupabaseClient } from '@/lib/supabase/server';

function parseOptionalEuros(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function stayPath(stayId: string, returnTo: string): string {
  return returnTo === 'edit' ? `/organisme/stays/${stayId}/edit` : `/organisme/sejours/${stayId}`;
}

async function verifyStayAccess(stayId: string, organizerId: string) {
  const supabase = getServerSupabaseClient();
  const { data: stay } = await supabase
    .from('stays')
    .select('id,organizer_id')
    .eq('id', stayId)
    .maybeSingle();
  if (!stay || stay.organizer_id !== organizerId) {
    redirect(withOrganizerQuery('/organisme/sejours', organizerId));
  }
}

function revalidateStayPaths(stayId: string) {
  revalidatePath(`/organisme/sejours/${stayId}`);
  revalidatePath(`/organisme/stays/${stayId}`);
  revalidatePath(`/organisme/stays/${stayId}/edit`);
  revalidatePath('/organisme/sejours');
  revalidatePath('/organisme/stays');
}

export async function organizerStayAddSession(formData: FormData) {
  const supabase = getServerSupabaseClient();
  const stayId = String(formData.get('stay_id') ?? '').trim();
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? 'detail');
  const base = stayPath(stayId, returnTo);

  await verifyStayAccess(stayId, organizerId);

  const startDate = String(formData.get('startDate') ?? '').trim();
  const endDate = String(formData.get('endDate') ?? '').trim();
  const capacityTotal = Number(formData.get('capacityTotal') ?? 0);
  const amountEuros = parseOptionalEuros(formData.get('amount_euros'));
  const rawAmount = String(formData.get('amount_euros') ?? '').trim();

  if (
    !startDate ||
    !endDate ||
    Number.isNaN(capacityTotal) ||
    capacityTotal < 0 ||
    (rawAmount && amountEuros === null)
  ) {
    redirect(withOrganizerQuery(`${base}?error=invalid-session`, organizerId));
  }

  const { data: createdSession, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      stay_id: stayId,
      start_date: startDate,
      end_date: endDate,
      capacity_total: capacityTotal,
      capacity_reserved: 0,
      status: 'OPEN'
    })
    .select('id')
    .single();

  if (sessionError || !createdSession) {
    const message = sessionError?.message ?? 'Impossible de creer la session.';
    console.error('Erreur Supabase (add session)', message);
    redirect(withOrganizerQuery(`${base}?error=${encodeURIComponent(message)}`, organizerId));
  }

  if (amountEuros !== null) {
    const { error: priceError } = await supabase.from('session_prices').insert({
      session_id: createdSession.id,
      amount_cents: Math.round(amountEuros * 100),
      currency: 'EUR'
    });

    if (priceError) {
      await supabase.from('sessions').delete().eq('id', createdSession.id).eq('stay_id', stayId);
      console.error('Erreur Supabase (add session price)', priceError.message);
      redirect(withOrganizerQuery(`${base}?error=${encodeURIComponent(priceError.message)}`, organizerId));
    }
  }

  revalidateStayPaths(stayId);
  redirect(withOrganizerQuery(base, organizerId));
}

export async function organizerStayDeleteSession(formData: FormData) {
  const supabase = getServerSupabaseClient();
  const stayId = String(formData.get('stay_id') ?? '').trim();
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? 'detail');
  const base = stayPath(stayId, returnTo);

  await verifyStayAccess(stayId, organizerId);

  const sessionId = String(formData.get('session_id') ?? '').trim();

  if (!sessionId) {
    redirect(withOrganizerQuery(base, organizerId));
  }

  const { error } = await supabase.from('sessions').delete().eq('id', sessionId).eq('stay_id', stayId);

  if (error) {
    console.error('Erreur Supabase (delete session)', error.message);
    redirect(withOrganizerQuery(`${base}?error=${encodeURIComponent(error.message)}`, organizerId));
  }

  revalidateStayPaths(stayId);
  redirect(withOrganizerQuery(`${base}?saved=1`, organizerId));
}

export async function organizerStayUpdateSessionRemainingPlaces(formData: FormData) {
  const supabase = getServerSupabaseClient();
  const stayId = String(formData.get('stay_id') ?? '').trim();
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? 'detail');
  const base = stayPath(stayId, returnTo);

  await verifyStayAccess(stayId, organizerId);

  const sessionId = String(formData.get('session_id') ?? '').trim();
  const remainingPlaces = Number(formData.get('remaining_places') ?? NaN);

  if (!sessionId || Number.isNaN(remainingPlaces) || remainingPlaces < 0) {
    redirect(withOrganizerQuery(`${base}?error=invalid-session-capacity`, organizerId));
  }

  const { data: sessionItem } = await supabase
    .from('sessions')
    .select('id,stay_id,capacity_total,status')
    .eq('id', sessionId)
    .eq('stay_id', stayId)
    .maybeSingle();

  if (!sessionItem) {
    redirect(withOrganizerQuery(`${base}?error=invalid-session-capacity`, organizerId));
  }

  const reservedCount = (await getReservedSessionCounts(supabase, [sessionId])).get(sessionId) ?? 0;
  const capacityTotal = reservedCount + remainingPlaces;
  const nextStatus =
    sessionItem.status === 'COMPLETED' || sessionItem.status === 'ARCHIVED'
      ? sessionItem.status
      : reservedCount >= capacityTotal
        ? 'FULL'
        : 'OPEN';

  const { error } = await supabase
    .from('sessions')
    .update({
      capacity_total: capacityTotal,
      capacity_reserved: reservedCount,
      status: nextStatus
    })
    .eq('id', sessionId)
    .eq('stay_id', stayId);

  if (error) {
    console.error('Erreur Supabase (update remaining places)', error.message);
    redirect(withOrganizerQuery(`${base}?error=${encodeURIComponent(error.message)}`, organizerId));
  }

  revalidateStayPaths(stayId);
  revalidatePath('/sejours');
  redirect(withOrganizerQuery(`${base}?saved=1`, organizerId));
}
