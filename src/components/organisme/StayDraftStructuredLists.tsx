'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  draftSessionStableKey,
  formatDraftSessionShortLabel
} from '@/lib/draft-session-keys';
import { STAY_TRANSPORT_LOGISTICS_MODES } from '@/lib/stay-draft-content';

const DEFAULT_CURRENCY = 'EUR';
const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'CHF', label: 'CHF' }
] as const;

function normalizeDraftCurrency(value: unknown): string {
  const currency = value != null ? String(value).trim().toUpperCase() : '';
  return currency || DEFAULT_CURRENCY;
}

function CurrencySelect({
  value,
  onChange,
  className
}: {
  value: string;
  onChange: (next: string) => void;
  className: string;
}) {
  const normalizedValue = normalizeDraftCurrency(value);
  const knownOption = CURRENCY_OPTIONS.some((option) => option.value === normalizedValue);

  return (
    <select
      value={normalizedValue}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      {CURRENCY_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {!knownOption ? <option value={normalizedValue}>{normalizedValue}</option> : null}
    </select>
  );
}

function emptySessionRow(): {
  label: string;
  start_date: string;
  end_date: string;
  price: string;
  currency: string;
  availability: string;
} {
  return {
    label: '',
    start_date: '',
    end_date: '',
    price: '',
    currency: DEFAULT_CURRENCY,
    availability: ''
  };
}

type SessionRow = {
  label: string;
  start_date: string;
  end_date: string;
  price: string;
  currency: string;
  availability: string;
};

function sessionFromRecord(record: Record<string, unknown>): SessionRow {
  return {
    label: record.label != null ? String(record.label) : '',
    start_date: record.start_date != null ? String(record.start_date) : '',
    end_date: record.end_date != null ? String(record.end_date) : '',
    price:
      typeof record.price === 'number' && Number.isFinite(record.price)
        ? String(record.price)
        : record.price != null
          ? String(record.price)
          : '',
    currency: normalizeDraftCurrency(record.currency),
    availability: record.availability != null ? String(record.availability) : ''
  };
}

function sessionToRecord(row: SessionRow): Record<string, unknown> {
  const priceTrim = row.price.trim().replace(',', '.');
  const priceNum = priceTrim === '' ? null : Number(priceTrim);
  const availability = row.availability.trim();
  return {
    label: row.label.trim() || null,
    start_date: row.start_date.trim() || null,
    end_date: row.end_date.trim() || null,
    price: priceNum !== null && Number.isFinite(priceNum) ? priceNum : null,
    currency: normalizeDraftCurrency(row.currency),
    availability:
      availability === 'available' || availability === 'full' || availability === 'unknown'
        ? availability
        : null
  };
}

export function DraftSessionsEditor({
  value,
  onChange,
  error
}: {
  value: Array<Record<string, unknown>>;
  onChange: (next: Array<Record<string, unknown>>) => void;
  error?: string;
}) {
  const rows = value.map(sessionFromRecord);

  function updateRow(index: number, patch: Partial<SessionRow>) {
    const nextRows = [...rows];
    nextRows[index] = { ...nextRows[index], ...patch };
    onChange(nextRows.map(sessionToRecord));
  }

  function addRow() {
    onChange([...value, sessionToRecord(emptySessionRow())]);
  }

  function removeRow(index: number) {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">Sessions</p>
          <p className="text-xs text-slate-500">
            Dates, libellé, tarif indicatif et disponibilité pour chaque créneau.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une session
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune session — ajoutez-en une si nécessaire.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row, index) => (
            <li
              key={index}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Session {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
                  aria-label={`Supprimer la session ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-600">
                  Libellé
                  <input
                    value={row.label}
                    onChange={(e) => updateRow(index, { label: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Disponibilité
                  <select
                    value={row.availability}
                    onChange={(e) => updateRow(index, { availability: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    <option value="available">Places disponibles</option>
                    <option value="full">Complet</option>
                    <option value="unknown">Inconnu</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Date de début
                  <input
                    value={row.start_date}
                    onChange={(e) => updateRow(index, { start_date: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="ex. 2025-07-10"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Date de fin
                  <input
                    value={row.end_date}
                    onChange={(e) => updateRow(index, { end_date: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="ex. 2025-07-24"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Prix (nombre)
                  <input
                    value={row.price}
                    onChange={(e) => updateRow(index, { price: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    inputMode="decimal"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Devise
                  <CurrencySelect
                    value={row.currency}
                    onChange={(next) => updateRow(index, { currency: next })}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

type OptionRow = {
  label: string;
  price: string;
  currency: string;
  description: string;
};

function optionFromRecord(record: Record<string, unknown>): OptionRow {
  return {
    label: record.label != null ? String(record.label) : '',
    price:
      typeof record.price === 'number' && Number.isFinite(record.price)
        ? String(record.price)
        : record.price != null
          ? String(record.price)
          : '',
    currency: normalizeDraftCurrency(record.currency),
    description: record.description != null ? String(record.description) : ''
  };
}

function optionToRecord(row: OptionRow): Record<string, unknown> {
  const priceTrim = row.price.trim().replace(',', '.');
  const priceNum = priceTrim === '' ? null : Number(priceTrim);
  return {
    label: row.label.trim() || null,
    price: priceNum !== null && Number.isFinite(priceNum) ? priceNum : null,
    currency: normalizeDraftCurrency(row.currency),
    description: row.description.trim() || null
  };
}

function emptyOptionRow(): OptionRow {
  return { label: '', price: '', currency: DEFAULT_CURRENCY, description: '' };
}

/** Lignes transport : pas de champ description (édité à part des options supplémentaires). */
type TransportOptionRow = {
  label: string;
  price: string;
  currency: string;
  /** Clés `draftSessionStableKey` des sessions pour lesquelles la ville n’est pas proposée. */
  excluded_session_keys: string[];
};

function transportOptionFromRecord(record: Record<string, unknown>): TransportOptionRow {
  const rawEx = record.excluded_session_keys;
  const excluded_session_keys = Array.isArray(rawEx)
    ? rawEx.map((x) => String(x).trim()).filter(Boolean)
    : [];
  return {
    label: record.label != null ? String(record.label) : '',
    price:
      typeof record.price === 'number' && Number.isFinite(record.price)
        ? String(record.price)
        : record.price != null
          ? String(record.price)
          : '',
    currency: normalizeDraftCurrency(record.currency),
    excluded_session_keys
  };
}

function transportOptionToRecord(row: TransportOptionRow): Record<string, unknown> {
  const priceTrim = row.price.trim().replace(',', '.');
  const priceNum = priceTrim === '' ? null : Number(priceTrim);
  return {
    label: row.label.trim() || null,
    price: priceNum !== null && Number.isFinite(priceNum) ? priceNum : null,
    currency: normalizeDraftCurrency(row.currency),
    description: null,
    excluded_session_keys: row.excluded_session_keys.length > 0 ? row.excluded_session_keys : []
  };
}

function emptyTransportOptionRow(): TransportOptionRow {
  return { label: '', price: '', currency: DEFAULT_CURRENCY, excluded_session_keys: [] };
}

/** Ligne vide pour démarrer le bloc « options supplémentaires » depuis le formulaire brouillon. */
export function emptyDraftExtraOptionRecord(): Record<string, unknown> {
  return optionToRecord(emptyOptionRow());
}

export function DraftExtraOptionsEditor({
  value,
  onChange,
  error
}: {
  value: Array<Record<string, unknown>>;
  onChange: (next: Array<Record<string, unknown>>) => void;
  error?: string;
}) {
  const rows = value.map(optionFromRecord);

  function updateRow(index: number, patch: Partial<OptionRow>) {
    const nextRows = [...rows];
    nextRows[index] = { ...nextRows[index], ...patch };
    onChange(nextRows.map(optionToRecord));
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">Options supplémentaires</p>
          <p className="text-xs text-slate-500">Repas, matériel, activité payante, etc. (hors assurance)</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...value, optionToRecord(emptyOptionRow())])}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune option.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={index} className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      #{index + 1}
                    </span>
                    <label className="block min-w-0 flex-1 text-xs font-medium text-slate-600">
                      Libellé
                      <input
                        value={row.label}
                        onChange={(e) => updateRow(index, { label: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm leading-tight"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                    <label className="block text-xs font-medium text-slate-600">
                      Prix
                      <input
                        value={row.price}
                        onChange={(e) => updateRow(index, { price: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm leading-tight"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      Devise
                      <CurrencySelect
                        value={row.currency}
                        onChange={(next) => updateRow(index, { currency: next })}
                        className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm leading-tight"
                      />
                    </label>
                  </div>
                  <label className="block text-xs font-medium text-slate-600">
                    Description
                    <textarea
                      value={row.description}
                      onChange={(e) => updateRow(index, { description: e.target.value })}
                      rows={1}
                      className="mt-0.5 min-h-[2.25rem] w-full resize-y rounded border border-slate-200 px-2 py-1 text-sm leading-snug"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50"
                  aria-label={`Supprimer l’option ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

type InsurancePricingMode = 'FIXED' | 'PERCENT';

type InsuranceOptionRow = {
  label: string;
  pricing_mode: InsurancePricingMode;
  price: string;
  percent_value: string;
  currency: string;
};

function emptyInsuranceRow(): InsuranceOptionRow {
  return {
    label: '',
    pricing_mode: 'FIXED',
    price: '',
    percent_value: '',
    currency: DEFAULT_CURRENCY
  };
}

function insuranceFromRecord(record: Record<string, unknown>): InsuranceOptionRow {
  const modeRaw = String(record.pricing_mode ?? record.mode ?? '').toUpperCase();
  const hasPriceNumber = typeof record.price === 'number' && Number.isFinite(record.price);
  const hasPriceString =
    typeof record.price === 'string' && record.price.trim() !== '' && Number.isFinite(Number(record.price.trim().replace(',', '.')));
  const hasPercentNumber =
    typeof record.percent_value === 'number' ||
    (typeof record.percent === 'number' && Number.isFinite(record.percent));
  const hasPercentString =
    typeof record.percent_value === 'string' && record.percent_value.trim() !== '';

  let pricing_mode: InsurancePricingMode = 'FIXED';
  if (modeRaw === 'PERCENT') {
    pricing_mode = 'PERCENT';
  } else if (modeRaw === 'FIXED') {
    pricing_mode = 'FIXED';
  } else if ((hasPercentNumber || hasPercentString) && !hasPriceNumber && !hasPriceString) {
    pricing_mode = 'PERCENT';
  }

  const price =
    typeof record.price === 'number' && Number.isFinite(record.price)
      ? String(record.price)
      : record.price != null
        ? String(record.price)
        : '';
  const pv =
    typeof record.percent_value === 'number'
      ? String(record.percent_value)
      : typeof record.percent === 'number'
        ? String(record.percent)
        : record.percent_value != null
          ? String(record.percent_value)
          : '';

  return {
    label: record.label != null ? String(record.label) : '',
    pricing_mode,
    price,
    percent_value: pv,
    currency: normalizeDraftCurrency(record.currency)
  };
}

function insuranceToRecord(row: InsuranceOptionRow): Record<string, unknown> {
  const label = row.label.trim();
  const currency = normalizeDraftCurrency(row.currency);

  if (row.pricing_mode === 'PERCENT') {
    const pctTrim = row.percent_value.trim().replace(',', '.');
    const pctNum = pctTrim === '' ? null : Number(pctTrim);
    return {
      label: label || null,
      pricing_mode: 'PERCENT',
      percent_value: pctNum !== null && Number.isFinite(pctNum) ? pctNum : null,
      price: null,
      currency,
      description: null,
      option_kind: 'insurance'
    };
  }

  const priceTrim = row.price.trim().replace(',', '.');
  const priceNum = priceTrim === '' ? null : Number(priceTrim);
  return {
    label: label || null,
    pricing_mode: 'FIXED',
    price: priceNum !== null && Number.isFinite(priceNum) ? priceNum : null,
    percent_value: null,
    currency,
    description: null,
    option_kind: 'insurance'
  };
}

export function emptyDraftInsuranceOptionRecord(): Record<string, unknown> {
  return insuranceToRecord(emptyInsuranceRow());
}

export function DraftInsuranceOptionsEditor({
  value,
  onChange,
  error
}: {
  value: Array<Record<string, unknown>>;
  onChange: (next: Array<Record<string, unknown>>) => void;
  error?: string;
}) {
  const rows = value.map(insuranceFromRecord);

  function updateRow(index: number, patch: Partial<InsuranceOptionRow>) {
    const nextRows = [...rows];
    nextRows[index] = { ...nextRows[index], ...patch };
    if (patch.pricing_mode === 'FIXED') {
      nextRows[index].percent_value = '';
    }
    if (patch.pricing_mode === 'PERCENT') {
      nextRows[index].price = '';
    }
    onChange(nextRows.map(insuranceToRecord));
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">Assurance</p>
          <p className="text-xs text-slate-600">
            Montant fixe en euros ou pourcentage (nombre sans symbole % dans le champ).
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...value, insuranceToRecord(emptyInsuranceRow())])}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-amber-50/80"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune assurance renseignée.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={index} className="rounded-lg border border-amber-200/80 bg-white p-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-700/80">
                      #{index + 1}
                    </span>
                    <label className="block min-w-0 flex-1 text-xs font-medium text-slate-600">
                      Libellé
                      <input
                        value={row.label}
                        onChange={(e) => updateRow(index, { label: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm leading-tight"
                        placeholder="ex. Assurance annulation"
                      />
                    </label>
                  </div>
                  <label className="block w-full max-w-xs text-xs font-medium text-slate-600">
                    Type de tarif
                    <select
                      value={row.pricing_mode}
                      onChange={(e) =>
                        updateRow(index, {
                          pricing_mode: e.target.value === 'PERCENT' ? 'PERCENT' : 'FIXED'
                        })
                      }
                      className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    >
                      <option value="FIXED">Montant fixe (€)</option>
                      <option value="PERCENT">Pourcentage (%)</option>
                    </select>
                  </label>
                  {row.pricing_mode === 'FIXED' ? (
                    <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                      <label className="block text-xs font-medium text-slate-600">
                        Prix (€)
                        <input
                          value={row.price}
                          onChange={(e) => updateRow(index, { price: e.target.value })}
                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm leading-tight"
                          inputMode="decimal"
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">
                        Devise
                        <CurrencySelect
                          value={row.currency}
                          onChange={(next) => updateRow(index, { currency: next })}
                          className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm leading-tight"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="block max-w-xs text-xs font-medium text-slate-600">
                      Pourcentage (nombre, ex. 5 pour 5 %)
                      <input
                        value={row.percent_value}
                        onChange={(e) => updateRow(index, { percent_value: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm leading-tight"
                        inputMode="decimal"
                      />
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50"
                  aria-label={`Supprimer l’assurance ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export function DraftTransportOptionsEditor({
  value,
  onChange,
  error,
  sessionsJson = [],
  transportMode,
  onTransportModeChange,
  transportModeError
}: {
  value: Array<Record<string, unknown>>;
  onChange: (next: Array<Record<string, unknown>>) => void;
  error?: string;
  /** Sessions du brouillon : cases à cocher pour exclure une ville sur une session. */
  sessionsJson?: Array<Record<string, unknown>>;
  transportMode: string;
  onTransportModeChange: (value: string) => void;
  transportModeError?: string;
}) {
  const rows = value.map(transportOptionFromRecord);

  function updateRow(index: number, patch: Partial<TransportOptionRow>) {
    const nextRows = [...rows];
    nextRows[index] = { ...nextRows[index], ...patch };
    onChange(nextRows.map(transportOptionToRecord));
  }

  function setSessionExcluded(transportIndex: number, sessionKey: string, offered: boolean) {
    const row = rows[transportIndex];
    const nextExcluded = new Set(row.excluded_session_keys);
    if (offered) {
      nextExcluded.delete(sessionKey);
    } else {
      nextExcluded.add(sessionKey);
    }
    updateRow(transportIndex, { excluded_session_keys: Array.from(nextExcluded) });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <label className="block text-sm font-medium text-slate-700">
        Acheminement aller / retour
        <select
          value={transportMode}
          onChange={(event) => onTransportModeChange(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <option value="">À préciser</option>
          {STAY_TRANSPORT_LOGISTICS_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
        {transportModeError ? (
          <span className="mt-1 block text-xs text-rose-600">{transportModeError}</span>
        ) : null}
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">Options de transport</p>
          <p className="text-xs text-slate-500">
            Une ligne par ville (supplément aller ou retour). Si le séjour a plusieurs sessions, cochez les
            sessions pour lesquelles cette ville est proposée (par défaut : toutes).
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...value, transportOptionToRecord(emptyTransportOptionRow())])}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune option de transport.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={index} className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      #{index + 1}
                    </span>
                    <label className="block min-w-0 flex-1 text-xs font-medium text-slate-600">
                      Libellé
                      <input
                        value={row.label}
                        onChange={(e) => updateRow(index, { label: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm leading-tight"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                    <label className="block text-xs font-medium text-slate-600">
                      Prix
                      <input
                        value={row.price}
                        onChange={(e) => updateRow(index, { price: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm leading-tight"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      Devise
                      <CurrencySelect
                        value={row.currency}
                        onChange={(next) => updateRow(index, { currency: next })}
                        className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm leading-tight"
                      />
                    </label>
                  </div>
                  {sessionsJson.length > 0 ? (
                    <div className="space-y-1.5 border-t border-slate-100 pt-2">
                      <p className="text-[11px] font-medium text-slate-600">Proposer pour les sessions</p>
                      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
                        {sessionsJson.map((sess, si) => {
                          const sessionKey = draftSessionStableKey(sess, si);
                          const offered = !row.excluded_session_keys.includes(sessionKey);
                          return (
                            <li key={sessionKey}>
                              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-700">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 rounded border-slate-300"
                                  checked={offered}
                                  onChange={(e) =>
                                    setSessionExcluded(index, sessionKey, e.target.checked)
                                  }
                                />
                                <span>{formatDraftSessionShortLabel(sess)}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Ajoutez des sessions ci-dessus pour restreindre cette ville à certaines dates seulement.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50"
                  aria-label={`Supprimer l’option transport ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
