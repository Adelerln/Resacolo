'use client';

import { useEffect, useState } from 'react';
import AccommodationTypeField from '@/components/organisme/AccommodationTypeField';
import { parseAccommodationType, type AccommodationTypeOption } from '@/components/organisme/accommodation-type';
import GoogleMapsCityInput from '@/components/common/GoogleMapsCityInput';
import {
  isItinerantAccommodationType,
  resolveAccommodationLocationMode,
  stripStockPmrPhraseFromAccessibility,
  type AccommodationLocationMode
} from '@/lib/accommodation-location';

export {
  ACCOMMODATION_TYPE_OPTIONS,
  formatAccommodationType
} from '@/components/organisme/accommodation-type';

type AccommodationFormValues = {
  name?: string | null;
  accommodation_type?: string | null;
  location_mode?: string | null;
  itinerant_zone?: string | null;
  description?: string | null;
  bed_info?: string | null;
  bathroom_info?: string | null;
  catering_info?: string | null;
  accessibility_info?: string | null;
  address_text?: string | null;
  postal_code?: string | null;
  city?: string | null;
  department_code?: string | null;
  region_text?: string | null;
  country?: string | null;
  center_latitude?: number | string | null;
  center_longitude?: number | string | null;
  media_urls?: string[] | null;
  map_iframe_html?: string | null;
};

type AccommodationFormFieldsProps = {
  values?: AccommodationFormValues;
  submitLabel: string;
};

const LOCATION_MODE_OPTIONS: Array<{ value: Exclude<AccommodationLocationMode, 'itinerant'>; label: string }> = [
  { value: 'france', label: 'Lieu fixe en France' },
  { value: 'abroad', label: "Lieu fixe à l'étranger" }
];

function buildPhysicalAddressState(values: AccommodationFormValues) {
  return {
    address_text: values.address_text ?? '',
    postal_code: values.postal_code ?? '',
    city: values.city ?? '',
    department_code: values.department_code ?? '',
    region_text: values.region_text ?? '',
    country: values.country ?? ''
  };
}

function resolveInitialLocationMode(values: AccommodationFormValues): AccommodationLocationMode | '' {
  return (
    resolveAccommodationLocationMode({
      accommodationType: values.accommodation_type,
      locationMode: values.location_mode,
      country: values.country,
      city: values.city,
      addressText: values.address_text
    }) ?? ''
  );
}

export default function AccommodationFormFields({
  values = {},
  submitLabel
}: AccommodationFormFieldsProps) {
  const [accommodationType, setAccommodationType] = useState<AccommodationTypeOption | ''>(
    () => parseAccommodationType(values.accommodation_type ?? '').baseType ?? ''
  );
  const isItinerantType = isItinerantAccommodationType(accommodationType);
  const [locationMode, setLocationMode] = useState<AccommodationLocationMode | ''>(() =>
    resolveInitialLocationMode(values)
  );
  const [itinerantZone, setItinerantZone] = useState(
    () => values.itinerant_zone ?? (resolveInitialLocationMode(values) === 'itinerant' ? values.region_text ?? '' : '')
  );
  const [physicalAddress, setPhysicalAddress] = useState(() => buildPhysicalAddressState(values));

  useEffect(() => {
    setPhysicalAddress(buildPhysicalAddressState(values));
    setItinerantZone(
      values.itinerant_zone ??
        (resolveInitialLocationMode(values) === 'itinerant' ? values.region_text ?? '' : '')
    );
    setLocationMode(resolveInitialLocationMode(values));
    setAccommodationType(parseAccommodationType(values.accommodation_type ?? '').baseType ?? '');
  }, [
    values.accommodation_type,
    values.location_mode,
    values.itinerant_zone,
    values.address_text,
    values.postal_code,
    values.city,
    values.department_code,
    values.region_text,
    values.country
  ]);

  function handleTypeChange(nextType: AccommodationTypeOption | '') {
    setAccommodationType(nextType);
    if (nextType === 'mixte') {
      setLocationMode('itinerant');
      setPhysicalAddress((current) => ({
        ...current,
        address_text: '',
        postal_code: '',
        department_code: '',
        region_text: ''
      }));
      return;
    }

    if (locationMode === 'itinerant') {
      setLocationMode('france');
      setItinerantZone('');
      setPhysicalAddress((current) => ({
        ...current,
        country: current.country || 'France'
      }));
    }
  }

  function handleLocationModeChange(nextMode: Exclude<AccommodationLocationMode, 'itinerant'>) {
    setLocationMode(nextMode);
    setItinerantZone('');
    if (nextMode === 'france') {
      setPhysicalAddress((current) => ({
        ...current,
        country: 'France'
      }));
      return;
    }

    setPhysicalAddress((current) => ({
      ...current,
      address_text: '',
      postal_code: '',
      department_code: '',
      region_text: '',
      country: current.country === 'France' ? '' : current.country
    }));
  }

  const effectiveLocationMode: AccommodationLocationMode | '' = isItinerantType ? 'itinerant' : locationMode;

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
        <AccommodationTypeField
          defaultValue={values.accommodation_type ?? ''}
          onTypeChange={handleTypeChange}
        />
      </div>

      <div className="rounded-xl border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Localisation</h3>
        <p className="mt-2 text-sm text-slate-500">
          {isItinerantType
            ? 'Circuit itinérant : décrivez la zone parcourue et le pays (France ou étranger), sans adresse postale.'
            : 'Lieu fixe : renseignez une adresse en France ou une ville à l’étranger.'}
        </p>

        <input type="hidden" name="location_mode" value={effectiveLocationMode} />

        {!isItinerantType ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {LOCATION_MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name="location_mode_choice"
                  value={option.value}
                  checked={locationMode === option.value}
                  onChange={() => handleLocationModeChange(option.value)}
                  className="h-4 w-4 border-slate-300 text-emerald-600"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {effectiveLocationMode === 'itinerant' ? (
            <>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Libellé du circuit
                <input
                  name="itinerant_zone"
                  value={itinerantZone}
                  onChange={(event) => setItinerantZone(event.target.value)}
                  placeholder="Ex. Tour de Bretagne ou Circuit Guatemala–Honduras"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Pays du circuit
                <input
                  name="country"
                  value={physicalAddress.country}
                  onChange={(event) =>
                    setPhysicalAddress((current) => ({ ...current, country: event.target.value }))
                  }
                  placeholder="Ex. France, Guatemala, Espagne"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Ville de référence (optionnel)
                <input
                  name="city"
                  value={physicalAddress.city}
                  onChange={(event) =>
                    setPhysicalAddress((current) => ({ ...current, city: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </>
          ) : null}

          {effectiveLocationMode === 'france' ? (
            <>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Adresse
                <input
                  name="address_text"
                  value={physicalAddress.address_text}
                  onChange={(event) =>
                    setPhysicalAddress((current) => ({ ...current, address_text: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Code postal
                <input
                  name="postal_code"
                  value={physicalAddress.postal_code}
                  onChange={(event) =>
                    setPhysicalAddress((current) => ({ ...current, postal_code: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <GoogleMapsCityInput
                name="city"
                label="Ville"
                value={physicalAddress.city}
                onValueChange={(nextCity) =>
                  setPhysicalAddress((current) => ({ ...current, city: nextCity }))
                }
                onCitySelect={(selection) =>
                  setPhysicalAddress((current) => ({
                    ...current,
                    city: selection.city,
                    postal_code: selection.postalCode ?? current.postal_code,
                    department_code: selection.department ?? current.department_code,
                    region_text: selection.region ?? current.region_text,
                    country: selection.country ?? 'France'
                  }))
                }
                className="block text-sm font-medium text-slate-700"
              />
              <label className="block text-sm font-medium text-slate-700">
                Département
                <input
                  name="department_code"
                  value={physicalAddress.department_code}
                  onChange={(event) =>
                    setPhysicalAddress((current) => ({ ...current, department_code: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Région
                <input
                  name="region_text"
                  value={physicalAddress.region_text}
                  onChange={(event) =>
                    setPhysicalAddress((current) => ({ ...current, region_text: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Pays
                <input
                  name="country"
                  value={physicalAddress.country || 'France'}
                  onChange={(event) =>
                    setPhysicalAddress((current) => ({ ...current, country: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  readOnly
                />
              </label>
            </>
          ) : null}

          {effectiveLocationMode === 'abroad' ? (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Ville
                <input
                  name="city"
                  value={physicalAddress.city}
                  onChange={(event) =>
                    setPhysicalAddress((current) => ({ ...current, city: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Pays
                <input
                  name="country"
                  value={physicalAddress.country}
                  onChange={(event) =>
                    setPhysicalAddress((current) => ({ ...current, country: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  required
                />
              </label>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Coordonnées du centre (interne)</h3>
        <p className="mt-2 text-sm text-slate-500">
          Coordonnées exactes stockées en interne ; affichage public approximatif sur la carte.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Latitude
            <input
              name="center_latitude"
              defaultValue={values.center_latitude ?? ''}
              placeholder="Ex. 46.2276"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Longitude
            <input
              name="center_longitude"
              defaultValue={values.center_longitude ?? ''}
              placeholder="Ex. 2.2137"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
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
        <h3 className="text-sm font-semibold text-slate-900">Carte Google Maps (iframe)</h3>
        <p className="mt-2 text-sm text-slate-500">
          Collez le code iframe Google Maps (ou l&apos;URL embed) pour afficher la carte de ce lieu.
        </p>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Code iframe
          <textarea
            name="map_iframe_html"
            rows={4}
            defaultValue={values.map_iframe_html ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            placeholder={'<iframe src="https://www.google.com/maps/d/u/2/embed?mid=..." width="640" height="480"></iframe>'}
          />
        </label>
      </div>

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
          Renseigne une URL d&apos;image par ligne pour alimenter le carrousel public de l&apos;hébergement.
          <br />
          <strong>Attention, merci de revenir à la ligne entre chaque URL</strong>
        </p>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          URLs des photos
          <textarea
            name="media_urls"
            rows={5}
            defaultValue={(values.media_urls ?? []).join('\n')}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder={'https://...\nhttps://...'}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          {submitLabel}
        </button>
      </div>
    </>
  );
}
