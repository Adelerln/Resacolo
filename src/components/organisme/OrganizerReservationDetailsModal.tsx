'use client';

import { Fragment, useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export type OrganizerReservationCoverageForm = {
  organizerId: string;
  orderId: string;
  requestKind: 'VACAF' | 'ANCV_CONNECT' | 'ANCV_PAPER';
  title?: string;
  referenceLabel: string;
  amountPlaceholder: string;
  submitLabel: string;
  currentAmountLabel?: string | null;
};

export type OrganizerReservationChildDetails = {
  firstName: string;
  lastName: string;
};

export type OrganizerReservationDetails = {
  id: string;
  reservationCode: string;
  clientName: string;
  participantName: string;
  parent1FirstName: string;
  parent1LastName: string;
  parent1Role: string;
  parent2FirstName: string;
  parent2LastName: string;
  parent2Role: string;
  hasParent2: boolean;
  children: OrganizerReservationChildDetails[];
  paymentModeLabel: string;
  /** CSE / collectivité de rattachement du client (null si famille directe). */
  collectivityName?: string | null;
  /** Matricule CAF / VACAF — null si non renseigné à la commande. */
  cafNumber: string | null;
  /** Matricule ANCV Connect — null si non demandé. */
  ancvConnectMatricule: string | null;
  ancvConnectRequestedAmountLabel: string | null;
  externalAidLabel: string | null;
  externalPaidLabel: string | null;
  email: string;
  primaryPhone: string;
  secondaryPhone: string;
  postalAddress: string;
  billingAddress: string;
  /** Formulaires de saisie CAF / ANCV (plusieurs possibles en cumul). */
  coverageForms?: OrganizerReservationCoverageForm[];
  /** @deprecated Prefer coverageForms — conservé pour compat. */
  coverageForm?: OrganizerReservationCoverageForm | null;
};

function DetailRow({
  label,
  value,
  compact = false
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  const display = value?.trim();
  const isEmpty = !display;
  return (
    <div
      className={`flex flex-col gap-0.5 ${
        compact ? 'py-2.5' : 'py-3.5 sm:flex-row sm:items-baseline sm:gap-x-8 sm:py-3'
      }`}
    >
      <dt className={`shrink-0 text-sm font-medium text-slate-600 ${compact ? '' : 'sm:w-44'}`}>
        {label}
      </dt>
      <dd
        className={`min-w-0 flex-1 text-sm leading-relaxed sm:text-[0.9375rem] ${
          isEmpty ? 'text-slate-400' : 'font-medium text-slate-900'
        }`}
      >
        {isEmpty ? <span className="font-normal italic">Non renseigné</span> : display}
      </dd>
    </div>
  );
}

function ParentCard({
  title,
  firstName,
  lastName,
  role,
  phone
}: {
  title: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
}) {
  const fullName = [firstName, lastName].filter((part) => part.trim()).join(' ').trim();
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-5">
      <h3 className="mb-1 text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
      <dl className="divide-y divide-slate-100">
        <DetailRow compact label="Prénom et nom" value={fullName} />
        <DetailRow compact label="Rôle" value={role} />
        <DetailRow compact label="Téléphone" value={phone} />
      </dl>
    </section>
  );
}

export default function OrganizerReservationDetailsModal({
  reservation,
  resolveAction,
  infoBadge = null,
  initialOpen = false
}: {
  reservation: OrganizerReservationDetails;
  resolveAction?: (formData: FormData) => void | Promise<void>;
  infoBadge?: 'CAF' | 'ANCV' | 'CAF_ANCV' | null;
  /** Rouvre le détail après un enregistrement CAF/ANCV pour saisir le second montant. */
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const coverageForms =
    reservation.coverageForms && reservation.coverageForms.length > 0
      ? reservation.coverageForms
      : reservation.coverageForm
        ? [reservation.coverageForm]
        : [];
  const needsCoverageAmount = coverageForms.length > 0 && Boolean(resolveAction);
  const pendingHints: string[] = [];
  if (needsCoverageAmount && infoBadge === 'CAF') pendingHints.push('CAF à saisir');
  if (needsCoverageAmount && infoBadge === 'ANCV') pendingHints.push('ANCV à saisir');
  if (needsCoverageAmount && infoBadge === 'CAF_ANCV') {
    pendingHints.push('CAF à saisir', 'ANCV à saisir');
  }

  const draftStorageKey = `resacolo:organizer-coverage-draft:${reservation.id}`;
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialOpen) return;
    setOpen(true);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('coverageOrderId')) {
        url.searchParams.delete('coverageOrderId');
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState({}, '', next);
      }
    } catch {
      // ignore
    }
  }, [initialOpen]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'string' && value.trim()) next[key] = value;
      }
      setAmountDrafts(next);
    } catch {
      // ignore invalid draft
    }
  }, [draftStorageKey]);

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

  function persistDrafts(next: Record<string, string>) {
    setAmountDrafts(next);
    try {
      const hasValues = Object.values(next).some((value) => value.trim());
      if (!hasValues) {
        sessionStorage.removeItem(draftStorageKey);
        return;
      }
      sessionStorage.setItem(draftStorageKey, JSON.stringify(next));
    } catch {
      // ignore quota / private mode
    }
  }

  function updateDraft(requestKind: string, value: string) {
    persistDrafts({ ...amountDrafts, [requestKind]: value });
  }

  function handleCoverageSubmit(submittedKind: string) {
    const next = { ...amountDrafts };
    delete next[submittedKind];
    persistDrafts(next);
  }

  return (
    <>
      <div className="inline-flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          Détails
        </button>
        {pendingHints.length > 0 ? (
          <div className="flex flex-col items-center gap-0.5">
            {pendingHints.map((hint) => (
              <span
                key={hint}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700"
              >
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                {hint}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`reservation-details-title-${reservation.id}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0 pr-2">
                <h2
                  id={`reservation-details-title-${reservation.id}`}
                  className="font-display text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
                >
                  Réservation {reservation.reservationCode}
                </h2>
                <p className="mt-1.5 truncate text-sm text-slate-500 sm:whitespace-normal sm:leading-snug">
                  {reservation.clientName}
                  <span className="text-slate-300"> · </span>
                  {reservation.participantName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-w-0 space-y-5 overflow-y-auto px-6 pb-6 pt-5">
              <div
                className={`grid gap-4 ${
                  reservation.hasParent2
                    ? 'sm:grid-cols-2'
                    : 'mx-auto w-full max-w-sm sm:max-w-md'
                }`}
              >
                <ParentCard
                  title="Parent 1"
                  firstName={reservation.parent1FirstName}
                  lastName={reservation.parent1LastName}
                  role={reservation.parent1Role}
                  phone={reservation.primaryPhone}
                />
                {reservation.hasParent2 ? (
                  <ParentCard
                    title="Parent 2"
                    firstName={reservation.parent2FirstName}
                    lastName={reservation.parent2LastName}
                    role={reservation.parent2Role}
                    phone={reservation.secondaryPhone}
                  />
                ) : null}
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold tracking-tight text-slate-900">
                  Détail de la commande
                </h3>
                <dl className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 px-4 sm:px-5">
                  <DetailRow label="Référence" value={reservation.reservationCode} />
                  <DetailRow label="Mode de paiement" value={reservation.paymentModeLabel} />
                  {reservation.collectivityName ? (
                    <DetailRow label="CSE de rattachement" value={reservation.collectivityName} />
                  ) : null}
                  {reservation.children.length === 0 ? (
                    <>
                      <DetailRow label="Prénom de l'enfant" value="" />
                      <DetailRow label="Nom de l'enfant" value="" />
                    </>
                  ) : (
                    reservation.children.map((child, index) => {
                      const suffix =
                        reservation.children.length > 1 ? ` ${index + 1}` : '';
                      return (
                        <Fragment key={`${child.firstName}-${child.lastName}-${index}`}>
                          <DetailRow
                            label={`Prénom de l'enfant${suffix}`}
                            value={child.firstName}
                          />
                          <DetailRow
                            label={`Nom de l'enfant${suffix}`}
                            value={child.lastName}
                          />
                        </Fragment>
                      );
                    })
                  )}
                  {reservation.cafNumber ? (
                    <DetailRow label="N° allocataire CAF" value={reservation.cafNumber} />
                  ) : null}
                  {reservation.ancvConnectMatricule ? (
                    <>
                      <DetailRow
                        label="Matricule ANCV Connect"
                        value={reservation.ancvConnectMatricule}
                      />
                      {reservation.ancvConnectRequestedAmountLabel ? (
                        <DetailRow
                          label="Montant ANCV demandé"
                          value={reservation.ancvConnectRequestedAmountLabel}
                        />
                      ) : null}
                    </>
                  ) : null}
                  {reservation.externalAidLabel ? (
                    <DetailRow label="Prise en charge CAF" value={reservation.externalAidLabel} />
                  ) : null}
                  {reservation.externalPaidLabel ? (
                    <DetailRow
                      label="Montant ANCV encaissé"
                      value={reservation.externalPaidLabel}
                    />
                  ) : null}
                  <DetailRow label="Adresse postale" value={reservation.postalAddress} />
                  {reservation.billingAddress !== reservation.postalAddress ? (
                    <DetailRow
                      label="Adresse de facturation"
                      value={reservation.billingAddress}
                    />
                  ) : null}
                  <DetailRow label="Mail" value={reservation.email} />
                </dl>
              </section>

              {coverageForms.length > 0 && resolveAction
                ? coverageForms.map((coverageForm) => (
                    <form
                      key={coverageForm.requestKind}
                      action={resolveAction}
                      onSubmit={() => handleCoverageSubmit(coverageForm.requestKind)}
                      className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
                    >
                      <input type="hidden" name="organizer_id" value={coverageForm.organizerId} />
                      <input type="hidden" name="order_id" value={coverageForm.orderId} />
                      <input type="hidden" name="request_kind" value={coverageForm.requestKind} />
                      <p className="text-sm font-semibold text-amber-950">
                        {coverageForm.title ??
                          (coverageForm.requestKind === 'VACAF'
                            ? 'Montant de prise en charge CAF'
                            : coverageForm.requestKind === 'ANCV_PAPER'
                              ? 'Montant ANCV papier reçu'
                              : 'Montant ANCV Connect reçu')}
                      </p>
                      <p className="text-xs text-amber-900/80">{coverageForm.referenceLabel}</p>
                      {coverageForm.currentAmountLabel ? (
                        <p className="text-xs text-amber-900">
                          Montant actuel : <strong>{coverageForm.currentAmountLabel}</strong>
                        </p>
                      ) : null}
                      <input
                        name="resolved_amount_euros"
                        type="text"
                        inputMode="decimal"
                        required
                        value={amountDrafts[coverageForm.requestKind] ?? ''}
                        onChange={(event) =>
                          updateDraft(coverageForm.requestKind, event.target.value)
                        }
                        placeholder={coverageForm.amountPlaceholder}
                        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        {coverageForm.submitLabel}
                      </button>
                    </form>
                  ))
                : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
