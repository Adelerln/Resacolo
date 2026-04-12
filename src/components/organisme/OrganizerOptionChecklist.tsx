import Image from 'next/image';

type OrganizerOptionChecklistProps = {
  name: string;
  title: string;
  description?: string;
  options: Array<{
    key: string;
    label: string;
    iconPath: string;
  }>;
  selectedValues?: string[];
  columnsClassName?: string;
};

export default function OrganizerOptionChecklist({
  name,
  title,
  description,
  options,
  selectedValues = [],
  columnsClassName = 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
}: OrganizerOptionChecklistProps) {
  const selected = new Set(selectedValues);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className={columnsClassName}>
        {options.map((option) => {
          const checked = selected.has(option.key);
          return (
            <label
              key={option.key}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition ${
                checked
                  ? 'border-[#6DC7FE] bg-[#eef8ff]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                name={name}
                value={option.key}
                defaultChecked={checked}
                className="h-4 w-4 rounded border-slate-300 text-[#6DC7FE] focus:ring-[#6DC7FE]"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
                <Image src={option.iconPath} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
              </div>
              <span className="text-sm font-medium leading-5 text-slate-700">{option.label}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
