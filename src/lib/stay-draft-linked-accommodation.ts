import type { Json } from '@/types/supabase';

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function toJsonOrNull(value: unknown): Json | null {
  if (value == null) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return value as Json;
  }
  return null;
}

/**
 * Applique (ou retire) le rattachement à un hébergement catalogue sur le brouillon.
 * Conserve le JSON extrait IA dans raw_payload pour pouvoir revenir en mode « créer ».
 */
export function applyDraftLinkedAccommodationChoice(input: {
  rawPayload: Record<string, unknown>;
  accommodationsJson: Json | Record<string, unknown> | null | undefined;
  linkedAccommodationId: string | null | undefined;
  linkedAccommodationName?: string | null;
}): {
  rawPayload: Record<string, unknown>;
  accommodationsJson: Json | null;
} {
  const linkedId =
    typeof input.linkedAccommodationId === 'string' && input.linkedAccommodationId.trim().length > 0
      ? input.linkedAccommodationId.trim()
      : null;

  const importOptions = asObject(input.rawPayload.import_options);

  if (!linkedId) {
    const restored =
      input.rawPayload.deferred_accommodations_json &&
      typeof input.rawPayload.deferred_accommodations_json === 'object' &&
      !Array.isArray(input.rawPayload.deferred_accommodations_json)
        ? toJsonOrNull(input.rawPayload.deferred_accommodations_json)
        : toJsonOrNull(input.accommodationsJson);

    return {
      rawPayload: {
        ...input.rawPayload,
        import_options: {
          ...importOptions,
          existing_accommodation_id: null,
          existing_accommodation_name: null
        },
        deferred_accommodations_json: null
      },
      accommodationsJson: restored
    };
  }

  const currentAccommodation =
    input.accommodationsJson &&
    typeof input.accommodationsJson === 'object' &&
    !Array.isArray(input.accommodationsJson)
      ? toJsonOrNull(input.accommodationsJson)
      : null;
  const alreadyDeferred =
    input.rawPayload.deferred_accommodations_json &&
    typeof input.rawPayload.deferred_accommodations_json === 'object' &&
    !Array.isArray(input.rawPayload.deferred_accommodations_json)
      ? toJsonOrNull(input.rawPayload.deferred_accommodations_json)
      : null;

  return {
    rawPayload: {
      ...input.rawPayload,
      import_options: {
        ...importOptions,
        existing_accommodation_id: linkedId,
        existing_accommodation_name: input.linkedAccommodationName?.trim() || null
      },
      deferred_accommodations_json: currentAccommodation ?? alreadyDeferred
    },
    accommodationsJson: null
  };
}
