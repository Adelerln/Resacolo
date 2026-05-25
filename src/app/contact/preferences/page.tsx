'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Home, Save, UserRound } from 'lucide-react';
import { formatPhoneInput, type ParentStatus } from '@/lib/account-preferences';
import { fetchFamilyProfileSnapshot, patchFamilyProfilePreferences } from '@/lib/account-profile/client';
import type { FamilyProfile } from '@/types/family-profile';

function inputClass() {
  return 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';
}

/** Hauteur fixe alignée sur la ligne Statut / Portable (select + téléphone). */
function rowControlClass(extra = '') {
  return [
    'mt-1 box-border flex h-10 min-h-[2.5rem] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition',
    'focus:border-brand-300 focus:ring-2 focus:ring-brand-100',
    extra
  ]
    .filter(Boolean)
    .join(' ');
}

const DIAL_CODE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: '+33', label: 'France (+33)' },
  { code: '+1', label: 'USA/Canada (+1)' },
  { code: '+44', label: 'Royaume-Uni (+44)' },
  { code: '+49', label: 'Allemagne (+49)' },
  { code: '+34', label: 'Espagne (+34)' },
  { code: '+39', label: 'Italie (+39)' },
  { code: '+32', label: 'Belgique (+32)' },
  { code: '+41', label: 'Suisse (+41)' },
  { code: '+31', label: 'Pays-Bas (+31)' },
  { code: '+351', label: 'Portugal (+351)' },
  { code: '+353', label: 'Irlande (+353)' },
  { code: '+212', label: 'Maroc (+212)' },
  { code: '+213', label: 'Algérie (+213)' },
  { code: '+216', label: 'Tunisie (+216)' },
  { code: '+221', label: 'Sénégal (+221)' },
  { code: '+225', label: "Côte d'Ivoire (+225)" },
  { code: '+229', label: 'Bénin (+229)' },
  { code: '+226', label: 'Burkina Faso (+226)' },
  { code: '+237', label: 'Cameroun (+237)' },
  { code: '+243', label: 'RDC (+243)' },
  { code: '+27', label: 'Afrique du Sud (+27)' },
  { code: '+20', label: 'Égypte (+20)' },
  { code: '+90', label: 'Turquie (+90)' },
  { code: '+30', label: 'Grèce (+30)' },
  { code: '+48', label: 'Pologne (+48)' },
  { code: '+40', label: 'Roumanie (+40)' },
  { code: '+420', label: 'République tchèque (+420)' },
  { code: '+43', label: 'Autriche (+43)' },
  { code: '+45', label: 'Danemark (+45)' },
  { code: '+46', label: 'Suède (+46)' },
  { code: '+47', label: 'Norvège (+47)' },
  { code: '+358', label: 'Finlande (+358)' },
  { code: '+7', label: 'Russie/Kazakhstan (+7)' },
  { code: '+380', label: 'Ukraine (+380)' },
  { code: '+381', label: 'Serbie (+381)' },
  { code: '+385', label: 'Croatie (+385)' },
  { code: '+386', label: 'Slovénie (+386)' },
  { code: '+36', label: 'Hongrie (+36)' },
  { code: '+421', label: 'Slovaquie (+421)' },
  { code: '+91', label: 'Inde (+91)' },
  { code: '+92', label: 'Pakistan (+92)' },
  { code: '+94', label: 'Sri Lanka (+94)' },
  { code: '+93', label: 'Afghanistan (+93)' },
  { code: '+86', label: 'Chine (+86)' },
  { code: '+81', label: 'Japon (+81)' },
  { code: '+82', label: 'Corée du Sud (+82)' },
  { code: '+84', label: 'Vietnam (+84)' },
  { code: '+66', label: 'Thaïlande (+66)' },
  { code: '+65', label: 'Singapour (+65)' },
  { code: '+60', label: 'Malaisie (+60)' },
  { code: '+62', label: 'Indonésie (+62)' },
  { code: '+63', label: 'Philippines (+63)' },
  { code: '+971', label: 'Émirats arabes unis (+971)' },
  { code: '+966', label: 'Arabie saoudite (+966)' },
  { code: '+961', label: 'Liban (+961)' },
  { code: '+972', label: 'Israël (+972)' },
  { code: '+98', label: 'Iran (+98)' },
  { code: '+964', label: 'Irak (+964)' },
  { code: '+974', label: 'Qatar (+974)' },
  { code: '+965', label: 'Koweït (+965)' },
  { code: '+968', label: 'Oman (+968)' },
  { code: '+52', label: 'Mexique (+52)' },
  { code: '+54', label: 'Argentine (+54)' },
  { code: '+55', label: 'Brésil (+55)' },
  { code: '+56', label: 'Chili (+56)' },
  { code: '+57', label: 'Colombie (+57)' },
  { code: '+58', label: 'Venezuela (+58)' },
  { code: '+51', label: 'Pérou (+51)' },
  { code: '+593', label: 'Équateur (+593)' },
  { code: '+598', label: 'Uruguay (+598)' },
  { code: '+595', label: 'Paraguay (+595)' },
  { code: '+591', label: 'Bolivie (+591)' },
  { code: '+61', label: 'Australie (+61)' },
  { code: '+64', label: 'Nouvelle-Zélande (+64)' }
];

function dialCodeOptionsWithCurrent(current: string) {
  if (DIAL_CODE_OPTIONS.some((option) => option.code === current)) return DIAL_CODE_OPTIONS;
  return [{ code: current, label: `Autre (${current})` }, ...DIAL_CODE_OPTIONS];
}

function splitName(value: string | null | undefined) {
  const clean = value?.trim() ?? '';
  if (!clean) {
    return { firstName: '', lastName: '' };
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function joinNameParts(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();
}

/** Forme réelle du formulaire. */
type ContactPrefsAccountInfo = {
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  parent1FirstName: string;
  parent1LastName: string;
  parent2FirstName: string;
  parent2LastName: string;
  parent1Phone: string;
  parent2Phone: string;
  parent1Email: string;
  parent2Email: string;
  parent1Status: ParentStatus;
  parent2Status: ParentStatus;
  parent1StatusOther: string;
  parent2StatusOther: string;
  parent2HasDifferentAddress: boolean;
  parent2AddressLine1: string;
  parent2AddressLine2: string;
  parent2PostalCode: string;
  parent2City: string;
};

type ContactPrefsForm = {
  userName: string;
  userEmail: string;
  userCity: string;
  accountInfo: ContactPrefsAccountInfo;
};

const KNOWN_DIAL_CODES_DESC = [...new Set(DIAL_CODE_OPTIONS.map((option) => option.code.replace('+', '')))].sort(
  (a, b) => b.length - a.length
);

function extractDialCodeFromPhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('+')) return '+33';
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '+33';
  for (const code of KNOWN_DIAL_CODES_DESC) {
    if (digits.startsWith(code)) {
      return `+${code}`;
    }
  }
  return `+${digits.slice(0, 4)}`;
}

/** Parent 2 considéré comme non renseigné (case « Désactiver » à côté du titre). */
function isParent2EffectivelyEmpty(accountInfo: ContactPrefsAccountInfo): boolean {
  if (accountInfo.parent2FirstName.trim()) return false;
  if (accountInfo.parent2LastName.trim()) return false;
  if (accountInfo.parent2Email.trim()) return false;
  if (accountInfo.parent2HasDifferentAddress) return false;
  if (
    accountInfo.parent2AddressLine1.trim() ||
    accountInfo.parent2PostalCode.trim() ||
    accountInfo.parent2City.trim()
  ) {
    return false;
  }
  if (accountInfo.parent2Status === 'autre' && accountInfo.parent2StatusOther.trim()) return false;
  const dialDigits = extractDialCodeFromPhone(accountInfo.parent2Phone).replace(/\D/g, '');
  const allDigits = accountInfo.parent2Phone.replace(/\D/g, '');
  const national = allDigits.startsWith(dialDigits) ? allDigits.slice(dialDigits.length) : allDigits;
  if (national.replace(/^0+/, '').length >= 6) return false;
  return true;
}

const EMPTY_FORM: ContactPrefsForm = {
  userName: '',
  userEmail: '',
  userCity: '',
  accountInfo: {
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    parent1FirstName: '',
    parent1LastName: '',
    parent2FirstName: '',
    parent2LastName: '',
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

function profileToForm(profile: FamilyProfile): ContactPrefsForm {
  const parent2Identity = splitName(profile.parent2Name);
  return {
    userName: joinNameParts(profile.billingFirstName, profile.billingLastName),
    userEmail: profile.email,
    userCity: profile.city,
    accountInfo: {
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      postalCode: profile.postalCode,
      city: profile.city,
      parent1FirstName: profile.billingFirstName,
      parent1LastName: profile.billingLastName,
      parent2FirstName: parent2Identity.firstName,
      parent2LastName: parent2Identity.lastName,
      parent1Phone: formatPhoneInput(profile.phone),
      parent2Phone: formatPhoneInput(profile.parent2Phone),
      parent1Email: profile.email,
      parent2Email: profile.parent2Email,
      parent1Status: profile.parent1Status as ParentStatus,
      parent2Status: profile.parent2Status as ParentStatus,
      parent1StatusOther: profile.parent1StatusOther,
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
  const [form, setForm] = useState<ContactPrefsForm>(EMPTY_FORM);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideParent2, setHideParent2] = useState(false);

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

  const isParent2Empty = useMemo(
    () => isParent2EffectivelyEmpty(form.accountInfo),
    [form.accountInfo]
  );

  useEffect(() => {
    if (!isParent2Empty && hideParent2) {
      setHideParent2(false);
    }
  }, [hideParent2, isParent2Empty]);

  function updateProfileField<K extends 'userEmail' | 'userCity'>(key: K, value: ContactPrefsForm[K]) {
    setSaveStatus('idle');
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'userEmail') {
        next.accountInfo = { ...next.accountInfo, parent1Email: String(value) };
      }
      if (key === 'userCity') {
        next.accountInfo = { ...next.accountInfo, city: String(value) };
      }
      return next;
    });
  }

  function updateAccountField<K extends keyof ContactPrefsAccountInfo>(key: K, value: ContactPrefsAccountInfo[K]) {
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

  function handleHideParent2Change(checked: boolean) {
    setSaveStatus('idle');
    setHideParent2(checked);
    if (!checked) return;
    setForm((prev) => ({
      ...prev,
      accountInfo: {
        ...prev.accountInfo,
        parent2FirstName: '',
        parent2LastName: '',
        parent2Status: 'pere',
        parent2StatusOther: '',
        parent2Phone: '',
        parent2Email: '',
        parent2HasDifferentAddress: false,
        parent2AddressLine1: '',
        parent2AddressLine2: '',
        parent2PostalCode: '',
        parent2City: ''
      }
    }));
  }

  function normalizeDialCodeInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (!digits) return '+';
    return `+${digits}`;
  }

  function applyDialCode(field: 'parent1Phone' | 'parent2Phone', dialCodeRaw: string) {
    setSaveStatus('idle');
    setForm((prev) => {
      const current = prev.accountInfo[field] ?? '';
      const dialCode = normalizeDialCodeInput(dialCodeRaw);
      const digits = current.replace(/\D/g, '');
      const currentDialDigits = extractDialCodeFromPhone(current).replace('+', '');
      const nextDialDigits = dialCode.replace('+', '');
      const national = digits.startsWith(currentDialDigits)
        ? digits.slice(currentDialDigits.length)
        : digits.startsWith('0')
          ? digits.slice(1)
          : digits;
      return {
        ...prev,
        accountInfo: {
          ...prev.accountInfo,
          [field]: formatPhoneInput(`+${nextDialDigits}${national}`)
        }
      };
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveStatus('idle');
    setError(null);
    if (!form.accountInfo.parent1LastName.trim()) {
      setError('Le nom du parent 1 est requis.');
      return;
    }
    if (!form.accountInfo.parent1FirstName.trim()) {
      setError('Le prénom du parent 1 est requis.');
      return;
    }
    if (!form.accountInfo.parent1Email.trim()) {
      setError("L'email du parent 1 est requis.");
      return;
    }
    if (!form.accountInfo.parent1Phone.trim()) {
      setError('Le téléphone du parent 1 est requis.');
      return;
    }
    if (!form.accountInfo.addressLine1.trim() || !form.accountInfo.postalCode.trim() || !form.accountInfo.city.trim()) {
      setError("L'adresse principale est incomplète.");
      return;
    }
    if (form.accountInfo.parent1Status === 'autre' && !form.accountInfo.parent1StatusOther.trim()) {
      setError('Précisez le statut du parent 1.');
      return;
    }
    if (!hideParent2 && form.accountInfo.parent2Status === 'autre' && !form.accountInfo.parent2StatusOther.trim()) {
      setError('Précisez le statut du parent 2.');
      return;
    }
    if (
      !hideParent2 &&
      form.accountInfo.parent2HasDifferentAddress &&
      (!form.accountInfo.parent2AddressLine1.trim() ||
        !form.accountInfo.parent2PostalCode.trim() ||
        !form.accountInfo.parent2City.trim())
    ) {
      setError("L'adresse du parent 2 est incomplète.");
      return;
    }

    setIsSaving(true);
    const payload = {
      parent1Name: joinNameParts(form.accountInfo.parent1FirstName, form.accountInfo.parent1LastName),
      parent1Status: form.accountInfo.parent1Status,
      parent1StatusOther: form.accountInfo.parent1StatusOther,
      parent1Email: form.accountInfo.parent1Email || form.userEmail,
      parent1Phone: form.accountInfo.parent1Phone,
      addressLine1: form.accountInfo.addressLine1,
      addressLine2: form.accountInfo.addressLine2,
      postalCode: form.accountInfo.postalCode,
      city: form.accountInfo.city,
      country: 'France',
      parent2Name: hideParent2 ? '' : joinNameParts(form.accountInfo.parent2FirstName, form.accountInfo.parent2LastName),
      parent2Status: hideParent2 ? 'pere' : form.accountInfo.parent2Status,
      parent2StatusOther: hideParent2 ? '' : form.accountInfo.parent2StatusOther,
      parent2Phone: hideParent2 ? '' : form.accountInfo.parent2Phone,
      parent2Email: hideParent2 ? '' : form.accountInfo.parent2Email,
      parent2HasDifferentAddress: hideParent2 ? false : form.accountInfo.parent2HasDifferentAddress,
      parent2AddressLine1: hideParent2 ? '' : form.accountInfo.parent2AddressLine1,
      parent2AddressLine2: hideParent2 ? '' : form.accountInfo.parent2AddressLine2,
      parent2PostalCode: hideParent2 ? '' : form.accountInfo.parent2PostalCode,
      parent2City: hideParent2 ? '' : form.accountInfo.parent2City
    };

    if (process.env.NODE_ENV !== 'production') {
      // Temporary logs to diagnose silent save failures in local/dev environments.
      console.info('[preferences] submit payload', payload);
    }

    try {
      await patchFamilyProfilePreferences(payload);
      if (process.env.NODE_ENV !== 'production') {
        console.info('[preferences] submit success');
      }
      setSaveStatus('saved');
      window.location.assign(`/mon-compte?updated=${Date.now()}`);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[preferences] submit failed', err);
      }
      setError(err instanceof Error ? err.message : 'Impossible de sauvegarder vos informations.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="section-container py-10 pb-24 sm:py-14 sm:pb-28">
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

        <form className="mt-8 space-y-6" onSubmit={onSubmit} noValidate>
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
              <label className="text-sm font-medium text-slate-700">
                Nom parent 1 *
                <input
                  type="text"
                  className={inputClass()}
                  value={form.accountInfo.parent1LastName}
                  onChange={(e) => updateAccountField('parent1LastName', e.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Prénom parent 1 *
                <input
                  type="text"
                  className={inputClass()}
                  value={form.accountInfo.parent1FirstName}
                  onChange={(e) => updateAccountField('parent1FirstName', e.target.value)}
                  required
                />
              </label>
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Ville *
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
                N° et voie *
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
                Code postal *
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
                Ville *
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
              <label className="text-sm font-medium text-slate-700">
                Statut parent 1
                <select
                  className={rowControlClass('w-full')}
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
                Portable parent 1 *
                <div className="mt-1 flex gap-2">
                  <select
                    className={rowControlClass('w-[min(100%,13.75rem)] shrink-0 font-semibold')}
                    value={extractDialCodeFromPhone(form.accountInfo.parent1Phone)}
                    onChange={(e) => applyDialCode('parent1Phone', e.target.value)}
                    aria-label="Indicatif parent 1"
                  >
                    {dialCodeOptionsWithCurrent(extractDialCodeFromPhone(form.accountInfo.parent1Phone)).map(
                      (option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                <input
                  type="tel"
                  inputMode="tel"
                  className={rowControlClass('min-w-0 w-full flex-1')}
                  value={form.accountInfo.parent1Phone}
                  onChange={(e) => updateAccountField('parent1Phone', formatPhoneInput(e.target.value))}
                  placeholder="+33 6 12 34 56 78"
                  required
                />
                </div>
              </label>
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Email parent 1 *
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Parent 2</h2>
              {isParent2Empty ? (
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={hideParent2}
                    onChange={(e) => handleHideParent2Change(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Désactiver
                </label>
              ) : null}
            </div>
            {!hideParent2 ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Nom parent 2
                <input
                  type="text"
                  className={inputClass()}
                  value={form.accountInfo.parent2LastName}
                  onChange={(e) => updateAccountField('parent2LastName', e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Prénom parent 2
                <input
                  type="text"
                  className={inputClass()}
                  value={form.accountInfo.parent2FirstName}
                  onChange={(e) => updateAccountField('parent2FirstName', e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Statut parent 2
                <select
                  className={rowControlClass('w-full')}
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
                <div className="mt-1 flex gap-2">
                  <select
                    className={rowControlClass('w-[min(100%,13.75rem)] shrink-0 font-semibold')}
                    value={extractDialCodeFromPhone(form.accountInfo.parent2Phone)}
                    onChange={(e) => applyDialCode('parent2Phone', e.target.value)}
                    aria-label="Indicatif parent 2"
                  >
                    {dialCodeOptionsWithCurrent(extractDialCodeFromPhone(form.accountInfo.parent2Phone)).map(
                      (option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                <input
                  type="tel"
                  inputMode="tel"
                  className={rowControlClass('min-w-0 w-full flex-1')}
                  value={form.accountInfo.parent2Phone}
                  onChange={(e) => updateAccountField('parent2Phone', formatPhoneInput(e.target.value))}
                  placeholder="+33 6 12 34 56 78"
                />
                </div>
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
            </div>
            ) : null}

            {!hideParent2 && form.accountInfo.parent2HasDifferentAddress && (
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
            <button type="submit" disabled={isSaving} className="btn btn-primary btn-sm inline-flex items-center gap-2 disabled:opacity-60">
              <Save className="h-4 w-4" />
              {isSaving ? 'Enregistrement...' : 'Enregistrer les préférences'}
            </button>
          </div>

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
