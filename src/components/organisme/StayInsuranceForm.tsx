'use client';

import { useState } from 'react';

type StayInsuranceFormProps = {
  action: (formData: FormData) => void;
  disabled?: boolean;
};

export default function StayInsuranceForm({
  action,
  disabled = false
}: StayInsuranceFormProps) {
  const [pricingMode, setPricingMode] = useState<'FIXED' | 'PERCENT'>('FIXED');

  return (
    <form action={action} className="space-y-3 border-t border-slate-100 pt-4">
      <label className="text-sm font-medium text-slate-700">
        Libellé
        <input
          name="label"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          placeholder="Ex. Assurance annulation"
          required
          disabled={disabled}
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Type de calcul
        <select
          name="pricing_mode"
          value={pricingMode}
          onChange={(event) => setPricingMode(event.target.value === 'PERCENT' ? 'PERCENT' : 'FIXED')}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          disabled={disabled}
        >
          <option value="FIXED">Montant fixe</option>
          <option value="PERCENT">Pourcentage</option>
        </select>
      </label>
      {pricingMode === 'FIXED' ? (
        <label className="text-sm font-medium text-slate-700">
          Montant fixe en euros
          <input
            name="amount_euros"
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="0,00"
            required
            disabled={disabled}
          />
        </label>
      ) : (
        <label className="text-sm font-medium text-slate-700">
          Pourcentage
          <input
            name="percent_value"
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="3"
            required
            disabled={disabled}
          />
        </label>
      )}
      <div className="flex justify-end">
        <button
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={disabled}
        >
          Ajouter l&apos;assurance
        </button>
      </div>
    </form>
  );
}
