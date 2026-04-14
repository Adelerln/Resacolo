import type { Stay } from '@/types/stay';
import {
  createCartItemId,
  type CartItem,
  type CartItemSelection,
  type CartItemSelectionLabels
} from '@/types/cart';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function asNullableId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return asString(value);
}

function normalizeSelectionLabels(raw: unknown): CartItemSelectionLabels | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;
  const sessionLine = asString(record.sessionLine);
  const transportLine = asString(record.transportLine);
  const insuranceLine = asString(record.insuranceLine);
  const extraLine = asString(record.extraLine);
  if (!sessionLine && !transportLine && !insuranceLine && !extraLine) return undefined;
  return { sessionLine, transportLine, insuranceLine, extraLine };
}

function normalizeSelection(value: unknown): CartItemSelection {
  const record = asRecord(value);

  return {
    sessionId: asNullableId(record?.sessionId),
    transportMode: asString(record?.transportMode) ?? 'Sans transport',
    transportOptionId: asNullableId(record?.transportId ?? record?.transportOptionId),
    departureTransportOptionId: asNullableId(record?.departureTransportId ?? record?.departureTransportOptionId),
    returnTransportOptionId: asNullableId(record?.returnTransportId ?? record?.returnTransportOptionId),
    departureCity: asNullableId(record?.departureCity),
    returnCity: asNullableId(record?.returnCity),
    insuranceOptionId: asNullableId(record?.insuranceId ?? record?.insuranceOptionId),
    extraOptionId: asNullableId(record?.extraOptionId)
  };
}

function normalizeExistingCartItem(value: Record<string, unknown>): CartItem | null {
  const id = asString(value.id) ?? createCartItemId();
  const stayId = asString(value.stayId);
  const slug = asString(value.slug);
  const title = asString(value.title);
  const organizerId = asString(value.organizerId);
  const organizerName = asString(value.organizerName);
  const location = asString(value.location);
  const duration = asString(value.duration);
  const ageRange = asString(value.ageRange);

  if (!stayId || !slug || !title || !organizerId || !organizerName || !location || !duration || !ageRange) {
    return null;
  }

  return {
    id,
    stayId,
    slug,
    title,
    organizerId,
    organizerName,
    location,
    duration,
    ageRange,
    coverImage: asString(value.coverImage) ?? undefined,
    unitPrice: asNumberOrNull(value.unitPrice),
    selection: normalizeSelection(value.selection),
    selectionLabels: normalizeSelectionLabels(value.selectionLabels),
    addedAt: asString(value.addedAt) ?? new Date().toISOString()
  };
}

export function createCartItemFromStay(stay: Stay, input: {
  unitPrice: number | null;
  selection: Partial<CartItemSelection>;
  selectionLabels?: CartItemSelectionLabels;
}): CartItem {
  return {
    id: createCartItemId(),
    stayId: stay.id,
    slug: stay.canonicalSlug,
    title: stay.title,
    organizerId: stay.organizerId,
    organizerName: stay.organizer.name,
    location: stay.location,
    duration: stay.duration,
    ageRange: stay.ageRange,
    coverImage: stay.coverImage,
    unitPrice: input.unitPrice,
    selection: {
      sessionId: input.selection.sessionId ?? null,
      transportMode: input.selection.transportMode ?? 'Sans transport',
      transportOptionId: input.selection.transportOptionId ?? null,
      departureTransportOptionId: input.selection.departureTransportOptionId ?? null,
      returnTransportOptionId: input.selection.returnTransportOptionId ?? null,
      departureCity: input.selection.departureCity ?? null,
      returnCity: input.selection.returnCity ?? null,
      insuranceOptionId: input.selection.insuranceOptionId ?? null,
      extraOptionId: input.selection.extraOptionId ?? null
    },
    selectionLabels: input.selectionLabels,
    addedAt: new Date().toISOString()
  };
}

export function normalizeCartStorageItem(value: unknown): CartItem | null {
  const record = asRecord(value);
  if (!record) return null;

  const asCartItem = normalizeExistingCartItem(record);
  if (asCartItem) return asCartItem;

  const stayId = asString(record.id);
  const slug = asString(record.slug);
  const title = asString(record.title);
  const organizerId = asString(record.organizerId);
  const location = asString(record.location);
  const duration = asString(record.duration);
  const ageRange = asString(record.ageRange);

  const organizerRecord = asRecord(record.organizer);
  const organizerName = asString(organizerRecord?.name);

  if (!stayId || !slug || !title || !organizerId || !location || !duration || !ageRange || !organizerName) {
    return null;
  }

  const rawContext = asRecord(record.rawContext);
  const selectedBooking = rawContext ? rawContext.selected_booking : null;

  return {
    id: createCartItemId(),
    stayId,
    slug,
    title,
    organizerId,
    organizerName,
    location,
    duration,
    ageRange,
    coverImage: asString(record.coverImage) ?? undefined,
    unitPrice: asNumberOrNull(record.priceFrom),
    selection: normalizeSelection(selectedBooking),
    selectionLabels: normalizeSelectionLabels(record.selectionLabels),
    addedAt: new Date().toISOString()
  };
}
