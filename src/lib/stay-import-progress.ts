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

export function readStayImportProgress(rawPayload: unknown) {
  const progress = toObject(toObject(rawPayload).import_progress);
  return {
    step: typeof progress.step === 'string' ? progress.step : 'created',
    completed: Boolean(progress.completed),
    error: typeof progress.error === 'string' ? progress.error : null
  };
}

export function shouldKickOffStayImport(
  rawPayload: unknown,
  options?: { datedSessionCount?: number; sourceUrl?: string | null }
) {
  const progress = readStayImportProgress(rawPayload);
  if (progress.completed && progress.step === 'completed') {
    const sourceUrl = String(options?.sourceUrl ?? '').toLowerCase();
    const isZigotoursSource = sourceUrl.includes('zigotours');
    if (isZigotoursSource && (options?.datedSessionCount ?? 0) === 0) {
      return true;
    }
    return false;
  }
  return progress.step === 'created' || progress.step === 'failed' || !progress.step;
}

export function isStayImportAlreadyRunning(rawPayload: unknown) {
  const progress = readStayImportProgress(rawPayload);
  if (progress.completed) return false;
  return (
    progress.step !== 'created' &&
    progress.step !== 'queued' &&
    progress.step !== 'failed' &&
    Boolean(progress.step)
  );
}

export function readStayImportIncludePricing(rawPayload: unknown) {
  const importOptions = toObject(toObject(rawPayload).import_options);
  const rawValue = importOptions.include_pricing;
  if (typeof rawValue === 'boolean') return rawValue;
  if (typeof rawValue === 'number') return rawValue !== 0;
  if (typeof rawValue !== 'string') return true;
  const normalized = rawValue.trim().toLowerCase();
  if (['0', 'false', 'off', 'no', 'non'].includes(normalized)) return false;
  return true;
}

export function readStayImportAccommodationId(rawPayload: unknown) {
  const importOptions = toObject(toObject(rawPayload).import_options);
  const accommodationId = importOptions.existing_accommodation_id;
  return typeof accommodationId === 'string' ? accommodationId.trim() : '';
}
