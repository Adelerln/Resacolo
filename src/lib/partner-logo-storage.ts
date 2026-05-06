import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const PARTNER_LOGO_BUCKET = 'collectivity-logo';
const PARTNER_LOGO_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const PARTNER_LOGO_MAX_SIZE_BYTES = 5 * 1024 * 1024;

async function ensurePartnerLogoBucket(supabase: SupabaseClient<Database>) {
  const { error } = await supabase.storage.getBucket(PARTNER_LOGO_BUCKET);
  if (!error) return;

  const { error: createError } = await supabase.storage.createBucket(PARTNER_LOGO_BUCKET, {
    public: true,
    allowedMimeTypes: PARTNER_LOGO_ALLOWED_MIME_TYPES,
    fileSizeLimit: PARTNER_LOGO_MAX_SIZE_BYTES
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw createError;
  }
}

export function isPartnerLogoFileAccepted(file: File) {
  return PARTNER_LOGO_ALLOWED_MIME_TYPES.includes(file.type);
}

export async function uploadPartnerLogoFile(
  supabase: SupabaseClient<Database>,
  collectivityId: string,
  file: File
) {
  await ensurePartnerLogoBucket(supabase);

  const path = `collectivities/${collectivityId}/logo`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(PARTNER_LOGO_BUCKET).upload(path, buffer, {
    upsert: true,
    contentType: file.type
  });

  if (error) {
    throw error;
  }

  const publicUrl = supabase.storage.from(PARTNER_LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
  return `${publicUrl}?v=${Date.now()}`;
}
