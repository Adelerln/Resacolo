'use client';

import { useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { X } from 'lucide-react';
import { submitOrganizerCancellationAction } from '@/app/organisme/reservations/cancellation-actions';

type Props = {
  organizerId: string;
  orderId: string;
  onlinePaidCents: number;
  disabled?: boolean;
  /** Version compacte pour les lignes de tableau. */
  compact?: boolean;
};

const ACCEPTED_ATTACHMENT_TYPES = 'image/png,image/jpeg,application/pdf';
const ACCEPTED_EXTENSIONS_HINT = 'PNG, JPEG ou PDF';

function SubmitButtons({ onClose }: { onClose: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onClose}
        disabled={pending}
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        Fermer
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
      >
        {pending ? 'Envoi…' : 'Confirmer'}
      </button>
    </div>
  );
}

export function OrganizerCancellationForm({
  organizerId,
  orderId,
  onlinePaidCents,
  disabled,
  compact = false
}: Props) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const titleId = useId();
  const needsRefund = onlinePaidCents > 0;
  const defaultAmount = (onlinePaidCents / 100).toFixed(2);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (disabled) return null;

  const dialogTitle = needsRefund ? 'Demander un remboursement' : 'Annuler la réservation';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFileName(null);
          setFileError(null);
          setOpen(true);
        }}
        className={
          compact
            ? 'text-xs font-medium text-rose-600 transition hover:text-rose-800 hover:underline'
            : 'rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50'
        }
      >
        {needsRefund ? 'Remboursement' : compact ? 'Annuler' : 'Annuler la réservation'}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 px-6 py-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mx-auto max-w-md px-8 text-center">
                <h2
                  id={titleId}
                  className="font-display text-lg font-semibold tracking-tight text-slate-900"
                >
                  {dialogTitle}
                </h2>
                <p className="mt-1.5 text-sm leading-snug text-slate-500">
                  {needsRefund
                    ? 'Un paiement CB a déjà été encaissé. La demande de remboursement sera soumise au contrôle de Mnemos.'
                    : 'La demande d’annulation sera soumise au contrôle de Mnemos avant d’être effective.'}
                </p>
              </div>
            </div>

            <form
              action={submitOrganizerCancellationAction}
              className="space-y-4 px-6 py-5"
              onSubmit={(event) => {
                setFileError(null);
                const fileInput = event.currentTarget.elements.namedItem('attachment');
                const file =
                  fileInput instanceof HTMLInputElement ? fileInput.files?.[0] ?? null : null;
                if (!file || file.size === 0) return;

                const okType =
                  file.type === 'image/png' ||
                  file.type === 'image/jpeg' ||
                  file.type === 'application/pdf' ||
                  /\.(png|jpe?g|pdf)$/i.test(file.name);
                if (!okType) {
                  event.preventDefault();
                  setFileError(`Format non accepté. Chargez un fichier ${ACCEPTED_EXTENSIONS_HINT}.`);
                  return;
                }
                if (file.size > 8 * 1024 * 1024) {
                  event.preventDefault();
                  setFileError('Fichier trop volumineux (max. 8 Mo).');
                }
              }}
            >
              <input type="hidden" name="organizer_id" value={organizerId} />
              <input type="hidden" name="order_id" value={orderId} />

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Motif</span>
                <textarea
                  name="reason"
                  required
                  minLength={5}
                  rows={4}
                  placeholder="Motif écrit obligatoire"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              {needsRefund ? (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Montant à rembourser (€)</span>
                  <input
                    name="amount_euros"
                    type="text"
                    inputMode="decimal"
                    defaultValue={defaultAmount}
                    placeholder="Montant à rembourser (€)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              ) : null}

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Capture d’écran (optionnel)</span>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-slate-400 hover:bg-slate-100">
                  <span className="text-sm font-medium text-slate-700">
                    {fileName ? fileName : 'Choisir un fichier'}
                  </span>
                  <span className="text-xs text-slate-500">{ACCEPTED_EXTENSIONS_HINT} · max. 8 Mo</span>
                  <input
                    name="attachment"
                    type="file"
                    accept={ACCEPTED_ATTACHMENT_TYPES}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setFileName(file?.name ?? null);
                      setFileError(null);
                    }}
                  />
                </label>
                {fileError ? <p className="text-xs text-rose-600">{fileError}</p> : null}
              </div>

              <SubmitButtons onClose={() => setOpen(false)} />
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
