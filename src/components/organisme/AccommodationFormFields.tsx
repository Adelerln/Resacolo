'use client';

import { useState } from 'react';
import GoogleMapsCityInput from '@/components/common/GoogleMapsCityInput';
import {
  stripStockPmrPhraseFromAccessibility,
  type AccommodationLocationMode
} from '@/lib/accommodation-location';
import { ACCOMMODATION_TYPE_OPTIONS, formatAccommodationType } from '@/lib/accommodation-types';

export { ACCOMMODATION_TYPE_OPTIONS, formatAccommodationType };

type AccommodationFormValues = {
  name?: string | null;
  accommodation_type?: string | null;
  description?: string | null;
  bed_info?: string | null;
  bathroom_info?: string | null;
  catering_info?: string | null;
  accessibility_info?: string | null;
  location_mode?: AccommodationLocationMode | null;
  location_city?: string | null;
  location_department_code?: string | null;
  location_country?: string | null;
  itinerant_zone?: string | null;
};

type AccommodationFormFieldsProps = {
  values?: AccommodationFormValues;
  submitLabel: string;
};

export default function AccommodationFormFields({
  values = {},
  submitLabel
}: AccommodationFormFieldsProps) {
  const [locationMode, setLocationMode] = useState<AccommodationLocationMode | ''>(values.location_mode ?? '');

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Nom de l&apos;hébergement
          <input
            name="name"
            defaultValue={values.name ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Type d&apos;hébergement
          <select
            name="accommodation_type"
            defaultValue={values.accommodation_type ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          >
            <option value="">Sélectionner</option>
            {ACCOMMODATION_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatAccommodationType(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Lieu affiché</h3>
        <p className="mt-2 text-sm text-slate-500">
          Format public attendu : ville avec département, ville avec pays, ou circuit itinérant.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Type de lieu
            <select
              name="location_mode"
              value={locationMode}
              onChange={(event) => setLocationMode(event.target.value as AccommodationLocationMode | '')}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">Aucun lieu affiché</option>
              <option value="france">Ville en France</option>
              <option value="abroad">Ville à l&apos;étranger</option>
              <option value="itinerant">Circuit itinérant</option>
            </select>
          </label>

          {locationMode === 'france' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <GoogleMapsCityInput
                name="location_city"
                label="Ville"
                defaultValue={values.location_city ?? ''}
                className="block text-sm font-medium text-slate-700"
              />
              <label className="block text-sm font-medium text-slate-700">
                Numéro de département
                <input
                  name="location_department_code"
                  defaultValue={values.location_department_code ?? ''}
                  placeholder="Ex. 74"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
          ) : null}

          {locationMode === 'abroad' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Ville
                <input
                  name="location_city"
                  defaultValue={values.location_city ?? ''}
                  placeholder="Ex. Barcelone"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Pays
                <input
                  name="location_country"
                  defaultValue={values.location_country ?? ''}
                  placeholder="Ex. Espagne"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
          ) : null}

          {locationMode === 'itinerant' ? (
            <label className="block text-sm font-medium text-slate-700">
              Zone ou itinéraire
              <input
                name="itinerant_zone"
                defaultValue={values.itinerant_zone ?? ''}
                placeholder="Ex. Bretagne sud"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          ) : null}
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Description
        <textarea
          name="description"
          rows={3}
          defaultValue={values.description ?? ''}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      <div className="rounded-xl border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Couchage</h3>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Informations couchage
          <textarea
            name="bed_info"
            rows={3}
            defaultValue={values.bed_info ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Sanitaires</h3>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Sanitaires
          <textarea
            name="bathroom_info"
            rows={3}
            defaultValue={values.bathroom_info ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Restauration</h3>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Informations restauration
          <textarea
            name="catering_info"
            rows={3}
            defaultValue={values.catering_info ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Accessibilité</h3>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            name="pmr_accessible"
            defaultChecked={Boolean(
              values.accessibility_info &&
                /mobilité réduite|PMR/i.test(values.accessibility_info) &&
                /Repéré comme accessible/i.test(values.accessibility_info)
            )}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <span>Établissement repéré comme accessible aux personnes à mobilité réduite (PMR)</span>
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Précisions (optionnel)
          <textarea
            name="accessibility_extra"
            rows={3}
            defaultValue={stripStockPmrPhraseFromAccessibility(values.accessibility_info ?? '')}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Ascenseur, chambre adaptée, plain-pied, etc."
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Médias</h3>
        <p className="mt-2 text-sm text-slate-500">
          Les photos seront rattachées à la fiche une fois l&apos;hébergement créé.
        </p>
      </div>

      <div className="flex justify-end">
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          {submitLabel}
        </button>
      </div>
    </>
  );
}
