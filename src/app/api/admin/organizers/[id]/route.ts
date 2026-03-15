import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: { id: string } }) {
  const { id } = context.params;
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

  const supabase = getServerSupabaseClient();
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
    .eq('id', id);

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/organizers/${id}?error=${encodeURIComponent(error.message)}`, req.url),
      303
    );
  }

  if (logoFile instanceof File && logoFile.size > 0) {
    const extension = logoFile.name.split('.').pop()?.toLowerCase() || 'bin';
    const logoPath = `organizers/${id}/logo.${extension}`;
    const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
    const { error: logoError } = await supabase.storage
      .from('organizer-logo')
      .upload(logoPath, logoBuffer, { upsert: true, contentType: logoFile.type });
    if (logoError) {
      return NextResponse.redirect(
        new URL(`/admin/organizers/${id}?error=${encodeURIComponent(logoError.message)}`, req.url),
        303
      );
    }
    await supabase.from('organizers').update({ logo_path: logoPath }).eq('id', id);
  }

  if (projectFile instanceof File && projectFile.size > 0) {
    const extension = projectFile.name.split('.').pop()?.toLowerCase() || 'pdf';
    const projectPath = `organizers/${id}/education-project.${extension}`;
    const projectBuffer = Buffer.from(await projectFile.arrayBuffer());
    const { error: projectError } = await supabase.storage
      .from('organizer-docs')
      .upload(projectPath, projectBuffer, { upsert: true, contentType: projectFile.type });
    if (projectError) {
      return NextResponse.redirect(
        new URL(`/admin/organizers/${id}?error=${encodeURIComponent(projectError.message)}`, req.url),
        303
      );
    }
    await supabase
      .from('organizers')
      .update({ education_project_path: projectPath })
      .eq('id', id);
  }

  return NextResponse.redirect(new URL(`/admin/organizers/${id}`, req.url), 303);
}
