import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import SavedToast from '@/components/common/SavedToast';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import {
  createPartnerSubEntity,
  deletePartnerSubEntity,
  isPartnerSubEntitiesEnabled,
  listPartnerSubEntities,
  renamePartnerSubEntity
} from '@/lib/partner-sub-entities.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sanitizeQueryValue(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || null;
}

export default async function PartnerSubEntitiesPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);
  const params = searchParams ? await searchParams : undefined;
  const errorMessage = sanitizeQueryValue(params?.error);
  const saved = sanitizeQueryValue(params?.saved) === '1';

  if (!canAccessPartnerSection(accessRole, 'sub-entities')) {
    redirect('/partenaire');
  }
  if (!collectivityId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Sous-entités</h1>
        <p className="admin-page-subtitle mt-1">Aucune collectivité liée à ce compte.</p>
      </div>
    );
  }
  if (session.collectivitySubEntityId) {
    redirect('/partenaire');
  }

  const enabled = await isPartnerSubEntitiesEnabled(collectivityId);
  if (!enabled) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Sous-entités</h1>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cette option n&apos;est pas activée pour votre CSE. Contactez Resacolo pour l&apos;autoriser.
        </p>
      </div>
    );
  }

  async function createSubEntityAction(formData: FormData) {
    'use server';
    const nextSession = await requirePartner();
    const nextCollectivityId = nextSession.tenantId;
    if (!nextCollectivityId || nextSession.collectivitySubEntityId) {
      redirect('/partenaire/sous-entites');
    }
    try {
      await createPartnerSubEntity({
        collectivityId: nextCollectivityId,
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
        firstName: String(formData.get('first_name') ?? ''),
        lastName: String(formData.get('last_name') ?? '')
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de créer la sous-entité.';
      redirect(`/partenaire/sous-entites?error=${encodeURIComponent(message)}`);
    }
    revalidatePath('/partenaire/sous-entites');
    revalidatePath('/partenaire');
    redirect('/partenaire/sous-entites?saved=1');
  }

  async function renameSubEntityAction(formData: FormData) {
    'use server';
    const nextSession = await requirePartner();
    const nextCollectivityId = nextSession.tenantId;
    if (!nextCollectivityId || nextSession.collectivitySubEntityId) {
      redirect('/partenaire/sous-entites');
    }
    try {
      await renamePartnerSubEntity({
        collectivityId: nextCollectivityId,
        subEntityId: String(formData.get('sub_entity_id') ?? ''),
        name: String(formData.get('name') ?? '')
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de renommer la sous-entité.';
      redirect(`/partenaire/sous-entites?error=${encodeURIComponent(message)}`);
    }
    revalidatePath('/partenaire/sous-entites');
    redirect('/partenaire/sous-entites?saved=1');
  }

  async function deleteSubEntityAction(formData: FormData) {
    'use server';
    const nextSession = await requirePartner();
    const nextCollectivityId = nextSession.tenantId;
    if (!nextCollectivityId || nextSession.collectivitySubEntityId) {
      redirect('/partenaire/sous-entites');
    }
    try {
      await deletePartnerSubEntity({
        collectivityId: nextCollectivityId,
        subEntityId: String(formData.get('sub_entity_id') ?? '')
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de supprimer la sous-entité.';
      redirect(`/partenaire/sous-entites?error=${encodeURIComponent(message)}`);
    }
    revalidatePath('/partenaire/sous-entites');
    revalidatePath('/partenaire');
    redirect('/partenaire/sous-entites?saved=1');
  }

  const subEntities = await listPartnerSubEntities(collectivityId);

  return (
    <div className="space-y-6">
      {errorMessage ? <ErrorToast message={errorMessage} /> : null}
      {saved ? <SavedToast message="Sous-entités mises à jour." /> : null}

      <div>
        <h1 className="admin-page-title">Sous-entités</h1>
        <p className="admin-page-subtitle mt-1">
          Créez des entités internes (sites, services…) avec un compte email / mot de passe indépendant.
          Chaque sous-entité ne voit que ses ayants-droit.
        </p>
      </div>

      <form
        action={createSubEntityAction}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <h2 className="admin-section-title">Nouvelle sous-entité</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Nom de la sous-entité
            <input
              name="name"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Ex. Site Paris Nord"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email de connexion
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Prénom du compte
            <input
              name="first_name"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Nom du compte
            <input
              name="last_name"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            Mot de passe
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Créer la sous-entité
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Sous-entités ({subEntities.length})
          </h2>
        </div>
        {subEntities.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Aucune sous-entité pour le moment.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {subEntities.map((entity) => (
              <li key={entity.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center">
                <form action={renameSubEntityAction} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                  <input type="hidden" name="sub_entity_id" value={entity.id} />
                  <label className="block min-w-[220px] flex-1 text-sm font-medium text-slate-700">
                    Nom
                    <input
                      name="name"
                      required
                      defaultValue={entity.name}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Renommer
                  </button>
                </form>
                <form action={deleteSubEntityAction}>
                  <input type="hidden" name="sub_entity_id" value={entity.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Supprimer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
