import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireApiAdmin } from '@/lib/auth/api';
import {
  humanizeAuthPasswordError,
  isPasswordPolicyValid,
  PASSWORD_POLICY_MESSAGE
} from '@/lib/auth/password-policy';
import {
  ensurePrismaUserForOrganizerAccess,
  removePrismaUserIfExists,
  syncBackofficeAccessFromOrganizerMember
} from '@/lib/organizer-backoffice-sync.server';
import { syncOrganizerBillingSettingsForOrganizer } from '@/lib/resacolo-billing-settings.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';

function wantsJson(req: Request) {
  return (req.headers.get('accept') ?? '').includes('application/json');
}

function fail(req: Request, message: string, status = 400) {
  const safeMessage = humanizeAuthPasswordError(message) || message;
  if (wantsJson(req)) {
    return NextResponse.json({ error: safeMessage }, { status });
  }
  return NextResponse.redirect(
    new URL(`/admin/organizers/new?error=${encodeURIComponent(safeMessage)}`, req.url),
    303
  );
}

function succeed(req: Request, redirectTo: string) {
  if (wantsJson(req)) {
    return NextResponse.json({ ok: true, redirectTo });
  }
  return NextResponse.redirect(new URL(redirectTo, req.url), 303);
}

export async function POST(req: Request) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const formData = await req.formData();
  const name = String(formData.get('name') ?? '').trim();
  const contactEmail = String(formData.get('contact_email') ?? '').trim();
  const heroIntroText = String(formData.get('hero_intro_text') ?? '').trim();
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
    return fail(req, 'Tous les champs sont requis');
  }
  if (!isPasswordPolicyValid(tempPassword)) {
    return fail(req, PASSWORD_POLICY_MESSAGE);
  }

  const supabase = getServerSupabaseClient();
  let createdPrismaUserId: string | null = null;
  const slug = slugify(name);

  const foundedYear = foundedYearRaw ? Number(foundedYearRaw) : null;
  const ageMin = ageMinRaw ? Number(ageMinRaw) : null;
  const ageMax = ageMaxRaw ? Number(ageMaxRaw) : null;

  const { data: organizer, error: organizerError } = await supabase
    .from('organizers')
    .insert({
      name,
      contact_email: contactEmail,
      hero_intro_text: heroIntroText || null,
      description: description || null,
      founded_year: foundedYear,
      age_min: ageMin,
      age_max: ageMax,
      slug,
      is_founding_member: false,
      is_resacolo_member: false
    })
    .select('id')
    .single();

  if (organizerError || !organizer) {
    return fail(req, organizerError?.message ?? "Impossible de créer l'organisateur");
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
      return fail(req, logoError.message ?? 'Impossible de téléverser le logo');
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
      return fail(req, projectError.message ?? 'Impossible de téléverser le projet éducatif');
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
    return fail(req, userError?.message ?? "Impossible de créer l'utilisateur");
  }
  try {
    const prismaUser = await ensurePrismaUserForOrganizerAccess({
      email: userEmail,
      tempPassword,
      displayName: `${firstName} ${lastName}`.trim()
    });
    if (prismaUser.created) {
      createdPrismaUserId = prismaUser.id;
    }
  } catch (prismaError) {
    await supabase.auth.admin.deleteUser(userData.user.id);
    await supabase.from('organizers').delete().eq('id', organizer.id);
    return fail(
      req,
      prismaError instanceof Error ? prismaError.message : 'Impossible de créer le compte applicatif'
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
    await removePrismaUserIfExists(createdPrismaUserId);
    return fail(req, memberError.message ?? "Impossible de lier l'utilisateur");
  }
  try {
    await syncBackofficeAccessFromOrganizerMember({
      organizerId: organizer.id,
      supabaseUserId: userData.user.id,
      role: 'OWNER',
      emailHint: userEmail
    });
  } catch (syncError) {
    await supabase
      .from('organizer_members')
      .delete()
      .eq('organizer_id', organizer.id)
      .eq('user_id', userData.user.id);
    await supabase.auth.admin.deleteUser(userData.user.id);
    await supabase.from('organizers').delete().eq('id', organizer.id);
    await removePrismaUserIfExists(createdPrismaUserId);
    return fail(
      req,
      syncError instanceof Error ? syncError.message : 'Impossible de synchroniser les accès back-office'
    );
  }

  try {
    await syncOrganizerBillingSettingsForOrganizer(
      supabase,
      {
        id: organizer.id,
        is_founding_member: false,
        is_resacolo_member: false
      },
      {
        source: 'ORG_CREATE'
      }
    );
  } catch (syncError) {
    await supabase
      .from('organizer_members')
      .delete()
      .eq('organizer_id', organizer.id)
      .eq('user_id', userData.user.id);
    await supabase.auth.admin.deleteUser(userData.user.id);
    await supabase.from('organizers').delete().eq('id', organizer.id);
    await removePrismaUserIfExists(createdPrismaUserId);
    return fail(
      req,
      syncError instanceof Error
        ? syncError.message
        : 'Impossible de synchroniser la commission organisateur.'
    );
  }

  revalidatePath('/organisateurs');
  revalidatePath(`/organisateurs/${slug}`);

  return succeed(req, `/admin/organizers/${slug}?success=1`);
}
