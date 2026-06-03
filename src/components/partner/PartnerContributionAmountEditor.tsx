'use client';

import { useState } from 'react';

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

type PartnerContributionAmountEditorProps = {
  orderId: string;
  beneficiaryName: string;
  partnerContributionCents: number;
  saveAction: (formData: FormData) => void | Promise<void>;
};

export function PartnerContributionAmountEditor({
  orderId,
  beneficiaryName,
  partnerContributionCents,
  saveAction
}: PartnerContributionAmountEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [partnerMessage, setPartnerMessage] = useState('');
  const displayLabel = formatCurrencyFromCents(partnerContributionCents);
  const defaultEuros =
    partnerContributionCents > 0
      ? (partnerContributionCents / 100).toFixed(2)
      : '';

  if (isEditing) {
    return (
      <form action={saveAction} className="flex min-w-[200px] flex-col gap-2">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="partner_message" value={partnerMessage} />
        <input
          type="number"
          name="manual_partner_euros"
          min="0"
          step="0.01"
          defaultValue={defaultEuros}
          autoFocus
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          placeholder="Montant partenaire (€)"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (!form) return;

              const wantsMessage = window.confirm(
                `Voulez-vous ajouter un message visible par ${beneficiaryName || 'le client'} dans son compte ?`
              );

              if (!wantsMessage) {
                setPartnerMessage('');
                form.requestSubmit();
                return;
              }

              const nextMessage = window.prompt(
                'Message visible dans le compte client :',
                partnerMessage || 'Bonjour, votre reste à régler a été mis à jour suite à la révision de la prise en charge partenaire.'
              );

              if (nextMessage === null) {
                return;
              }

              setPartnerMessage(nextMessage.trim());
              window.requestAnimationFrame(() => form.requestSubmit());
            }}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => {
              setPartnerMessage('');
              setIsEditing(false);
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group relative max-w-full text-left font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1"
      aria-label={`Part partenaire : ${displayLabel}. Modifier le montant.`}
    >
      <span className="underline-offset-2 transition group-hover:underline">{displayLabel}</span>
      <span
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
        role="tooltip"
      >
        Modifier montant
      </span>
    </button>
  );
}
