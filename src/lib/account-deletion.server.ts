import { getServerSupabaseClient } from '@/lib/supabase/server';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import {
  isAccountDeletionStatus,
  type AccountDeletionRequest,
  type AccountDeletionStatus
} from '@/lib/account-deletion';

type DbRow = {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  email: string;
  full_name: string;
  reason: string;
  status: string;
  notes: string;
  processed_at: string | null;
  processed_by: string | null;
};

function mapRow(row: DbRow): AccountDeletionRequest {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name ?? '',
    reason: row.reason ?? '',
    status: isAccountDeletionStatus(row.status) ? row.status : 'pending',
    notes: row.notes ?? '',
    processedAt: row.processed_at,
    processedBy: row.processed_by
  };
}

export async function getPendingAccountDeletionRequest(userId: string) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) {
    if (isMissingPublicTableError(error) || error.code === '42P01') {
      return null;
    }
    throw new Error(error.message);
  }
  return data ? mapRow(data as DbRow) : null;
}

export async function createAccountDeletionRequest(input: {
  userId: string;
  email: string;
  fullName?: string;
  reason: string;
}) {
  const existing = await getPendingAccountDeletionRequest(input.userId);
  if (existing) {
    throw new Error('Une demande de suppression est déjà en cours pour ce compte.');
  }

  const supabase = getServerSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .insert({
      user_id: input.userId,
      email: input.email.trim().toLowerCase(),
      full_name: (input.fullName ?? '').trim(),
      reason: input.reason.trim(),
      status: 'pending',
      notes: '',
      created_at: now,
      updated_at: now
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Une demande de suppression est déjà en cours pour ce compte.');
    }
    throw new Error(error.message);
  }

  return mapRow(data as DbRow);
}

export async function updateAccountDeletionRequestStatus(input: {
  id: string;
  status: AccountDeletionStatus;
  notes?: string;
  processedBy: string;
}) {
  const supabase = getServerSupabaseClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    notes: (input.notes ?? '').trim(),
    updated_at: now
  };

  if (input.status === 'processed' || input.status === 'rejected') {
    patch.processed_at = now;
    patch.processed_by = input.processedBy;
  } else {
    patch.processed_at = null;
    patch.processed_by = null;
  }

  const { data, error } = await supabase
    .from('account_deletion_requests')
    .update(patch)
    .eq('id', input.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as DbRow);
}
