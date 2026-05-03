'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, Save, UserRound } from 'lucide-react';
import {
  formatPhoneInput,
  type AccountInfo,
  type AccountPreferences,
  type ParentStatus
} from '@/lib/account-preferences';
import { fetchFamilyProfileSnapshot, patchFamilyProfilePreferences } from '@/lib/account-profile/client';
import type { FamilyProfile } from '@/types/family-profile';

function inputClass() {
  return 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';
}

const EMPTY_FORM: AccountPreferences = {
  userName: '',
  userEmail: '',
  userCity: '',
  accountInfo: {
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    parent1Name: '',
    parent2Name: '',
    parent1Phone: '',
    parent2Phone: '',
    parent1Email: '',
    parent2Email: '',
    parent1Status: 'mere',
    parent2Status: 'pere',
    parent1StatusOther: '',
    parent2StatusOther: '',
    parent2HasDifferentAddress: false,
    parent2AddressLine1: '',
    parent2AddressLine2: '',
    parent2PostalCode: '',
    parent2City: ''
  }
};

function profileToForm(profile: FamilyProfile): AccountPreferences {
  const parent1Name = [profile.billingFirstName, profile.billingLastName].filter(Boolean).join(' ').trim();
  return {
    userName: parent1Name,
    userEmail: profile.email,
    userCity: profile.city,
    accountInfo: {
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      postalCode: profile.postalCode,
      city: profile.city,
      parent1Name,
      parent2Name: profile.parent2Name,
      parent1Phone: formatPhoneInput(profile.phone),
      parent2Phone: formatPhoneInput(profile.parent2Phone),
      parent1Email: profile.email,
      parent2Email: profile.parent2Email,
      parent1Status: 'mere',
      parent2Status: profile.parent2Status as ParentStatus,
      parent1StatusOther: '',
      parent2StatusOther: profile.parent2StatusOther,
      parent2HasDifferentAddress: profile.parent2HasDifferentAddress,
      parent2AddressLine1: profile.parent2AddressLine1,
      parent2AddressLine2: profile.parent2AddressLine2,
      parent2PostalCode: profile.parent2PostalCode,
      parent2City: profile.parent2City
    }
  };
}

export default function ContactPreferencesPage() {
  const router = useRouter();
  const [form, setForm] = useState<AccountPreferences>(EMPTY_FORM);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError(null);
    fetchFamilyProfileSnapshot()
      .then((snapshot) => {
        if (!isActive) return;
        setForm(profileToForm(snapshot.profile));
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : 'Impossible de charger le profil.');
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  function updateProfileField<K extends 'userName' | 'userEmail' | 'userCity'>(
    key: K,
    value: AccountPreferences[K]
  ) {
    setSaveStatus('idle');
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAccountField<K extends keyof AccountInfo>(key: K, value: AccountInfo[K]) {
    setSaveStatus('idle');
    setForm((prev) => ({
      ...prev,
      accountInfo: {
        ...prev.accountInfo,
        [key]: value
      }
    }));
  }

  function handleParent2DifferentAddressChange(checked: boolean) {
    setSaveStatus('idle');
    setForm((prev) => {
      if (checked) {
        return {
          ...prev,
          accountInfo: {
            ...prev.accountInfo,
            parent2HasDifferentAddress: true
          }
        };
      }

      return {
        ...prev,
        accountInfo: {
          ...prev.accountInfo,
          parent2HasDifferentAddress: false,
          parent2AddressLine1: '',
          parent2AddressLine2: '',
          parent2PostalCode: '',
          parent2City: ''
        }
      };
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveStatus('idle');
    setError(null);
    try {
      await patchFamilyProfilePreferences({
        parent1Name: form.accountInfo.parent1Name,
        parent1Email: form.accountInfo.parent1Email || form.userEmail,
        parent1Phone: form.accountInfo.parent1Phone,
        addressLine1: form.accountInfo.addressLine1,
        addressLine2: form.accountInfo.addressLine2,
        postalCode: form.accountInfo.postalCode,
        city: form.accountInfo.city,
        country: 'France',
        parent2Name: form.accountInfo.parent2Name,
        parent2Status: form.accountInfo.parent2Status,
        parent2StatusOther: form.accountInfo.parent2StatusOther,
        parent2Phone: form.accountInfo.parent2Phone,
        parent2Email: form.accountInfo.parent2Email,
        parent2HasDifferentAddress: form.accountInfo.parent2HasDifferentAddress,
        parent2AddressLine1: form.accountInfo.parent2AddressLine1,
        parent2AddressLine2: form.accountInfo.parent2AddressLine2,
        parent2PostalCode: form.accountInfo.parent2PostalCode,
        parent2City: form.accountInfo.parent2City
      });
      setSaveStatus('saved');
      router.push('/mon-compte');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de sauvegarder vos informations.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="section-container py-10 sm:py-14">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Contact</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              Préférences
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Modifiez ici vos informations de profil et de contact.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/mon-compte" className="btn btn-secondary btn-sm">
              Retour mon compte
            </Link>
          </div>
        </header>

        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-slate-600">Chargement du profil…</p>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <UserRound className="h-4 w-4" />
              Profil
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Nom complet
                <input
                  type="text"
                  className={inputClass()}
                  value={form.userName}
                  onChange={(e) => updateProfileField('userName', e.target.value)}
                  required
                />
              </label>
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Email principal
                <input
                  type="email"
                  className={inputClass()}
                  value={form.userEmail}
                  onChange={(e) => updateProfileField('userEmail', e.target.value)}
                  required
                />
              </label>
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Ville (affichage)
                <input
                  type="text"
                  className={inputClass()}
                  value={form.userCity}
                  onChange={(e) => updateProfileField('userCity', e.target.value)}
                  required
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Home className="h-4 w-4" />
              Adresse du domicile
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                N° et voie
                <input
                  type="text"
                  className={inputClass()}
                  value={form.accountInfo.addressLine1}
                  onChange={(e) => updateAccountField('addressLine1', e.target.value)}
                  required
                />
              </label>
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Complément d&apos;adresse
                <input
                  type="text"
                  className={inputClass()}
                  value={form.accountInfo.addressLine2}
                  onChange={(e) => updateAccountField('addressLine2', e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Code postal
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  className={inputClass()}
                  value={form.accountInfo.postalCode}
                  onChange={(e) => updateAccountField('postalCode', e.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Ville
                <input
                  type="text"
                  className={inputClass()}
                  value={form.accountInfo.city}
                  onChange={(e) => updateAccountField('city', e.target.value)}
                  required
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-100/60 p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">Parent 1</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Nom parent 1
                <input
                  type="text"
                  className={inputClass()}
                  value={form.accountInfo.parent1Name}
                  onChange={(e) => updateAccountField('parent1Name', e.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Statut parent 1
                <select
                  className={inputClass()}
                  value={form.accountInfo.parent1Status}
                  onChange={(e) => updateAccountField('parent1Status', e.target.value as ParentStatus)}
                >
                  <option value="pere">Père</option>
                  <option value="mere">Mère</option>
                  <option value="grand-parent">Grand-parent</option>
                  <option value="autre">Autre</option>
                </select>
                {form.accountInfo.parent1Status === 'autre' && (
                  <input
                    type="text"
                    className={inputClass()}
                    value={form.accountInfo.parent1StatusOther}
                    onChange={(e) => updateAccountField('parent1StatusOther', e.target.value)}
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
                  className={inputClass()}
                  value={form.accountInfo.parent1Phone}
                  onChange={(e) => updateAccountField('parent1Phone', formatPhoneInput(e.target.value))}
                  placeholder="+33 6 12 34 56 78"
                  required
                />
              </label>
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Email parent 1
                <input
                  type="email"
                  className={inputClass()}
                  value={form.accountInfo.parent1Email}
                  onChange={(e) => updateAccountField('parent1Email', e.target.value)}
                  required
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-orange-100 bg-orange-100/60 p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">Parent 2</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Nom parent 2
                <input
                  type="text"
                  className={inputClass()}
                  value={form.accountInfo.parent2Name}
                  onChange={(e) => updateAccountField('parent2Name', e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Statut parent 2
                <select
                  className={inputClass()}
                  value={form.accountInfo.parent2Status}
                  onChange={(e) => updateAccountField('parent2Status', e.target.value as ParentStatus)}
                >
                  <option value="pere">Père</option>
                  <option value="mere">Mère</option>
                  <option value="grand-parent">Grand-parent</option>
                  <option value="autre">Autre</option>
                </select>
                {form.accountInfo.parent2Status === 'autre' && (
                  <input
                    type="text"
                    className={inputClass()}
                    value={form.accountInfo.parent2StatusOther}
                    onChange={(e) => updateAccountField('parent2StatusOther', e.target.value)}
                    placeholder="Précisez le statut"
                  />
                )}
              </label>
              <label className="text-sm font-medium text-slate-700">
                Portable parent 2
                <input
                  type="tel"
                  inputMode="tel"
                  className={inputClass()}
                  value={form.accountInfo.parent2Phone}
                  onChange={(e) => updateAccountField('parent2Phone', formatPhoneInput(e.target.value))}
                  placeholder="+33 6 12 34 56 78"
                />
              </label>
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Email parent 2
                <input
                  type="email"
                  className={inputClass()}
                  value={form.accountInfo.parent2Email}
                  onChange={(e) => updateAccountField('parent2Email', e.target.value)}
                />
              </label>
              <label className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.accountInfo.parent2HasDifferentAddress}
                  onChange={(e) => handleParent2DifferentAddressChange(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Adresse du parent 2 différente du domicile
              </label>
              {!form.accountInfo.parent2HasDifferentAddress && (
                <p className="sm:col-span-2 -mt-1 text-xs text-slate-600">
                  Parent 2 utilise la même adresse que le domicile.
                </p>
              )}
            </div>

            {form.accountInfo.parent2HasDifferentAddress && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                  N° et voie parent 2
                  <input
                    type="text"
                    className={inputClass()}
                    value={form.accountInfo.parent2AddressLine1}
                    onChange={(e) => updateAccountField('parent2AddressLine1', e.target.value)}
                  />
                </label>
                <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                  Complément d&apos;adresse parent 2
                  <input
                    type="text"
                    className={inputClass()}
                    value={form.accountInfo.parent2AddressLine2}
                    onChange={(e) => updateAccountField('parent2AddressLine2', e.target.value)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Code postal parent 2
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{5}"
                    className={inputClass()}
                    value={form.accountInfo.parent2PostalCode}
                    onChange={(e) => updateAccountField('parent2PostalCode', e.target.value)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Ville parent 2
                  <input
                    type="text"
                    className={inputClass()}
                    value={form.accountInfo.parent2City}
                    onChange={(e) => updateAccountField('parent2City', e.target.value)}
                  />
                </label>
              </div>
            )}
          </section>

          <div className="relative z-30 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link href="/mon-compte" className="btn btn-secondary btn-sm">
              Annuler
            </Link>
            <button type="submit" className="btn btn-primary btn-sm inline-flex items-center gap-2">
              <Save className="h-4 w-4" />
              Enregistrer les préférences
            </button>
          </div>

          <div aria-hidden className="h-20 bg-slate-50" />

          {saveStatus === 'saved' && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Préférences enregistrées.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
