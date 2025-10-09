import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';
import { Buffer } from 'node:buffer';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Replicate from 'replicate';

export const runtime = 'nodejs';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`La variable d’environnement ${name} est manquante.`);
  }
  return value;
}

const inputBucket = requireEnv('SUPABASE_INPUT_BUCKET');
const outputBucket = requireEnv('SUPABASE_OUTPUT_BUCKET');
const replicateToken = requireEnv('REPLICATE_API_TOKEN');
const replicateModel = (process.env.REPLICATE_MODEL ?? 'google/nano-banana') as
  | `${string}/${string}`
  | `${string}/${string}:${string}`;

const replicateClient = new Replicate({ auth: replicateToken });

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return NextResponse.json({ message: 'Authentification requise.' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const formData = await request.formData();

    const image = formData.get('image');
    const prompt = formData.get('prompt');

    if (!(image instanceof File)) {
      return NextResponse.json({ message: 'Aucune image reçue.' }, { status: 400 });
    }

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ message: 'Le prompt est requis.' }, { status: 400 });
    }

    const inputPath = `uploads/${randomUUID()}-${image.name}`;
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    const { error: uploadInputError } = await supabaseAdmin.storage
      .from(inputBucket)
      .upload(inputPath, imageBuffer, {
        contentType: image.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadInputError) {
      throw new Error(`Erreur lors de l’upload de l’image source : ${uploadInputError.message}`);
    }

    const {
      data: { publicUrl: inputPublicUrl }
    } = supabaseAdmin.storage.from(inputBucket).getPublicUrl(inputPath);

    const replicateOutput = await replicateClient.run(replicateModel, {
      input: {
        prompt,
        image_input: [inputPublicUrl]
      }
    });

    const { buffer: generatedBuffer, contentType } = await normaliseReplicateOutput(replicateOutput);
    const outputPath = `results/${randomUUID()}.png`;

    const { error: uploadOutputError } = await supabaseAdmin.storage
      .from(outputBucket)
      .upload(outputPath, generatedBuffer, {
        contentType: contentType ?? 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadOutputError) {
      throw new Error(`Erreur lors de l’upload du résultat : ${uploadOutputError.message}`);
    }

    const {
      data: { publicUrl: outputPublicUrl }
    } = supabaseAdmin.storage.from(outputBucket).getPublicUrl(outputPath);

    const { error: insertError } = await supabaseAdmin.from('projects').insert({
      input_image_url: inputPublicUrl,
      output_image_url: outputPublicUrl,
      prompt,
      status: 'completed',
      user_id: user.id
    });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ imageUrl: outputPublicUrl });
  } catch (error) {
    console.error('[generate] error', error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'Une erreur interne est survenue pendant la génération.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

async function normaliseReplicateOutput(
  output: unknown
): Promise<{ buffer: Buffer; contentType?: string | null }> {
  if (!output) {
    throw new Error('Réponse vide reçue de Replicate.');
  }

  // Handle modern output object with helper methods.
  if (typeof output === 'object') {
    if (typeof (output as { url?: () => unknown }).url === 'function') {
      const result = (output as { url: () => unknown }).url();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        const resolvedUrl = (await result) as unknown;
        return downloadToBuffer(String(resolvedUrl));
      }
      return downloadToBuffer(String(result));
    }

    if (typeof Blob !== 'undefined' && output instanceof Blob) {
      const arrayBuffer = await output.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType: output.type ?? 'image/png'
      };
    }

    if (Array.isArray(output)) {
      for (const entry of output) {
        try {
          return await normaliseReplicateOutput(entry);
        } catch {
          // continue until we find a valid entry
        }
      }
    }
  }

  if (typeof output === 'string') {
    return downloadToBuffer(output);
  }

  if (output instanceof ArrayBuffer) {
    return { buffer: Buffer.from(output) };
  }

  if (ArrayBuffer.isView(output)) {
    return { buffer: Buffer.from(output.buffer) };
  }

  throw new Error('Format de sortie Replicate non pris en charge.');
}

async function downloadToBuffer(url: string): Promise<{ buffer: Buffer; contentType?: string | null }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Téléchargement de la sortie Replicate échoué : ${response.statusText}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type')
  };
}
