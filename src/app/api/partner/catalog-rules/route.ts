import { NextResponse } from 'next/server';
import { getPartnerAccessRoleFromSession, canAccessPartnerSection } from '@/lib/partner-access';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/auth/api';
import {
  getDefaultPartnerCatalogRules,
  normalizePartnerCatalogRules,
  parseAndValidatePartnerCatalogRules
} from '@/lib/partner-catalog-rules';

export const runtime = 'nodejs';

export async function GET() {
  const { unauthorized, session } = await requireApiAuth();
  if (unauthorized || !session) return unauthorized;
  if (
    session.role !== 'PARTENAIRE' ||
    !session.tenantId ||
    !canAccessPartnerSection(getPartnerAccessRoleFromSession(session), 'catalog')
  ) {
    return NextResponse.json({ errors: ['FORBIDDEN'] }, { status: 403 });
  }

  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivities')
    .select('catalog_rules_draft,catalog_rules_published,catalog_rules_published_at')
    .eq('id', session.tenantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ errors: [error.message] }, { status: 500 });
  }

  const draft = normalizePartnerCatalogRules(data?.catalog_rules_draft ?? getDefaultPartnerCatalogRules());
  const published = normalizePartnerCatalogRules(data?.catalog_rules_published ?? draft);
  return NextResponse.json({
    data: {
      draft,
      published,
      publishedAt: data?.catalog_rules_published_at ?? null
    },
    errors: [],
    warnings: []
  });
}

export async function PUT(req: Request) {
  const { unauthorized, session } = await requireApiAuth();
  if (unauthorized || !session) return unauthorized;
  if (
    session.role !== 'PARTENAIRE' ||
    !session.tenantId ||
    !canAccessPartnerSection(getPartnerAccessRoleFromSession(session), 'catalog')
  ) {
    return NextResponse.json({ errors: ['FORBIDDEN'] }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ['INVALID_JSON'], warnings: [] }, { status: 400 });
  }

  let rules;
  try {
    rules = parseAndValidatePartnerCatalogRules((body as { rules?: unknown })?.rules);
  } catch (error) {
    return NextResponse.json(
      { errors: [error instanceof Error ? error.message : 'RULES_INVALID'], warnings: [] },
      { status: 400 }
    );
  }

  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('collectivities')
    .update({
      catalog_rules_draft: rules,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.tenantId);

  if (error) {
    return NextResponse.json({ errors: [error.message], warnings: [] }, { status: 500 });
  }

  return NextResponse.json({ data: { draft: rules }, errors: [], warnings: [] });
}
