'use client';

import { ACCOMMODATION_TYPE_OPTIONS, formatAccommodationType } from '@/lib/accommodation-types';
import type { AccommodationLocationMode } from '@/lib/accommodation-location';
import {
  defaultAccommodationImportRecord,
  mergeAccommodationImportRecord
} from '@/lib/stay-draft-accommodation-import';
import { draftReviewControlClass } from '@/lib/draft-review-field-styles';
import { cn } from '@/lib/utils';

type Props = {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  fieldError?: string | null;
  /** Classes du champ « Nom de l'hébergement » (tunnel review). */
  nameInputClassName?: string;
};

export default function AccommodationImportReviewFields({
  value,
  onChange,
  fieldError,
  nameInputClassName
}: Props) {
  const draft = mergeAccommodationImportRecord(defaultAccommodationImportRecord(), value);

  function patch(partial: Record<string, unknown>) {
    onChange(mergeAccommodationImportRecord(defaultAccommodationImportRecord(), { ...value, ...partial }));
  }

  const types = Array.isArray(draft.accommodation_types)
    ? (draft.accommodation_types as string[]).filter((t) => typeof t === 'string')
    : [];

  function toggleType(option: (typeof ACCOMMODATION_TYPE_OPTIONS)[number]) {
    const next = types.includes(option) ? types.filter((t) => t !== option) : [...types, option];
    patch({ accommodation_types: next });
  }

  const locationMode = (draft.location_mode as AccommodationLocationMode | null) || '';

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Hébergement</p>
      <h2 className="mt-2 font-display text-xl font-bold text-slate-900 sm:text-2xl">
        Relecture de l&apos;hébergement importé
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Validez ou corrigez ici les informations récupérées pour l&apos;hébergement avant la publication live.
      </p>

      <div className="mt-6 space-y-5">
        <label className="block text-sm font-medium text-slate-700">
          Nom de l&apos;hébergement
          <input
            className={
              nameInputClassName ??
              draftReviewControlClass({
                required: true,
                filled: Boolean(String(draft.title ?? '').trim()),
                hasError: Boolean(fieldError)
              })
            }
            value={String(draft.title ?? '')}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>

        <div>
          <p className="text-sm font-medium text-slate-700">Type d&apos;hébergement</p>
          <p className="mt-1 text-xs text-slate-500">
            Plusieurs cases pour un circuit ou une structure mixte (sera enregistré comme « mixte » si plusieurs
            types).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ACCOMMODATION_TYPE_OPTIONS.map((option) => (
              <label
                key={option}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  types.includes(option)
                    ? 'border-amber-400 bg-amber-100 text-amber-950'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={types.includes(option)}
                  onChange={() => toggleType(option)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {formatAccommodationType(option)}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Lieu affiché</h3>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Type de lieu
            <select
              className={draftReviewControlClass({
                required: false,
                filled: Boolean(locationMode)
              })}
              value={locationMode}
              onChange={(e) =>
                patch({
                  location_mode: e.target.value ? (e.target.value as AccommodationLocationMode) : null
                })
              }
            >
              <option value="">Non renseigné</option>
              <option value="france">Ville en France (+ département)</option>
              <option value="abroad">Ville à l&apos;étranger (+ pays)</option>
              <option value="itinerant">Circuit / zone itinérante</option>
            </select>
          </label>

          {locationMode === 'france' ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Ville
                <input
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(String(draft.location_city ?? '').trim())
                  })}
                  value={String(draft.location_city ?? '')}
                  onChange={(e) => patch({ location_city: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Numéro de département
                <input
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(String(draft.location_department_code ?? '').trim())
                  })}
                  placeholder="Ex. 85"
                  value={String(draft.location_department_code ?? '')}
                  maxLength={2}
                  onChange={(e) => patch({ location_department_code: e.target.value.slice(0, 2) })}
                />
              </label>
            </div>
          ) : null}

          {locationMode === 'abroad' ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Ville
                <input
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(String(draft.location_city ?? '').trim())
                  })}
                  value={String(draft.location_city ?? '')}
                  onChange={(e) => patch({ location_city: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Pays
                <input
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(String(draft.location_country ?? '').trim())
                  })}
                  value={String(draft.location_country ?? '')}
                  onChange={(e) => patch({ location_country: e.target.value })}
                />
              </label>
            </div>
          ) : null}

          {locationMode === 'itinerant' ? (
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Zone ou itinéraire
              <input
                className={draftReviewControlClass({
                  required: false,
                  filled: Boolean(String(draft.itinerant_zone ?? '').trim())
                })}
                value={String(draft.itinerant_zone ?? '')}
                onChange={(e) => patch({ itinerant_zone: e.target.value })}
              />
            </label>
          ) : null}
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Description (lieu, région, infrastructures — pas couchage / sanitaires / repas / PMR)
          <textarea
            className={cn(
              draftReviewControlClass({
                required: false,
                filled: Boolean(String(draft.description ?? '').trim())
              }),
              'min-h-[7rem]'
            )}
            rows={5}
            value={String(draft.description ?? '')}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Couchage / informations couchage
          <textarea
            className={cn(
              draftReviewControlClass({
                required: false,
                filled: Boolean(String(draft.bed_info ?? '').trim())
              }),
              'min-h-[5rem]'
            )}
            rows={3}
            value={String(draft.bed_info ?? '')}
            onChange={(e) => patch({ bed_info: e.target.value })}
            placeholder="Ex. Les chambres comportent entre 2 et 6 lits."
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Sanitaires
          <textarea
            className={cn(
              draftReviewControlClass({
                required: false,
                filled: Boolean(String(draft.bathroom_info ?? '').trim())
              }),
              'min-h-[5rem]'
            )}
            rows={3}
            value={String(draft.bathroom_info ?? '')}
            onChange={(e) => patch({ bathroom_info: e.target.value })}
            placeholder="Ex. Sanitaires privatifs dans les chambres."
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Restauration
          <textarea
            className={cn(
              draftReviewControlClass({
                required: false,
                filled: Boolean(String(draft.catering_info ?? '').trim())
              }),
              'min-h-[5rem]'
            )}
            rows={3}
            value={String(draft.catering_info ?? '')}
            onChange={(e) => patch({ catering_info: e.target.value })}
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={draft.pmr_accessible === true}
              onChange={(e) => patch({ pmr_accessible: e.target.checked })}
            />
            <span>
              Établissement repéré comme accessible aux personnes à mobilité réduite (PMR)
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Cochez uniquement si l&apos;information est avérée dans la source importée.
              </span>
            </span>
          </label>
        </div>
      </div>

      {fieldError ? <p className="mt-3 text-xs text-rose-600">{fieldError}</p> : null}
    </section>
  );
}
