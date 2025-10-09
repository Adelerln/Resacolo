import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`La variable d’environnement ${name} est manquante.`);
  }
  return value;
}

const inputBucket = requireEnv('SUPABASE_INPUT_BUCKET');
const outputBucket = requireEnv('SUPABASE_OUTPUT_BUCKET');

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

    const payload = (await request.json().catch(() => ({}))) as { id?: string };
    if (!payload.id) {
      return NextResponse.json({ message: 'Identifiant de projet manquant.' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', payload.id)
      .maybeSingle();

    if (projectError) {
      throw projectError;
    }

    if (!project) {
      return NextResponse.json({ message: 'Projet introuvable.' }, { status: 404 });
    }

    const admin = createSupabaseAdminClient();

    const deletions: Array<{ bucket: string; key: string }> = [];

    if (project.input_image_url) {
      const key = extractStoragePath(project.input_image_url, inputBucket);
      if (key) {
        deletions.push({ bucket: inputBucket, key });
      }
    }

    if (project.output_image_url) {
      const key = extractStoragePath(project.output_image_url, outputBucket);
      if (key) {
        deletions.push({ bucket: outputBucket, key });
      }
    }

    for (const { bucket, key } of deletions) {
      const { error } = await admin.storage.from(bucket).remove([key]);
      if (error && error.message !== 'Object not found') {
        throw new Error(`Suppression du fichier ${key} échouée : ${error.message}`);
      }
    }

    const { error: deleteError } = await supabase.from('projects').delete().eq('id', project.id);
    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[delete] error', error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Une erreur interne est survenue pendant la suppression.'
      },
      { status: 500 }
    );
  }
}

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const url = new URL(publicUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (!match) {
      return null;
    }
    const [, currentBucket, path] = match;
    if (currentBucket !== bucket) {
      return null;
    }
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}
