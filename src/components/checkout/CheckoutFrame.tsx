import clsx from 'clsx';
import Link from 'next/link';
import { isDevBypassCheckout } from '@/lib/checkout/dev-bypass';

const STEPS = [
  { key: 'informations', label: 'Informations' },
  { key: 'recapitulatif', label: 'Récapitulatif' },
  { key: 'paiement', label: 'Paiement' },
  { key: 'confirmation', label: 'Confirmation' }
] as const;

type CheckoutStepKey = (typeof STEPS)[number]['key'];

function getStepIndex(step: CheckoutStepKey) {
  const index = STEPS.findIndex((item) => item.key === step);
  return index === -1 ? 0 : index;
}

function hrefForCheckoutStep(key: CheckoutStepKey): string | null {
  switch (key) {
    case 'informations':
      return '/checkout/informations';
    case 'recapitulatif':
      return '/checkout/recapitulatif';
    case 'paiement':
      return '/checkout/paiement';
    case 'confirmation':
      return process.env.NODE_ENV === 'development' || isDevBypassCheckout()
        ? '/checkout/confirmation/dev-order?mode=dev-bypass'
        : null;
    default:
      return null;
  }
}

export function CheckoutFrame({
  step,
  title,
  subtitle,
  children,
  aside,
  headerClassName,
  headingClassName,
  contentClassName,
  asideClassName
}: {
  step: CheckoutStepKey;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  headerClassName?: string;
  /** Classes supplémentaires pour le titre principal (h1), ex. marge au-dessus. */
  headingClassName?: string;
  contentClassName?: string;
  asideClassName?: string;
}) {
  const stepIndex = getStepIndex(step);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header
        className={clsx(
          'mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6',
          headerClassName
        )}
      >
        <div className="flex flex-wrap gap-2">
          {STEPS.map((item, index) => {
            const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'upcoming';
            const pillClass = clsx(
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition',
              state === 'done' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              state === 'current' && 'border-brand-200 bg-brand-50 text-brand-700',
              state === 'upcoming' && 'border-slate-200 bg-slate-50 text-slate-500'
            );
            const href = hrefForCheckoutStep(item.key);
            const label = (
              <>
                {index + 1}. {item.label}
              </>
            );

            if (href) {
              return (
                <Link
                  key={item.key}
                  href={href}
                  className={clsx(
                    pillClass,
                    'cursor-pointer hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2'
                  )}
                  aria-current={state === 'current' ? 'step' : undefined}
                  prefetch={false}
                >
                  {label}
                </Link>
              );
            }

            return (
              <span key={item.key} className={pillClass} title="Disponible après le paiement">
                {label}
              </span>
            );
          })}
        </div>
        <h1
          className={clsx(
            'font-display text-2xl font-bold text-slate-900 sm:text-3xl',
            headingClassName ?? 'mt-4'
          )}
        >
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600 sm:text-base">{subtitle}</p> : null}
      </header>

      <div className={clsx('grid gap-6', aside ? 'lg:grid-cols-[minmax(0,1fr)_460px]' : 'grid-cols-1')}>
        <section
          className={clsx(
            'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6',
            contentClassName
          )}
        >
          {children}
        </section>
        {aside ? (
          <aside
            className={clsx(
              'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6',
              asideClassName
            )}
          >
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
