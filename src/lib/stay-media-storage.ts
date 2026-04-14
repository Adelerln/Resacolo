import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '@/lib/supabase/config';
import type { Database } from '@/types/supabase';

const STAY_MEDIA_BUCKET = 'medias_sejours';
const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const IMAGE_FETCH_MAX_BYTES = 12 * 1024 * 1024;

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp'
};

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function buildBucketPublicPrefix(): string {
  const { url } = getSupabaseEnv();
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${STAY_MEDIA_BUCKET}/`;
}

function normalizeImageExtension(extension: string | null | undefined): string | null {
  if (!extension) return null;
  const normalized = extension.toLowerCase().replace(/^\./, '');
  return normalized && /^[a-z0-9]+$/.test(normalized) ? normalized : null;
}

function extensionFromImageUrl(imageUrl: string): string | null {
  try {
    const pathname = new URL(imageUrl).pathname;
    const segment = pathname.split('/').pop() ?? '';
    const extension = segment.includes('.') ? segment.split('.').pop() : null;
    return normalizeImageExtension(extension);
  } catch {
    return null;
  }
}

function extensionFromContentType(contentType: string | null): string {
  if (contentType && CONTENT_TYPE_EXTENSIONS[contentType]) {
    return CONTENT_TYPE_EXTENSIONS[contentType];
  }
  return 'jpg';
}

async function readResponseBufferWithLimit(
  response: Response,
  maxBytes: number
): Promise<Buffer | null> {
  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) return null;
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

async function fetchRemoteImage(
  imageUrl: string
): Promise<{ buffer: Buffer; contentType: string | null; extension: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; ResacoloStayMediaBot/1.0; +https://resacolo.com)',
        accept: 'image/*,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentTypeHeader = response.headers.get('content-type');
    const contentType = contentTypeHeader ? contentTypeHeader.split(';')[0]?.toLowerCase() ?? null : null;
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('not-image');
    }

    const contentLengthRaw = response.headers.get('content-length');
    const contentLength = contentLengthRaw ? Number(contentLengthRaw) : null;
    if (contentLength && Number.isFinite(contentLength) && contentLength > IMAGE_FETCH_MAX_BYTES) {
      throw new Error('too-large');
    }

    const buffer = await readResponseBufferWithLimit(response, IMAGE_FETCH_MAX_BYTES);
    if (!buffer || buffer.length === 0) {
      throw new Error('empty-buffer');
    }

    const extension = extensionFromImageUrl(response.url || imageUrl) ?? extensionFromContentType(contentType);
    return { buffer, contentType, extension };
  } finally {
    clearTimeout(timeout);
  }
}

function buildStoragePath(args: {
  organizerId: string;
  stayId: string;
  index: number;
  imageUrl: string;
  extension: string;
}): string {
  const hash = createHash('sha1').update(args.imageUrl).digest('hex').slice(0, 12);
  const position = String(args.index + 1).padStart(2, '0');
  return `${sanitizePathSegment(args.organizerId)}/${sanitizePathSegment(args.stayId)}/${position}-${hash}.${args.extension}`;
}

export function extractStayMediaStoragePath(fileUrl: string): string | null {
  const publicPrefix = buildBucketPublicPrefix();
  if (!fileUrl.startsWith(publicPrefix)) return null;
  const rawPath = fileUrl.slice(publicPrefix.length).split('?')[0];
  return rawPath ? decodeURIComponent(rawPath) : null;
}

export async function removeStayMediaStorageFiles(
  supabase: SupabaseClient<Database>,
  fileUrls: string[]
): Promise<void> {
  const paths = Array.from(
    new Set(
      fileUrls
        .map((url) => extractStayMediaStoragePath(url))
        .filter((path): path is string => Boolean(path))
    )
  );

  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(STAY_MEDIA_BUCKET).remove(paths);
  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadImportedStayImages(
  supabase: SupabaseClient<Database>,
  args: {
    organizerId: string;
    stayId: string;
    imageUrls: string[];
  }
): Promise<string[]> {
  const uniqueUrls = Array.from(
    new Set(args.imageUrls.map((url) => url.trim()).filter((url) => /^https?:\/\//i.test(url)))
  );

  const uploadedUrls: string[] = [];

  for (let index = 0; index < uniqueUrls.length; index += 1) {
    const imageUrl = uniqueUrls[index];
    const existingPath = extractStayMediaStoragePath(imageUrl);
    if (existingPath) {
      uploadedUrls.push(imageUrl);
      continue;
    }

    try {
      const image = await fetchRemoteImage(imageUrl);
      const path = buildStoragePath({
        organizerId: args.organizerId,
        stayId: args.stayId,
        index,
        imageUrl,
        extension: image.extension
      });

      const { error: uploadError } = await supabase.storage.from(STAY_MEDIA_BUCKET).upload(path, image.buffer, {
        upsert: true,
        contentType: image.contentType ?? undefined
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = supabase.storage.from(STAY_MEDIA_BUCKET).getPublicUrl(path);
      uploadedUrls.push(data.publicUrl || imageUrl);
    } catch (error) {
      console.warn('[stay-media-storage] upload failed, external URL kept', {
        bucket: STAY_MEDIA_BUCKET,
        imageUrl,
        error: error instanceof Error ? error.message : 'unknown-error'
      });
      uploadedUrls.push(imageUrl);
    }
  }

  return uploadedUrls;
}
