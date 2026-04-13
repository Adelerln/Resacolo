import type { CartItem } from '@/types/cart';
import { formatEuroFromCents, type CheckoutPricing } from '@/types/checkout';

function formatUnitPrice(value: number | null) {
  if (value == null) return 'Sur demande';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return null;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;

  return `du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`;
}

export function CheckoutCartSummary({
  items,
  pricing,
  variant = 'compact',
  renderItemExtra
}: {
  items: CartItem[];
  pricing?: CheckoutPricing | null;
  variant?: 'compact' | 'detailed';
  renderItemExtra?: (item: CartItem, index: number) => React.ReactNode;
}) {
  const byId = new Map((pricing?.items ?? []).map((item) => [item.cartItemId, item]));
  const fallbackTotal = items.reduce((sum, item) => sum + (item.unitPrice ?? 0), 0);

  if (variant === 'detailed') {
    return (
      <div className="w-full space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Récapitulatif</p>
          <h2 className="mt-1.5 font-display text-2xl font-bold text-slate-900 sm:text-[2rem]">
            Votre réservation
          </h2>
        </div>

        <div className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.07)] sm:px-5 sm:py-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            <span>Séjour</span>
            <span>Sous-total</span>
          </div>

          <div className="space-y-5 pt-4">
            {items.map((item, index) => {
              const priced = byId.get(item.id);
              const sessionLabel = formatDateRange(
                priced?.sessionStartDate ?? null,
                priced?.sessionEndDate ?? null
              );
              const subtotal = priced
                ? formatEuroFromCents(priced.totalPriceCents)
                : formatUnitPrice(item.unitPrice);
              const itemExtra = renderItemExtra?.(item, index);

              return (
                <article
                  key={item.id}
                  className="grid gap-3 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0 md:grid-cols-[88px_minmax(0,1fr)_104px]"
                >
                  <div
                    className="h-24 overflow-hidden rounded-[18px] bg-slate-100 bg-cover bg-center"
                    style={item.coverImage ? { backgroundImage: `url(${item.coverImage})` } : undefined}
                  />

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.title}
                      {sessionLabel ? ` - ${sessionLabel}` : ''}
                    </p>
                    {item.location ? (
                      <p className="text-xs text-slate-600 sm:text-sm">{item.location}</p>
                    ) : null}
                    <p className="text-xs font-medium text-slate-700 sm:text-sm">
                      Prix habituel: {formatUnitPrice(item.unitPrice)}
                    </p>
                    {priced?.transportPriceCents ? (
                      <p className="text-xs text-slate-700 sm:text-sm">
                        {priced.transportLabel ?? 'Transport'} ({formatEuroFromCents(priced.transportPriceCents)})
                      </p>
                    ) : null}
                    {priced?.insurancePriceCents ? (
                      <p className="text-xs text-slate-700 sm:text-sm">
                        Assurance: {priced.insuranceLabel ?? 'Assurance'} ({formatEuroFromCents(priced.insurancePriceCents)})
                      </p>
                    ) : null}
                    {priced?.extraOptionPriceCents ? (
                      <p className="text-xs text-slate-700 sm:text-sm">
                        Option: {priced.extraOptionLabel ?? 'Option supplémentaire'} ({formatEuroFromCents(priced.extraOptionPriceCents)})
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-700 sm:text-sm">
                      Vendu par: <span className="font-semibold text-brand-600">{item.organizerName}</span>
                    </p>
                    {itemExtra ? <div className="pt-2">{itemExtra}</div> : null}
                  </div>

                  <div className="flex items-center justify-start text-base font-semibold text-slate-900 md:justify-end">
                    {subtotal}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 space-y-2.5 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              <span>Sous-total</span>
              <span className="text-sm text-slate-900 sm:text-base">
                {pricing ? formatEuroFromCents(pricing.totalCents) : formatUnitPrice(fallbackTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              <span>Total</span>
              <span className="text-sm text-slate-900 sm:text-base">
                {pricing ? formatEuroFromCents(pricing.totalCents) : formatUnitPrice(fallbackTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-slate-900">Votre panier</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const priced = byId.get(item.id);
          const linePrice = priced ? formatEuroFromCents(priced.totalPriceCents) : formatUnitPrice(item.unitPrice);
          return (
            <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.organizerName}</p>
              <p className="mt-2 text-sm font-semibold text-accent-600">{linePrice}</p>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
          <span>Total</span>
          <span>
            {pricing ? formatEuroFromCents(pricing.totalCents) : formatUnitPrice(fallbackTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
