'use client';

import { useEffect, useState } from 'react';
import {
  Heart,
  Mail,
  MapPin,
  CalendarDays,
  UserRound,
  ShieldCheck,
  Settings,
  Home,
  X
} from 'lucide-react';
import Link from 'next/link';
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  formatFrenchPhone,
  parentStatusLabel,
  readAccountPreferences,
  saveAccountPreferences,
  type AccountInfo,
  type ParentStatus
} from '@/lib/account-preferences';

const mockUpcoming = [
  {
    id: '1',
    title: 'Colonie multi-activités - Alpes',
    dates: '12 au 19 août 2026',
    child: 'Léo, 11 ans',
    organizer: 'Aventures Vacances Énergie',
    status: 'Dossier en cours'
  }
];

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

function formatAddress(line1: string, line2: string, postalCode: string, city: string) {
  return [line1, line2, `${postalCode} ${city}`.trim()].filter(Boolean).join(', ');
}

export default function MonCompteClient() {
  const [profile, setProfile] = useState({
    name: DEFAULT_ACCOUNT_PREFERENCES.userName,
    email: DEFAULT_ACCOUNT_PREFERENCES.userEmail,
    city: DEFAULT_ACCOUNT_PREFERENCES.userCity
  });
  const [accountInfo, setAccountInfo] = useState<AccountInfo>(DEFAULT_ACCOUNT_PREFERENCES.accountInfo);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<AccountInfo>(DEFAULT_ACCOUNT_PREFERENCES.accountInfo);

  useEffect(() => {
    const storedPreferences = readAccountPreferences();
    setProfile({
      name: storedPreferences.userName,
      email: storedPreferences.userEmail,
      city: storedPreferences.userCity
    });
    setAccountInfo(storedPreferences.accountInfo);
    setDraft(storedPreferences.accountInfo);
  }, []);

  const fullAddress = formatAddress(
    accountInfo.addressLine1,
    accountInfo.addressLine2,
    accountInfo.postalCode,
    accountInfo.city
  );
  const parent2Address = accountInfo.parent2HasDifferentAddress
    ? formatAddress(
        accountInfo.parent2AddressLine1,
        accountInfo.parent2AddressLine2,
        accountInfo.parent2PostalCode,
        accountInfo.parent2City
      )
    : 'Identique à l’adresse du domicile';

  function openEditModal() {
    setDraft(accountInfo);
    setIsModalOpen(true);
  }

  function closeEditModal() {
    setIsModalOpen(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextAccountInfo = { ...draft };
    setAccountInfo(nextAccountInfo);
    saveAccountPreferences({
      userName: profile.name,
      userEmail: profile.email,
      userCity: profile.city,
      accountInfo: nextAccountInfo
    });
    setIsModalOpen(false);
  }

  function updateField<K extends keyof AccountInfo>(key: K, value: AccountInfo[K]) {
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
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">Bonjour {profile.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Mail className="h-4 w-4" />
                {profile.email}
                <span className="mx-1 hidden text-slate-300 sm:inline">|</span>
                <MapPin className="h-4 w-4" />
                {profile.city}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact/preferences" className="btn btn-secondary btn-sm">
              <Settings className="h-4 w-4" />
              Préférences
            </Link>
            <button className="btn btn-primary btn-sm">Se déconnecter</button>
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

              {mockUpcoming.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Vous n&apos;avez pas encore de réservation. Parcourez les séjours et ajoutez-les à votre panier.
                </p>
              ) : (
                <ul className="mt-6 space-y-4">
                  {mockUpcoming.map((stay) => (
                    <li
                      key={stay.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-700"
                    >
                      <p className="font-display text-base font-semibold text-slate-900">{stay.title}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <CalendarDays className="h-4 w-4" />
                        {stay.dates}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{stay.child}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Organisateur : <span className="font-medium">{stay.organizer}</span>
                      </p>
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
                      <dd className="font-medium text-slate-900">{accountInfo.parent1Name}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Statut</dt>
                      <dd className="font-medium text-slate-900">
                        {parentStatusLabel(accountInfo.parent1Status, accountInfo.parent1StatusOther)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Portable</dt>
                      <dd className="font-medium text-slate-900">{formatFrenchPhone(accountInfo.parent1Phone)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Email</dt>
                      <dd className="font-medium text-slate-900">{accountInfo.parent1Email}</dd>
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
                      <dd className="font-medium text-slate-900">{accountInfo.parent2Name || 'Non renseigné'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Statut</dt>
                      <dd className="font-medium text-slate-900">
                        {parentStatusLabel(accountInfo.parent2Status, accountInfo.parent2StatusOther)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Portable</dt>
                      <dd className="font-medium text-slate-900">
                        {accountInfo.parent2Phone ? formatFrenchPhone(accountInfo.parent2Phone) : 'Non renseigné'}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Email</dt>
                      <dd className="font-medium text-slate-900">
                        {accountInfo.parent2Email || 'Non renseigné'}
                      </dd>
                    </div>
                    {accountInfo.parent2HasDifferentAddress && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-slate-500">Adresse</dt>
                        <dd className="max-w-[65%] text-right font-medium text-slate-900">
                          {parent2Address || 'Non renseignée'}
                        </dd>
                      </div>
                    )}
                  </dl>
                </article>
              </div>

              <button
                onClick={openEditModal}
                className="mt-5 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Mettre à jour les informations
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
              <h3 className="font-display text-xl font-semibold text-slate-900">Mettre à jour les informations</h3>
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
              <section>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Home className="h-4 w-4" />
                  Adresse du domicile
                </h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                    N° et voie
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.addressLine1}
                      onChange={(e) => updateField('addressLine1', e.target.value)}
                      placeholder="Ex: 12 rue des Tilleuls"
                      required
                    />
                  </label>
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                    Complément d&apos;adresse
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.addressLine2}
                      onChange={(e) => updateField('addressLine2', e.target.value)}
                      placeholder="Bâtiment, appartement, étage..."
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Code postal
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{5}"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.postalCode}
                      onChange={(e) => updateField('postalCode', e.target.value)}
                      placeholder="75001"
                      required
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Ville
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="Paris"
                      required
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-blue-100 bg-blue-100/60 p-4">
                <h4 className="text-sm font-semibold text-slate-900">Parent 1</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                    Nom parent 1
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent1Name}
                      onChange={(e) => updateField('parent1Name', e.target.value)}
                      placeholder="Nom et prénom"
                      required
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Statut parent 1
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent1Status}
                      onChange={(e) => updateField('parent1Status', e.target.value as ParentStatus)}
                    >
                      <option value="pere">Père</option>
                      <option value="mere">Mère</option>
                      <option value="grand-parent">Grand-parent</option>
                      <option value="autre">Autre</option>
                    </select>
                    {draft.parent1Status === 'autre' && (
                      <input
                        type="text"
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={draft.parent1StatusOther}
                        onChange={(e) => updateField('parent1StatusOther', e.target.value)}
                        placeholder="Précisez le statut"
                        required
                      />
                    )}
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Portable parent 1
                    <input
                      type="tel"
                      inputMode="tel"
                      pattern="^0[1-9]([.][0-9]{2}){4}$"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent1Phone}
                      onChange={(e) => updateField('parent1Phone', formatFrenchPhone(e.target.value))}
                      placeholder="01.23.45.67.89"
                      required
                    />
                  </label>
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                    Email parent 1
                    <input
                      type="email"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent1Email}
                      onChange={(e) => updateField('parent1Email', e.target.value)}
                      placeholder="parent1@mail.fr"
                      required
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-orange-100 bg-orange-100/60 p-4">
                <h4 className="text-sm font-semibold text-slate-900">Parent 2</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                    Nom parent 2
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent2Name}
                      onChange={(e) => updateField('parent2Name', e.target.value)}
                      placeholder="Nom et prénom"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Statut parent 2
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent2Status}
                      onChange={(e) => updateField('parent2Status', e.target.value as ParentStatus)}
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
                        onChange={(e) => updateField('parent2StatusOther', e.target.value)}
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
                      onChange={(e) => updateField('parent2Phone', formatFrenchPhone(e.target.value))}
                      placeholder="01.23.45.67.89"
                    />
                  </label>
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                    Email parent 2
                    <input
                      type="email"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={draft.parent2Email}
                      onChange={(e) => updateField('parent2Email', e.target.value)}
                      placeholder="parent2@mail.fr"
                    />
                  </label>
                  <label className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.parent2HasDifferentAddress}
                      onChange={(e) => handleParent2DifferentAddressChange(e.target.checked)}
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
                        onChange={(e) => updateField('parent2AddressLine1', e.target.value)}
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
                        onChange={(e) => updateField('parent2AddressLine2', e.target.value)}
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
                        onChange={(e) => updateField('parent2PostalCode', e.target.value)}
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
                        onChange={(e) => updateField('parent2City', e.target.value)}
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
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
