import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: { id: string } }) {
  const { id: idOrSlug } = context.params;
  const formData = await req.formData();
  const name = String(formData.get('name') ?? '').trim();
  const contactEmail = String(formData.get('contact_email') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const foundedYearRaw = String(formData.get('founded_year') ?? '').trim();
  const ageMinRaw = String(formData.get('age_min') ?? '').trim();
  const ageMaxRaw = String(formData.get('age_max') ?? '').trim();
  const logoFile = formData.get('logo');
  const projectFile = formData.get('education_project');

  const foundedYear = foundedYearRaw ? Number(foundedYearRaw) : null;
  const ageMin = ageMinRaw ? Number(ageMinRaw) : null;
  const ageMax = ageMaxRaw ? Number(ageMaxRaw) : null;
  const slug = name ? slugify(name) : null;
  const urlSlug = slug ?? String(idOrSlug);

  const supabase = getServerSupabaseClient();
  let { data: organizer } = await supabase
    .from('organizers')
    .select('id')
    .eq('slug', idOrSlug)
    .maybeSingle();

  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select('id')
      .eq('id', idOrSlug)
      .maybeSingle();
    organizer = byId ?? null;
  }

  if (!organizer) {
    return NextResponse.redirect(
      new URL(`/admin/organisateurs/${urlSlug}?error=Organisateur%20introuvable`, req.url),
      303
    );
  }

  const { error } = await supabase
    .from('organizers')
    .update({
      name,
      contact_email: contactEmail,
      description: description || null,
      founded_year: foundedYear,
      age_min: ageMin,
      age_max: ageMax,
      slug
    })
    .eq('id', organizer.id);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/organisateurs/${urlSlug}?error=${encodeURIComponent(error.message)}`,
        req.url
      ),
      303
    );
  }

  if (logoFile instanceof File && logoFile.size > 0) {
    const extension = logoFile.name.split('.').pop()?.toLowerCase() || 'bin';
    const logoPath = `organizers/${organizer.id}/logo.${extension}`;
    const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
    const { error: logoError } = await supabase.storage
      .from('organizer-logo')
      .upload(logoPath, logoBuffer, { upsert: true, contentType: logoFile.type });
    if (logoError) {
      return NextResponse.redirect(
        new URL(
          `/admin/organisateurs/${urlSlug}?error=${encodeURIComponent(logoError.message)}`,
          req.url
        ),
        303
      );
    }
    await supabase.from('organizers').update({ logo_path: logoPath }).eq('id', organizer.id);
  }

  if (projectFile instanceof File && projectFile.size > 0) {
    const extension = projectFile.name.split('.').pop()?.toLowerCase() || 'pdf';
    const projectPath = `organizers/${organizer.id}/education-project.${extension}`;
    const projectBuffer = Buffer.from(await projectFile.arrayBuffer());
    const { error: projectError } = await supabase.storage
      .from('organizer-docs')
      .upload(projectPath, projectBuffer, { upsert: true, contentType: projectFile.type });
    if (projectError) {
      return NextResponse.redirect(
        new URL(
          `/admin/organisateurs/${urlSlug}?error=${encodeURIComponent(projectError.message)}`,
          req.url
        ),
        303
      );
    }
    await supabase
      .from('organizers')
      .update({ education_project_path: projectPath })
      .eq('id', organizer.id);
  }

  return NextResponse.redirect(new URL(`/admin/organisateurs/${urlSlug}?success=1`, req.url), 303);
}
