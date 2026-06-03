'use client';

import { useState } from 'react';

function formatQuotient(value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
}

function formatExpiresOn(value: string | null) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR');
}

function isExpired(expiresOn: string | null) {
  if (!expiresOn) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiresOn}T00:00:00`);
  return expiry.getTime() < today.getTime();
}

type PartnerBeneficiaryFamilyQuotientEditorProps = {
  beneficiaryUserId: string;
  beneficiaryName: string;
  familyQuotient: number | null;
  familyQuotientExpiresOn: string | null;
  saveAction: (formData: FormData) => void | Promise<void>;
  variant?: 'quotient' | 'expiration' | 'combined';
};

export function PartnerBeneficiaryFamilyQuotientEditor({
  beneficiaryUserId,
  beneficiaryName,
  familyQuotient,
  familyQuotientExpiresOn,
  saveAction,
  variant = 'combined'
}: PartnerBeneficiaryFamilyQuotientEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const expired = isExpired(familyQuotientExpiresOn);
  const defaultQuotient =
    familyQuotient != null ? String(familyQuotient).replace('.', ',') : '';
  const isEmpty = familyQuotient == null && !familyQuotientExpiresOn;

  if (isEditing) {
    return (
      <form action={saveAction} className="flex min-w-[220px] flex-col gap-2">
        <input type="hidden" name="beneficiary_user_id" value={beneficiaryUserId} />
        <label className="text-xs font-medium text-slate-600">
          QF
          <input
            type="text"
            name="family_quotient"
            inputMode="decimal"
            defaultValue={defaultQuotient}
            placeholder="Ex. 850"
            autoFocus
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Date d&apos;expiration
          <input
            type="date"
            name="family_quotient_expires_on"
            defaultValue={familyQuotientExpiresOn ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      </form>
    );
  }

  const displayLabel =
    variant === 'quotient'
      ? formatQuotient(familyQuotient)
      : variant === 'expiration'
        ? formatExpiresOn(familyQuotientExpiresOn)
        : `${formatQuotient(familyQuotient)} · ${formatExpiresOn(familyQuotientExpiresOn)}`;

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1"
      aria-label={`QF de ${beneficiaryName}. ${isEmpty ? 'Renseigner' : 'Modifier'}.`}
    >
      <span
        className={`font-semibold underline-offset-2 transition group-hover:underline ${
          variant === 'expiration' && expired
            ? 'text-rose-700'
            : isEmpty
              ? 'text-brand-600'
              : 'text-slate-900'
        }`}
      >
        {isEmpty ? 'Renseigner' : displayLabel}
      </span>
      {variant === 'expiration' && expired ? (
        <span className="mt-0.5 block text-xs text-rose-600">Expiré</span>
      ) : null}
      {variant === 'quotient' && familyQuotient == null ? (
        <span className="mt-0.5 block text-xs text-slate-500">Cliquer pour saisir</span>
      ) : null}
    </button>
  );
}
