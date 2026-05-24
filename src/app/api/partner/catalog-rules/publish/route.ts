import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/auth/api';
import { parseAndValidatePartnerCatalogRules } from '@/lib/partner-catalog-rules';

export const runtime = 'nodejs';

export async function POST() {
  const { unauthorized, session } = await requireApiAuth();
  if (unauthorized || !session) return unauthorized;
  if (session.role !== 'PARTENAIRE' || !session.tenantId) {
    return NextResponse.json({ errors: ['FORBIDDEN'] }, { status: 403 });
  }

  const supabase = getServerSupabaseClient();
  const { data, error: readError } = await supabase
    .from('collectivities')
    .select('catalog_rules_draft')
    .eq('id', session.tenantId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ errors: [readError.message], warnings: [] }, { status: 500 });
  }

  let validated;
  try {
    validated = parseAndValidatePartnerCatalogRules(data?.catalog_rules_draft ?? {});
  } catch (error) {
    return NextResponse.json(
      { errors: [error instanceof Error ? error.message : 'DRAFT_INVALID'], warnings: [] },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('collectivities')
    .update({
      catalog_rules_published: validated,
      catalog_rules_published_at: now,
      updated_at: now
    })
    .eq('id', session.tenantId);

  if (error) {
    return NextResponse.json({ errors: [error.message], warnings: [] }, { status: 500 });
  }

  return NextResponse.json({
    data: { published: validated, publishedAt: now },
    errors: [],
    warnings: []
  });
}
