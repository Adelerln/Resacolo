import clsx from 'clsx';

const STEPS = [
  { key: 'informations', label: 'Informations' },
  { key: 'participants', label: 'Participants' },
  { key: 'recapitulatif', label: 'Récapitulatif' },
  { key: 'paiement', label: 'Paiement' },
  { key: 'confirmation', label: 'Confirmation' }
] as const;

type CheckoutStepKey = (typeof STEPS)[number]['key'];

function getStepIndex(step: CheckoutStepKey) {
  const index = STEPS.findIndex((item) => item.key === step);
  return index === -1 ? 0 : index;
}

export function CheckoutFrame({
  step,
  title,
  subtitle,
  children,
  aside
}: {
  step: CheckoutStepKey;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const stepIndex = getStepIndex(step);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap gap-2">
          {STEPS.map((item, index) => {
            const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'upcoming';
            return (
              <span
                key={item.key}
                className={clsx(
                  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                  state === 'done' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  state === 'current' && 'border-brand-200 bg-brand-50 text-brand-700',
                  state === 'upcoming' && 'border-slate-200 bg-slate-50 text-slate-500'
                )}
              >
                {index + 1}. {item.label}
              </span>
            );
          })}
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600 sm:text-base">{subtitle}</p> : null}
      </header>

      <div className={clsx('grid gap-6', aside ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-1')}>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</section>
        {aside ? <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{aside}</aside> : null}
      </div>
    </div>
  );
}
