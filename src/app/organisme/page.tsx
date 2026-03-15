import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';

export default async function OrganizerHome() {
  const session = requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();

  let organizerId = session.tenantId ?? null;
  if (!organizerId) {
    const { data: membership } = await supabase
      .from('organizer_members')
      .select('organizer_id')
      .eq('user_id', session.userId)
      .maybeSingle();
    organizerId = membership?.organizer_id ?? null;
  }

  if (!organizerId) {
    redirect('/organisme/stays');
  }

  const { data: organizer } = await supabase
    .from('organizers')
    .select(
      'id,name,contact_email,description,founded_year,age_min,age_max,logo_path,education_project_path,slug'
    )
    .eq('id', organizerId)
    .maybeSingle();

  if (!organizer) {
    redirect('/organisme/stays');
  }

  const logoUrl = organizer.logo_path
    ? supabase.storage.from('organizer-logo').getPublicUrl(organizer.logo_path).data.publicUrl
    : null;
  const projectUrl = organizer.education_project_path
    ? supabase.storage.from('organizer-docs').getPublicUrl(organizer.education_project_path).data.publicUrl
    : null;

  async function updateProfile(formData: FormData) {
    'use server';
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
    const slug = name ? slugify(name) : organizer.slug;

    await supabase
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

    if (logoFile instanceof File && logoFile.size > 0) {
      const extension = logoFile.name.split('.').pop()?.toLowerCase() || 'bin';
      const logoPath = `organizers/${organizer.id}/logo.${extension}`;
      const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
      await supabase.storage
        .from('organizer-logo')
        .upload(logoPath, logoBuffer, { upsert: true, contentType: logoFile.type });
      await supabase.from('organizers').update({ logo_path: logoPath }).eq('id', organizer.id);
    }

    if (projectFile instanceof File && projectFile.size > 0) {
      const extension = projectFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      const projectPath = `organizers/${organizer.id}/education-project.${extension}`;
      const projectBuffer = Buffer.from(await projectFile.arrayBuffer());
      await supabase.storage
        .from('organizer-docs')
        .upload(projectPath, projectBuffer, { upsert: true, contentType: projectFile.type });
      await supabase
        .from('organizers')
        .update({ education_project_path: projectPath })
        .eq('id', organizer.id);
    }

    redirect('/organisme');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Bonjour {organizer.name}</h1>
        <p className="text-sm text-slate-600">Gère ton organisme et tes séjours.</p>
      </div>

      <form action={updateProfile} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Fiche organisme</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Nom
            <input
              name="name"
              defaultValue={organizer.name}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email de contact
            <input
              name="contact_email"
              type="email"
              defaultValue={organizer.contact_email ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Année de création
            <input
              name="founded_year"
              type="number"
              min="1900"
              max="2100"
              defaultValue={organizer.founded_year ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Âge min
            <input
              name="age_min"
              type="number"
              min="0"
              defaultValue={organizer.age_min ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Âge max
            <input
              name="age_max"
              type="number"
              min="0"
              defaultValue={organizer.age_max ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Texte de présentation
          <textarea
            name="description"
            rows={4}
            defaultValue={organizer.description ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Logo (PNG/JPG)
            <input
              name="logo"
              type="file"
              accept="image/*"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {logoUrl && <img src={logoUrl} alt={organizer.name} className="mt-2 h-16 w-auto rounded-lg border" />}
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Projet éducatif (PDF)
            <input
              name="education_project"
              type="file"
              accept="application/pdf"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {projectUrl && (
              <a className="mt-2 inline-flex text-sm font-medium text-brand-600" href={projectUrl}>
                Télécharger le PDF actuel
              </a>
            )}
          </label>
        </div>
        <div className="flex justify-end">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
