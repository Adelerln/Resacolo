import { after } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { mockOrganizerTenant } from '@/lib/mocks';
import { runStayImportInBackground } from '@/lib/run-stay-import-background';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
/** Vercel : le travail lourd continue via `after()` après la redirection ; garder une marge pour Playwright + Thalie. */
export const maxDuration = 300;

function requestExpectsJson(req: Request): boolean {
  const contentType = req.headers.get('content-type') ?? '';
  const accept = req.headers.get('accept') ?? '';
  return contentType.includes('application/json') || accept.includes('application/json');
}

function redirectToOrganizerStayCreation(
  req: Request,
  organizerId: string | null,
  params?: Record<string, string>
) {
  const query = new URLSearchParams(params ?? {}).toString();
  const path = withOrganizerQuery(
    query ? `/organisme/sejours/new?${query}` : '/organisme/sejours/new',
    organizerId
  );
  return NextResponse.redirect(new URL(path, req.url), 303);
}

async function readImportInput(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';

  const parseBooleanInput = (value: unknown, fallback = true): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['1', 'true', 'on', 'yes', 'oui'].includes(normalized)) return true;
    if (['0', 'false', 'off', 'no', 'non'].includes(normalized)) return false;
    return fallback;
  };

  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as {
      sourceUrl?: unknown;
      source_url?: unknown;
      organizerId?: unknown;
      organizer_id?: unknown;
      selectedAccommodationId?: unknown;
      selected_accommodation_id?: unknown;
      includePricing?: unknown;
      include_pricing?: unknown;
    };
    return {
      sourceUrl:
        typeof body.sourceUrl === 'string'
          ? body.sourceUrl
          : typeof body.source_url === 'string'
            ? body.source_url
            : '',
      organizerId:
        typeof body.organizerId === 'string'
          ? body.organizerId
          : typeof body.organizer_id === 'string'
            ? body.organizer_id
            : '',
      selectedAccommodationId:
        typeof body.selectedAccommodationId === 'string'
          ? body.selectedAccommodationId
          : typeof body.selected_accommodation_id === 'string'
            ? body.selected_accommodation_id
            : '',
      includePricing:
        typeof body.includePricing !== 'undefined'
          ? parseBooleanInput(body.includePricing)
          : typeof body.include_pricing !== 'undefined'
            ? parseBooleanInput(body.include_pricing)
            : true
    };
  }

  const formData = await req.formData();
  return {
    sourceUrl: String(formData.get('sourceUrl') ?? formData.get('source_url') ?? ''),
    organizerId: String(formData.get('organizerId') ?? formData.get('organizer_id') ?? ''),
    selectedAccommodationId: String(
      formData.get('selectedAccommodationId') ?? formData.get('selected_accommodation_id') ?? ''
    ),
    includePricing:
      formData.has('includePricing') || formData.has('include_pricing')
        ? parseBooleanInput(formData.get('includePricing') ?? formData.get('include_pricing'))
        : false
  };
}

export async function POST(req: Request) {
  const isMockMode = process.env.MOCK_UI === '1' || process.env.DISABLE_AUTH === '1';
  const session = await getSession();

  if (!isMockMode && (!session || session.role !== 'ORGANISATEUR')) {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }

  const {
    sourceUrl: sourceUrlRaw,
    organizerId: organizerIdRaw,
    selectedAccommodationId: selectedAccommodationIdRaw,
    includePricing
  } = await readImportInput(req);
  const sourceUrl = sourceUrlRaw.trim();
  const requestedOrganizerId = organizerIdRaw.trim();
  const selectedAccommodationId = selectedAccommodationIdRaw.trim();
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    requestedOrganizerId || undefined,
    isMockMode ? mockOrganizerTenant.id : session?.tenantId ?? null
  );

  if (!selectedOrganizerId) {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: 'Aucun organisateur disponible.' }, { status: 400 });
    }
    return redirectToOrganizerStayCreation(req, null, {
      error: 'Aucun organisateur disponible.'
    });
  }

  if (!sourceUrl) {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: "L'URL de la fiche séjour est requise." }, { status: 400 });
    }
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: "L'URL de la fiche séjour est requise."
    });
  }

  try {
    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('invalid-protocol');
    }
  } catch {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: 'Veuillez saisir une URL valide.' }, { status: 400 });
    }
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: 'Veuillez saisir une URL valide.'
    });
  }

  const supabase = getServerSupabaseClient();
  let selectedAccommodation:
    | {
        id: string;
        name: string;
      }
    | null = null;

  if (selectedAccommodationId) {
    const { data: accommodation, error: accommodationError } = await supabase
      .from('accommodations')
      .select('id,name')
      .eq('id', selectedAccommodationId)
      .eq('organizer_id', selectedOrganizerId)
      .maybeSingle();

    if (accommodationError || !accommodation) {
      if (requestExpectsJson(req)) {
        return NextResponse.json(
          { error: 'Hébergement introuvable pour cet organisateur.' },
          { status: 400 }
        );
      }
      return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
        error: 'Hébergement introuvable pour cet organisateur.'
      });
    }

    selectedAccommodation = accommodation;
  }

  const { data: insertedDraft, error: insertError } = await supabase
    .from('stay_drafts')
    .insert({
      organizer_id: selectedOrganizerId,
      source_url: sourceUrl,
      status: 'pending',
      raw_payload: {
        import_options: {
          include_pricing: includePricing
        },
        import_progress: {
          step: 'created',
          label: 'Brouillon créé',
          percent: 5,
          completed: false,
          updated_at: new Date().toISOString()
        }
      }
    })
    .select('*')
    .single();

  if (insertError || !insertedDraft) {
    if (requestExpectsJson(req)) {
      return NextResponse.json(
        { error: insertError?.message ?? 'Impossible de créer le brouillon.' },
        { status: 500 }
      );
    }
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: insertError?.message ?? 'Impossible de créer le brouillon.'
    });
  }

  const draftColumns = new Set(Object.keys(insertedDraft));

  after(() => {
    void runStayImportInBackground({
      draftId: insertedDraft.id,
      sourceUrl,
      selectedOrganizerId,
      selectedAccommodation,
      includePricing,
      draftColumnKeys: Array.from(draftColumns)
    });
  });

  if (requestExpectsJson(req)) {
    return NextResponse.json({
      success: true,
      draftId: insertedDraft.id,
      organizerId: selectedOrganizerId
    });
  }

  return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
    prefill: 'created',
    draftId: insertedDraft.id
  });
}
