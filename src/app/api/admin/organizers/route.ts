import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const formData = await req.formData();
  const name = String(formData.get('name') ?? '').trim();
  const contactEmail = String(formData.get('contact_email') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const foundedYearRaw = String(formData.get('founded_year') ?? '').trim();
  const ageMinRaw = String(formData.get('age_min') ?? '').trim();
  const ageMaxRaw = String(formData.get('age_max') ?? '').trim();
  const userEmail = String(formData.get('user_email') ?? '').trim();
  const tempPassword = String(formData.get('temp_password') ?? '').trim();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const logoFile = formData.get('logo');
  const projectFile = formData.get('education_project');

  if (!name || !contactEmail || !userEmail || !tempPassword || !firstName || !lastName) {
    return NextResponse.redirect(
      new URL('/admin/organisateurs/new?error=Tous%20les%20champs%20sont%20requis', req.url),
      303
    );
  }

  const supabase = getServerSupabaseClient();
  const slug = slugify(name);

  const foundedYear = foundedYearRaw ? Number(foundedYearRaw) : null;
  const ageMin = ageMinRaw ? Number(ageMinRaw) : null;
  const ageMax = ageMaxRaw ? Number(ageMaxRaw) : null;

  const { data: organizer, error: organizerError } = await supabase
    .from('organizers')
    .insert({
      name,
      contact_email: contactEmail,
      description: description || null,
      founded_year: foundedYear,
      age_min: ageMin,
      age_max: ageMax,
      slug
    })
    .select('id')
    .single();

  if (organizerError || !organizer) {
    return NextResponse.redirect(
      new URL(
        `/admin/organisateurs/new?error=${encodeURIComponent(
          organizerError?.message ?? "Impossible de créer l'organisateur"
        )}`,
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
      await supabase.from('organizers').delete().eq('id', organizer.id);
      return NextResponse.redirect(
        new URL(
          `/admin/organisateurs/new?error=${encodeURIComponent(
            logoError.message ?? 'Impossible de téléverser le logo'
          )}`,
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
      await supabase.from('organizers').delete().eq('id', organizer.id);
      return NextResponse.redirect(
        new URL(
          `/admin/organisateurs/new?error=${encodeURIComponent(
            projectError.message ?? 'Impossible de téléverser le projet éducatif'
          )}`,
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

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: userEmail,
    password: tempPassword,
    email_confirm: true
  });

  if (userError || !userData?.user) {
    await supabase.from('organizers').delete().eq('id', organizer.id);
    return NextResponse.redirect(
      new URL(
        `/admin/organisateurs/new?error=${encodeURIComponent(
          userError?.message ?? "Impossible de créer l'utilisateur"
        )}`,
        req.url
      ),
      303
    );
  }

  const { error: memberError } = await supabase.from('organizer_members').insert({
    organizer_id: organizer.id,
    user_id: userData.user.id,
    role: 'OWNER',
    first_name: firstName,
    last_name: lastName
  });

  if (memberError) {
    await supabase.auth.admin.deleteUser(userData.user.id);
    await supabase.from('organizers').delete().eq('id', organizer.id);
    return NextResponse.redirect(
      new URL(
        `/admin/organisateurs/new?error=${encodeURIComponent(
          memberError.message ?? "Impossible de lier l'utilisateur"
        )}`,
        req.url
      ),
      303
    );
  }

  return NextResponse.redirect(new URL(`/admin/organisateurs/${slug}?success=1`, req.url), 303);
}
