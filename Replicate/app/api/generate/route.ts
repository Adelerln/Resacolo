import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';
import { Buffer } from 'node:buffer';

const inputBucket = process.env.SUPABASE_INPUT_BUCKET;
const outputBucket = process.env.SUPABASE_OUTPUT_BUCKET;
const replicateToken = process.env.REPLICATE_API_TOKEN;
const replicateModel = process.env.REPLICATE_MODEL;

if (!inputBucket || !outputBucket) {
  throw new Error('Les buckets Supabase (SUPABASE_INPUT_BUCKET, SUPABASE_OUTPUT_BUCKET) doivent être définis.');
}

if (!replicateToken || !replicateModel) {
  throw new Error('Les variables d’environnement REPLICATE_API_TOKEN et REPLICATE_MODEL sont requises.');
}

const [modelId, modelVersion] = replicateModel.split(':');
if (!modelId || !modelVersion) {
  throw new Error(
    'REPLICATE_MODEL doit respecter le format "owner/model:version". Exemple: google/nano-banana:xxxxxxxxxxxxxxxx".'
  );
}

export async function POST(request: NextRequest) {
  try {
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

    const prediction = await createPrediction({
      modelId,
      modelVersion,
      input: {
        image: inputPublicUrl,
        prompt
      }
    });

    const finalPrediction = await waitForPrediction(prediction.id);
    if (finalPrediction.status !== 'succeeded') {
      throw new Error(finalPrediction.error ?? 'La génération Replicate a échoué.');
    }

    const generatedUrl = extractImageUrl(finalPrediction.output);
    if (!generatedUrl) {
      throw new Error('Impossible de récupérer le lien de l’image générée par Replicate.');
    }

    const generatedImageResponse = await fetch(generatedUrl);
    if (!generatedImageResponse.ok) {
      throw new Error(`Téléchargement de l’image générée échoué : ${generatedImageResponse.statusText}`);
    }

    const generatedBuffer = Buffer.from(await generatedImageResponse.arrayBuffer());
    const outputPath = `results/${randomUUID()}.png`;

    const { error: uploadOutputError } = await supabaseAdmin.storage
      .from(outputBucket)
      .upload(outputPath, generatedBuffer, {
        contentType: generatedImageResponse.headers.get('content-type') ?? 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadOutputError) {
      throw new Error(`Erreur lors de l’upload du résultat : ${uploadOutputError.message}`);
    }

    const {
      data: { publicUrl: outputPublicUrl }
    } = supabaseAdmin.storage.from(outputBucket).getPublicUrl(outputPath);

    await supabaseAdmin.from('projects').insert({
      input_image_url: inputPublicUrl,
      output_image_url: outputPublicUrl,
      prompt,
      status: 'completed'
    });

    return NextResponse.json({ imageUrl: outputPublicUrl });
  } catch (error) {
    console.error('[generate] error', error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Une erreur interne est survenue pendant la génération.'
      },
      { status: 500 }
    );
  }
}

type ReplicateResult =
  | string
  | string[]
  | { [key: string]: unknown }
  | Array<{ [key: string]: unknown }>
  | null
  | undefined;

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: ReplicateResult;
  error?: string | null;
}

async function createPrediction({
  modelId,
  modelVersion,
  input
}: {
  modelId: string;
  modelVersion: string;
  input: Record<string, unknown>;
}): Promise<ReplicatePrediction> {
  const response = await fetch(
    `https://api.replicate.com/v1/models/${modelId}/versions/${modelVersion}/predictions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input
      })
    }
  );

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload?.detail ?? 'Impossible de créer la prédiction Replicate.');
  }

  return (await response.json()) as ReplicatePrediction;
}

async function waitForPrediction(id: string): Promise<ReplicatePrediction> {
  const poll = async (): Promise<ReplicatePrediction> => {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload?.detail ?? 'Échec de récupération de la prédiction Replicate.');
    }

    return (await response.json()) as ReplicatePrediction;
  };

  let prediction = await poll();
  const terminalStates = new Set(['succeeded', 'failed', 'canceled']);

  while (!terminalStates.has(prediction.status)) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    prediction = await poll();
  }

  return prediction;
}

function extractImageUrl(result: ReplicateResult): string | null {
  if (!result) {
    return null;
  }

  if (typeof result === 'string') {
    return result;
  }

  if (Array.isArray(result)) {
    for (const item of result) {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object') {
        const url = findUrlInObject(item);
        if (url) {
          return url;
        }
      }
    }
  }

  if (typeof result === 'object') {
    return findUrlInObject(result);
  }

  return null;
}

function findUrlInObject(value: { [key: string]: unknown }): string | null {
  for (const key of Object.keys(value)) {
    const entry = value[key];
    if (typeof entry === 'string' && entry.startsWith('http')) {
      return entry;
    }
    if (entry && typeof entry === 'object') {
      const nested = extractImageUrl(entry as ReplicateResult);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}
