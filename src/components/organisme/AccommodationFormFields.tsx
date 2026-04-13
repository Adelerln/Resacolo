import AccommodationTypeField from '@/components/organisme/AccommodationTypeField';
export {
  ACCOMMODATION_TYPE_OPTIONS,
  formatAccommodationType
} from '@/components/organisme/accommodation-type';

type AccommodationFormValues = {
  name?: string | null;
  accommodation_type?: string | null;
  description?: string | null;
  bed_info?: string | null;
  bathroom_info?: string | null;
  catering_info?: string | null;
  accessibility_info?: string | null;
};

type AccommodationFormFieldsProps = {
  values?: AccommodationFormValues;
  submitLabel: string;
};

export default function AccommodationFormFields({
  values = {},
  submitLabel
}: AccommodationFormFieldsProps) {
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
        <AccommodationTypeField defaultValue={values.accommodation_type ?? ''} />
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
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Informations accessibilité
          <textarea
            name="accessibility_info"
            rows={3}
            defaultValue={values.accessibility_info ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Cette rubrique sert à mentionner si le lieu d&apos;hébergement est accessible aux
            personnes à mobilité réduite (PMR)
          </span>
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
