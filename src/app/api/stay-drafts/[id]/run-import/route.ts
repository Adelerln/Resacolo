import { NextResponse } from 'next/server';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { triggerStayImportWorker } from '@/lib/stay-import-jobs';
import { runStayImportForDraftRow } from '@/lib/stay-import-run';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: draftId } = await context.params;
  const searchParams = new URL(req.url).searchParams;
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: searchParams.get('organizerId') ?? undefined,
    requiredSection: 'stays'
  });

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const supabase = getServerSupabaseClient();
  const { data: draft, error } = await supabase
    .from('stay_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('organizer_id', access.context.selectedOrganizerId)
    .maybeSingle();

  if (error || !draft) {
    return NextResponse.json(
      { error: error?.message ?? 'Brouillon introuvable.' },
      { status: 404 }
    );
  }

  try {
    const outcome = await runStayImportForDraftRow(draft, access.context.selectedOrganizerId);

    if (outcome === 'missing_source_url') {
      return NextResponse.json(
        { error: 'URL source manquante sur le brouillon.' },
        { status: 400 }
      );
    }

    if (outcome === 'already_running') {
      return NextResponse.json({ success: true, status: 'already_running' });
    }

    if (outcome === 'already_completed') {
      return NextResponse.json({ success: true, status: 'already_completed' });
    }

    void triggerStayImportWorker(req.url);
    return NextResponse.json({ success: true, status: 'started' });
  } catch (error) {
    console.error('[stay-drafts/run-import] unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur lors du lancement de l’import.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
