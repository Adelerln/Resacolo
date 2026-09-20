'use client';

import { useState } from 'react';
import { submitOrganizerCancellationAction } from '@/app/organisme/reservations/cancellation-actions';

type Props = {
  organizerId: string;
  orderId: string;
  onlinePaidCents: number;
  disabled?: boolean;
};

export function OrganizerCancellationForm({
  organizerId,
  orderId,
  onlinePaidCents,
  disabled
}: Props) {
  const [open, setOpen] = useState(false);
  const needsRefund = onlinePaidCents > 0;
  const defaultAmount = (onlinePaidCents / 100).toFixed(2);

  if (disabled) return null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          {needsRefund ? 'Demander un remboursement' : 'Annuler la réservation'}
        </button>
      ) : (
        <form action={submitOrganizerCancellationAction} className="space-y-2">
          <input type="hidden" name="organizer_id" value={organizerId} />
          <input type="hidden" name="order_id" value={orderId} />
          <p className="text-xs text-slate-600">
            {needsRefund
              ? 'Un paiement CB a déjà été encaissé : Mnemos devra valider le remboursement.'
              : 'Aucun paiement CB encaissé : l’annulation sera immédiate.'}
          </p>
          <textarea
            name="reason"
            required
            minLength={5}
            rows={3}
            placeholder="Motif écrit obligatoire"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {needsRefund ? (
            <input
              name="amount_euros"
              type="text"
              inputMode="decimal"
              defaultValue={defaultAmount}
              placeholder="Montant à rembourser (€)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          ) : null}
          <input
            name="attachment_path"
            type="text"
            placeholder="Chemin capture (optionnel, Storage)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Fermer
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
