import { randomUUID } from 'node:crypto';
import { countDatedDraftSessions } from '@/lib/stay-draft-import';
import { buildImportProgress, runStayImportInBackground } from '@/lib/run-stay-import-background';
import {
  isStayImportAlreadyRunning,
  readStayImportAccommodationId,
  readStayImportIncludePricing,
  shouldKickOffStayImport
} from '@/lib/stay-import-progress';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

type StayDraftRow = Record<string, unknown> & {
  id: string;
  organizer_id?: string | null;
  source_url: string | null;
  sessions_json: unknown;
  raw_payload: unknown;
};

type StayImportJobRow = {
  id: string;
  draft_id: string;
  organizer_id: string;
  source_url: string;
  include_pricing: boolean;
  selected_accommodation_id: string | null;
  status: string;
  attempt_count: number;
  next_run_at: string;
  locked_at: string | null;
  lock_token: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type EnqueueOutcome = 'started' | 'already_running' | 'already_completed' | 'missing_source_url';

const ACTIVE_JOB_STATUSES = ['queued', 'running', 'retryable'] as const;
const MAX_STAY_IMPORT_JOB_ATTEMPTS = 3;

function toObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      return {};
    }
  }
  return {};
}

async function mergeDraftRawPayloadPatch(draftId: string, patch: Record<string, unknown>) {
  const supabase = getServerSupabaseClient();
  const { data: row } = await supabase.from('stay_drafts').select('raw_payload').eq('id', draftId).maybeSingle();
  const base = toObject(row?.raw_payload);
  const { error } = await supabase
    .from('stay_drafts')
    .update({
      raw_payload: { ...base, ...patch } as Json
    })
    .eq('id', draftId);

  if (error) {
    console.error('[stay-import-jobs] raw_payload merge failed', { draftId, message: error.message });
  }
}

async function mergeDraftImportDebugPatch(draftId: string, patch: Record<string, unknown>) {
  const supabase = getServerSupabaseClient();
  const { data: row } = await supabase.from('stay_drafts').select('raw_payload').eq('id', draftId).maybeSingle();
  const base = toObject(row?.raw_payload);
  const currentDebug = toObject(base.import_debug);
  const { error } = await supabase
    .from('stay_drafts')
    .update({
      raw_payload: { ...base, import_debug: { ...currentDebug, ...patch } } as Json
    })
    .eq('id', draftId);

  if (error) {
    console.error('[stay-import-jobs] import_debug merge failed', { draftId, message: error.message });
  }
}

async function readActiveStayImportJob(draftId: string): Promise<StayImportJobRow | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('stay_import_jobs')
    .select('*')
    .eq('draft_id', draftId)
    .in('status', [...ACTIVE_JOB_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[stay-import-jobs] active job lookup failed', { draftId, message: error.message });
    return null;
  }

  return (data as StayImportJobRow | null) ?? null;
}

async function fetchSelectedAccommodation(
  accommodationId: string,
  organizerId: string
): Promise<{ id: string; name: string } | null> {
  const supabase = getServerSupabaseClient();
  const { data: accommodation } = await supabase
    .from('accommodations')
    .select('id,name')
    .eq('id', accommodationId)
    .eq('organizer_id', organizerId)
    .maybeSingle();

  return accommodation ?? null;
}

function isUniqueActiveJobConflict(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error || error.code !== '23505') return false;
  return String(error.message ?? '').includes('stay_import_jobs_active_draft_uidx');
}

function buildRetryDelayMs(attemptCount: number): number {
  return Math.min(15 * 60_000, Math.max(1, attemptCount) * 60_000);
}

function addDelay(date: Date, delayMs: number): string {
  return new Date(date.getTime() + delayMs).toISOString();
}

async function setDraftQueuedState(
  draftId: string,
  job: Pick<StayImportJobRow, 'id' | 'attempt_count' | 'status' | 'next_run_at'>,
  label: string
) {
  await mergeDraftRawPayloadPatch(draftId, {
    import_progress: buildImportProgress('queued', { label })
  });
  await mergeDraftImportDebugPatch(draftId, {
    job_id: job.id,
    attempt_count: job.attempt_count,
    job_status: job.status,
    next_run_at: job.next_run_at
  });
}

export async function enqueueStayImportForDraftRow(
  draft: StayDraftRow,
  selectedOrganizerId: string
): Promise<EnqueueOutcome> {
  const rawPayload = draft.raw_payload;
  if (
    !shouldKickOffStayImport(rawPayload, {
      datedSessionCount: countDatedDraftSessions(draft.sessions_json),
      sourceUrl: typeof draft.source_url === 'string' ? draft.source_url : null
    })
  ) {
    if (isStayImportAlreadyRunning(rawPayload)) {
      return 'already_running';
    }
    const activeJob = await readActiveStayImportJob(draft.id);
    if (activeJob) return 'already_running';
    return 'already_completed';
  }

  const sourceUrl = String(draft.source_url ?? '').trim();
  if (!sourceUrl) {
    return 'missing_source_url';
  }

  const rawAccommodationId = readStayImportAccommodationId(rawPayload);
  const selectedAccommodationId = rawAccommodationId.trim() || null;
  const includePricing = readStayImportIncludePricing(rawPayload);
  const supabase = getServerSupabaseClient();

  const existingActiveJob = await readActiveStayImportJob(draft.id);
  if (existingActiveJob) {
    return 'already_running';
  }

  const { data, error } = await supabase
    .from('stay_import_jobs')
    .insert({
      draft_id: draft.id,
      organizer_id: selectedOrganizerId,
      source_url: sourceUrl,
      include_pricing: includePricing,
      selected_accommodation_id: selectedAccommodationId,
      status: 'queued',
      next_run_at: new Date().toISOString()
    })
    .select('*')
    .single();

  let job = (data as StayImportJobRow | null) ?? null;
  if (error) {
    if (!isUniqueActiveJobConflict(error)) {
      throw new Error(error.message ?? "Impossible de créer le job d'import.");
    }
    job = await readActiveStayImportJob(draft.id);
  }

  if (!job) {
    throw new Error("Impossible de récupérer le job d'import créé.");
  }

  await setDraftQueuedState(draft.id, job, 'En file d’attente');
  return 'started';
}

type ClaimedStayImportJob = StayImportJobRow;

async function claimNextStayImportJob(): Promise<ClaimedStayImportJob | null> {
  const supabase = getServerSupabaseClient();
  const lockToken = randomUUID();
  const { data, error } = await supabase.rpc('claim_next_stay_import_job', {
    p_lock_token: lockToken
  });

  if (error) {
    throw new Error(error.message ?? 'Impossible de réclamer le prochain job d’import.');
  }

  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as ClaimedStayImportJob;
}

async function markJobSucceeded(jobId: string) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('stay_import_jobs')
    .update({
      status: 'succeeded',
      locked_at: null,
      lock_token: null,
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (error) {
    console.error('[stay-import-jobs] mark succeeded failed', { jobId, message: error.message });
  }
}

async function markJobFailed(jobId: string, errorMessage: string) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('stay_import_jobs')
    .update({
      status: 'failed',
      locked_at: null,
      lock_token: null,
      last_error: errorMessage,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (error) {
    console.error('[stay-import-jobs] mark failed failed', { jobId, message: error.message });
  }
}

async function markJobRetryable(job: ClaimedStayImportJob, errorMessage: string) {
  const supabase = getServerSupabaseClient();
  const nextRunAt = addDelay(new Date(), buildRetryDelayMs(job.attempt_count));
  const { error } = await supabase
    .from('stay_import_jobs')
    .update({
      status: 'retryable',
      locked_at: null,
      lock_token: null,
      last_error: errorMessage,
      next_run_at: nextRunAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', job.id);

  if (error) {
    console.error('[stay-import-jobs] mark retryable failed', { jobId: job.id, message: error.message });
  }

  await setDraftQueuedState(job.draft_id, { ...job, status: 'retryable', next_run_at: nextRunAt }, 'Relance programmée');
}

async function readDraftImportState(draftId: string): Promise<{ step: string; error: string | null }> {
  const supabase = getServerSupabaseClient();
  const { data } = await supabase.from('stay_drafts').select('raw_payload').eq('id', draftId).maybeSingle();
  const rawPayload = toObject(data?.raw_payload);
  const importProgress = toObject(rawPayload.import_progress);
  return {
    step: typeof importProgress.step === 'string' ? importProgress.step : '',
    error: typeof importProgress.error === 'string' ? importProgress.error : null
  };
}

async function fetchStayDraftForJob(job: ClaimedStayImportJob): Promise<StayDraftRow | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('stay_drafts')
    .select('*')
    .eq('id', job.draft_id)
    .eq('organizer_id', job.organizer_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Impossible de charger le brouillon du job.');
  }

  return (data as StayDraftRow | null) ?? null;
}

export async function processOneQueuedStayImportJob(): Promise<
  | { status: 'idle' }
  | { status: 'processed'; jobId: string; outcome: 'succeeded' | 'failed' | 'retryable' }
> {
  const job = await claimNextStayImportJob();
  if (!job) {
    return { status: 'idle' };
  }

  try {
    await mergeDraftImportDebugPatch(job.draft_id, {
      job_id: job.id,
      attempt_count: job.attempt_count,
      job_status: job.status
    });

    const draft = await fetchStayDraftForJob(job);
    if (!draft) {
      await markJobFailed(job.id, 'Brouillon introuvable pour ce job.');
      return { status: 'processed', jobId: job.id, outcome: 'failed' };
    }

    let selectedAccommodation: { id: string; name: string } | null = null;
    if (job.selected_accommodation_id) {
      selectedAccommodation = await fetchSelectedAccommodation(job.selected_accommodation_id, job.organizer_id);
    }

    await runStayImportInBackground({
      draftId: draft.id,
      sourceUrl: job.source_url,
      selectedOrganizerId: job.organizer_id,
      selectedAccommodation,
      includePricing: job.include_pricing,
      draftColumnKeys: Object.keys(draft),
      jobId: job.id,
      jobAttemptCount: job.attempt_count
    });

    const finalImportState = await readDraftImportState(job.draft_id);
    if (finalImportState.step === 'completed') {
      await markJobSucceeded(job.id);
      return { status: 'processed', jobId: job.id, outcome: 'succeeded' };
    }

    await markJobFailed(
      job.id,
      finalImportState.error ?? "L'import s'est terminé sans finaliser le brouillon."
    );
    return { status: 'processed', jobId: job.id, outcome: 'failed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue du worker.';
    await mergeDraftImportDebugPatch(job.draft_id, {
      job_id: job.id,
      attempt_count: job.attempt_count,
      job_status: 'running',
      worker_error: message
    });

    if (job.attempt_count >= MAX_STAY_IMPORT_JOB_ATTEMPTS) {
      await markJobFailed(job.id, message);
      await mergeDraftRawPayloadPatch(job.draft_id, {
        import_progress: buildImportProgress('failed', { error: message })
      });
      return { status: 'processed', jobId: job.id, outcome: 'failed' };
    }

    await markJobRetryable(job, message);
    return { status: 'processed', jobId: job.id, outcome: 'retryable' };
  }
}

function readWorkerSecret(): string {
  return process.env.STAY_IMPORT_WORKER_SECRET?.trim() ?? '';
}

export function isAuthorizedStayImportWorkerRequest(headers: Headers): boolean {
  const configuredSecret = readWorkerSecret();
  if (!configuredSecret) return true;
  const provided = headers.get('x-stay-import-worker-secret')?.trim() ?? '';
  return provided.length > 0 && provided === configuredSecret;
}

export async function triggerStayImportWorker(baseUrl: string): Promise<void> {
  const secret = readWorkerSecret();
  const target = new URL('/api/internal/stay-import-worker', baseUrl).toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1_500);

  try {
    await fetch(target, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(secret ? { 'x-stay-import-worker-secret': secret } : {})
      },
      cache: 'no-store',
      signal: controller.signal
    });
  } catch (error) {
    console.warn('[stay-import-jobs] immediate worker trigger failed', {
      target,
      error: error instanceof Error ? error.message : 'unknown-error'
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
