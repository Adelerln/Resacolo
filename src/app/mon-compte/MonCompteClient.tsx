'use client';

import { useMemo, useState } from 'react';
import {
  Heart,
  Mail,
  MapPin,
  CalendarDays,
  UserRound,
  ShieldCheck,
  Settings,
  X
} from 'lucide-react';
import Link from 'next/link';
import { patchFamilyProfileParent2 } from '@/lib/account-profile/client';
import { formatFrenchPhone, parentStatusLabel } from '@/lib/account-preferences';
import type { FamilyProfile, FamilyUpcomingReservation, ParentStatus } from '@/types/family-profile';

type MonCompteClientProps = {
  initialProfile: FamilyProfile;
  upcomingReservations: FamilyUpcomingReservation[];
};

const mockFavorites = [
  {
    id: 'fav-1',
    title: 'Séjour surf & océan',
    age: '14-17 ans',
    location: 'Landes, France'
  },
  {
    id: 'fav-2',
    title: 'Stage théâtre & cirque',
    age: '8-12 ans',
    location: 'Provence, France'
  }
];

type Parent2Draft = {
  parent2Name: string;
  parent2Status: ParentStatus;
  parent2StatusOther: string;
  parent2Phone: string;
  parent2Email: string;
  parent2HasDifferentAddress: boolean;
  parent2AddressLine1: string;
  parent2AddressLine2: string;
  parent2PostalCode: string;
  parent2City: string;
};

function formatAddress(line1: string, line2: string, postalCode: string, city: string) {
  return [line1, line2, `${postalCode} ${city}`.trim()].filter(Boolean).join(', ');
}

function buildParent2Draft(profile: FamilyProfile): Parent2Draft {
  return {
    parent2Name: profile.parent2Name,
    parent2Status: profile.parent2Status,
    parent2StatusOther: profile.parent2StatusOther,
    parent2Phone: profile.parent2Phone,
    parent2Email: profile.parent2Email,
    parent2HasDifferentAddress: profile.parent2HasDifferentAddress,
    parent2AddressLine1: profile.parent2AddressLine1,
    parent2AddressLine2: profile.parent2AddressLine2,
    parent2PostalCode: profile.parent2PostalCode,
    parent2City: profile.parent2City
  };
}

function buildProfileDisplayName(profile: FamilyProfile) {
  const fullName = [profile.billingFirstName, profile.billingLastName].filter(Boolean).join(' ').trim();
  return fullName || 'Famille';
}

function mapProfileToParent1Name(profile: FamilyProfile) {
  const fullName = [profile.billingFirstName, profile.billingLastName].filter(Boolean).join(' ').trim();
  return fullName || 'Non renseigné';
}

export default function MonCompteClient({ initialProfile, upcomingReservations }: MonCompteClientProps) {
  const [profile, setProfile] = useState<FamilyProfile>(initialProfile);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Parent2Draft>(() => buildParent2Draft(initialProfile));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const parent1Name = useMemo(() => mapProfileToParent1Name(profile), [profile]);
  const fullAddress = useMemo(
    () =>
      formatAddress(profile.addressLine1, profile.addressLine2, profile.postalCode, profile.city) ||
      'Non renseignée',
    [profile]
  );
  const parent2Address = useMemo(() => {
    if (!profile.parent2HasDifferentAddress) return 'Identique à l’adresse du domicile';
    return (
      formatAddress(
        profile.parent2AddressLine1,
        profile.parent2AddressLine2,
        profile.parent2PostalCode,
        profile.parent2City
      ) || 'Non renseignée'
    );
  }, [profile]);

  function openEditModal() {
    setSaveError(null);
    setDraft(buildParent2Draft(profile));
    setIsModalOpen(true);
  }

  function closeEditModal() {
    setIsModalOpen(false);
  }

  function updateField<K extends keyof Parent2Draft>(key: K, value: Parent2Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleParent2DifferentAddressChange(checked: boolean) {
    setDraft((prev) => {
      if (checked) {
        return { ...prev, parent2HasDifferentAddress: true };
      }

      return {
        ...prev,
        parent2HasDifferentAddress: false,
        parent2AddressLine1: '',
        parent2AddressLine2: '',
        parent2PostalCode: '',
        parent2City: ''
      };
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    try {
      const response = await patchFamilyProfileParent2({
        parent2Name: draft.parent2Name,
        parent2Status: draft.parent2Status,
        parent2StatusOther: draft.parent2StatusOther,
        parent2Phone: draft.parent2Phone,
        parent2Email: draft.parent2Email,
        parent2HasDifferentAddress: draft.parent2HasDifferentAddress,
        parent2AddressLine1: draft.parent2AddressLine1,
        parent2AddressLine2: draft.parent2AddressLine2,
        parent2PostalCode: draft.parent2PostalCode,
        parent2City: draft.parent2City
      });
      setProfile(response.profile);
      setDraft(buildParent2Draft(response.profile));
      setIsModalOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Impossible de sauvegarder les informations.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="section-container py-10 sm:py-14">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-md sm:h-16 sm:w-16">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mon compte</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                Bonjour {buildProfileDisplayName(profile)}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Mail className="h-4 w-4" />
                {profile.email || 'Email non renseigné'}
                <span className="mx-1 hidden text-slate-300 sm:inline">|</span>
                <MapPin className="h-4 w-4" />
                {profile.city || 'Ville non renseignée'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact/preferences" className="btn btn-secondary btn-sm">
              <Settings className="h-4 w-4" />
              Préférences
            </Link>
            <form action="/api/auth/logout" method="post">
              <input type="hidden" name="redirectTo" value="/login/familles" />
              <button type="submit" className="btn btn-primary btn-sm">
                Se déconnecter
              </button>
            </form>
          </div>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          <div className="space-y-8">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">Prochaine réservation</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Retrouvez ici les séjours déjà réservés pour vos enfants.
                  </p>
                </div>
                <CalendarDays className="h-8 w-8 text-accent-500" />
              </div>

              {upcomingReservations.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Vous n&apos;avez pas encore de réservation. Parcourez les séjours et ajoutez-les à votre panier.
                </p>
              ) : (
                <ul className="mt-6 space-y-4">
                  {upcomingReservations.map((stay) => (
                    <li
                      key={stay.orderId}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-700"
                    >
                      <p className="font-display text-base font-semibold text-slate-900">{stay.title}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <CalendarDays className="h-4 w-4" />
                        {stay.dates}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{stay.child}</p>
                      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {stay.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex justify-end">
                <Link href="/sejours" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  Voir tous les séjours
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">Enfants renseignés</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Informations récupérées depuis le checkout.
                  </p>
                </div>
                <UserRound className="h-7 w-7 text-accent-500" />
              </div>

              {profile.children.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">Aucun enfant renseigné pour le moment.</p>
              ) : (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                  {profile.children.map((child, index) => (
                    <li
                      key={`${child.firstName}-${child.lastName}-${index}`}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-700"
                    >
                      <p className="font-display text-base font-semibold text-slate-900">
                        {[child.firstName, child.lastName.toUpperCase()].filter(Boolean).join(' ') || 'Participant'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Date de naissance: {child.birthdate || 'Non renseignée'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Genre: {child.gender || 'Non renseigné'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">Séjours favoris</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Les séjours que vous avez ajoutés en favoris depuis la page catalogue.
                  </p>
                </div>
                <Heart className="h-7 w-7 text-accent-500" />
              </div>

              {mockFavorites.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Vous n&apos;avez pas encore de favoris. Cliquez sur le cœur depuis une fiche séjour pour l&apos;ajouter.
                </p>
              ) : (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                  {mockFavorites.map((fav) => (
                    <li
                      key={fav.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-700"
                    >
                      <p className="font-display text-base font-semibold text-slate-900">{fav.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{fav.age}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5" />
                        {fav.location}
                      </p>
                      <Link
                        href="/sejours"
                        className="mt-3 inline-flex text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Voir le séjour
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-slate-900">Informations du compte</h2>
              <div className="mt-4 space-y-4">
                <article className="rounded-xl border border-blue-100 bg-blue-100/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Parent 1</h3>
                  <dl className="mt-3 space-y-2 text-sm text-slate-700 break-words">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Nom</dt>
                      <dd className="font-medium text-slate-900">{parent1Name}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Statut</dt>
                      <dd className="font-medium text-slate-900">Responsable légal</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Portable</dt>
                      <dd className="font-medium text-slate-900">{formatFrenchPhone(profile.phone)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Email</dt>
                      <dd className="font-medium text-slate-900">{profile.email || 'Non renseigné'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Adresse</dt>
                      <dd className="max-w-[65%] text-right font-medium text-slate-900">{fullAddress}</dd>
                    </div>
                  </dl>
                </article>

                <article className="rounded-xl border border-orange-100 bg-orange-100/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Parent 2</h3>
                  <dl className="mt-3 space-y-2 text-sm text-slate-700 break-words">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Nom</dt>
                      <dd className="font-medium text-slate-900">{profile.parent2Name || 'Non renseigné'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Statut</dt>
                      <dd className="font-medium text-slate-900">
                        {parentStatusLabel(profile.parent2Status, profile.parent2StatusOther)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Portable</dt>
                      <dd className="font-medium text-slate-900">
                        {profile.parent2Phone ? formatFrenchPhone(profile.parent2Phone) : 'Non renseigné'}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Email</dt>
                      <dd className="font-medium text-slate-900">
                        {profile.parent2Email || 'Non renseigné'}
                      </dd>
                    </div>
                    {profile.parent2HasDifferentAddress && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-slate-500">Adresse</dt>
                        <dd className="max-w-[65%] text-right font-medium text-slate-900">{parent2Address}</dd>
                      </div>
                    )}
                  </dl>
                </article>
              </div>

              <button
                onClick={openEditModal}
                className="mt-5 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Mettre à jour les informations du parent 2
              </button>
            </section>

            <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              <h3 className="font-display text-base font-semibold text-slate-900">Aide & confidentialité</h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/bien-choisir-sa-colo" className="hover:text-brand-600">
                    Bien choisir sa colo
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-brand-600">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className="hover:text-brand-600">
                    Politique de confidentialité
                  </Link>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-display text-xl font-semibold text-slate-900">
                Mettre à jour les informations du parent 2
              </h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-6 space-y-6" onSubmit={onSubmit}>
              {saveError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {saveError}
                </p>
              ) : null}

              <section className="rounded-xl border border-orange-100 bg-orange-100/60 p-4">
                <h4 className="text-sm font-semibold text-slate-900">Parent 2</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                    Nom parent 2
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent2Name}
                      onChange={(event) => updateField('parent2Name', event.target.value)}
                      placeholder="Nom et prénom"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Statut parent 2
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent2Status}
                      onChange={(event) => updateField('parent2Status', event.target.value as ParentStatus)}
                    >
                      <option value="pere">Père</option>
                      <option value="mere">Mère</option>
                      <option value="grand-parent">Grand-parent</option>
                      <option value="autre">Autre</option>
                    </select>
                    {draft.parent2Status === 'autre' && (
                      <input
                        type="text"
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={draft.parent2StatusOther}
                        onChange={(event) => updateField('parent2StatusOther', event.target.value)}
                        placeholder="Précisez le statut"
                        required
                      />
                    )}
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Portable parent 2
                    <input
                      type="tel"
                      inputMode="tel"
                      pattern="^0[1-9]([.][0-9]{2}){4}$"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent2Phone}
                      onChange={(event) => updateField('parent2Phone', formatFrenchPhone(event.target.value))}
                      placeholder="01.23.45.67.89"
                    />
                  </label>
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                    Email parent 2
                    <input
                      type="email"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent2Email}
                      onChange={(event) => updateField('parent2Email', event.target.value)}
                      placeholder="parent2@mail.fr"
                    />
                  </label>
                  <label className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.parent2HasDifferentAddress}
                      onChange={(event) => handleParent2DifferentAddressChange(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    Adresse du parent 2 différente du domicile
                  </label>
                  {!draft.parent2HasDifferentAddress && (
                    <p className="sm:col-span-2 -mt-1 text-xs text-slate-500">
                      Parent 2 utilise la même adresse que le domicile.
                    </p>
                  )}
                </div>

                {draft.parent2HasDifferentAddress && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                      N° et voie parent 2
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={draft.parent2AddressLine1}
                        onChange={(event) => updateField('parent2AddressLine1', event.target.value)}
                        placeholder="Ex: 18 avenue de la République"
                        required={draft.parent2HasDifferentAddress}
                      />
                    </label>
                    <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                      Complément d&apos;adresse parent 2
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={draft.parent2AddressLine2}
                        onChange={(event) => updateField('parent2AddressLine2', event.target.value)}
                        placeholder="Bâtiment, appartement, étage..."
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Code postal parent 2
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{5}"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={draft.parent2PostalCode}
                        onChange={(event) => updateField('parent2PostalCode', event.target.value)}
                        placeholder="75001"
                        required={draft.parent2HasDifferentAddress}
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Ville parent 2
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={draft.parent2City}
                        onChange={(event) => updateField('parent2City', event.target.value)}
                        placeholder="Paris"
                        required={draft.parent2HasDifferentAddress}
                      />
                    </label>
                  </div>
                )}
              </section>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
