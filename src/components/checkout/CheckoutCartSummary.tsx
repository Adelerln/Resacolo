import type { CartItem } from '@/types/cart';
import { formatEuroFromCents, type CheckoutPricing, type CheckoutPricingItem } from '@/types/checkout';

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

function getDetailedItemSelectionLines(item: CartItem, priced: CheckoutPricingItem | undefined) {
  const L = item.selectionLabels;
  const sel = item.selection;

  const session =
    L?.sessionLine?.trim() ||
    (priced?.sessionStartDate && priced?.sessionEndDate
      ? formatDateRange(priced.sessionStartDate, priced.sessionEndDate) ?? undefined
      : undefined);

  const transport =
    L?.transportLine?.trim() ||
    (priced && (priced.transportPriceCents ?? 0) > 0
      ? `${priced.transportLabel ?? 'Transport'} (${formatEuroFromCents(priced.transportPriceCents)})`
      : sel.transportMode === 'Sans transport'
        ? 'Sans transport'
        : undefined);

  const insurance =
    L?.insuranceLine?.trim() ||
    (priced && (priced.insurancePriceCents ?? 0) > 0
      ? `${priced.insuranceLabel ?? 'Assurance'} (${formatEuroFromCents(priced.insurancePriceCents)})`
      : undefined);

  const extra =
    L?.extraLine?.trim() ||
    (priced && (priced.extraOptionPriceCents ?? 0) > 0
      ? `${priced.extraOptionLabel ?? 'Option supplémentaire'} (${formatEuroFromCents(priced.extraOptionPriceCents)})`
      : undefined);

  return { session, transport, insurance, extra };
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
          <div className="flex items-center gap-4 border-b border-slate-200 pb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            <span className="hidden w-[88px] shrink-0 sm:block" aria-hidden />
            <div className="flex min-w-0 flex-1">
              <span>Séjour</span>
            </div>
          </div>

          <div className="space-y-5 pt-4">
            {items.map((item, index) => {
              const priced = byId.get(item.id);
              const lines = getDetailedItemSelectionLines(item, priced);
              const itemExtra = renderItemExtra?.(item, index);

              return (
                <article
                  key={item.id}
                  className="flex flex-col gap-3 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4"
                >
                  <div
                    className="h-24 w-full shrink-0 overflow-hidden rounded-[18px] bg-slate-100 bg-cover bg-center sm:h-24 sm:w-[88px]"
                    style={item.coverImage ? { backgroundImage: `url(${item.coverImage})` } : undefined}
                  />

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    {item.location ? (
                      <p className="text-xs text-slate-600 sm:text-sm">{item.location}</p>
                    ) : null}
                    <dl className="mt-2 space-y-1.5 text-xs text-slate-700 sm:text-sm">
                      {lines.session ? (
                        <div>
                          <dt className="font-semibold text-slate-800">Session</dt>
                          <dd className="mt-0.5">{lines.session}</dd>
                        </div>
                      ) : null}
                      {lines.transport ? (
                        <div>
                          <dt className="font-semibold text-slate-800">Transport</dt>
                          <dd className="mt-0.5">{lines.transport}</dd>
                        </div>
                      ) : null}
                      {lines.insurance ? (
                        <div>
                          <dt className="font-semibold text-slate-800">Assurance</dt>
                          <dd className="mt-0.5">{lines.insurance}</dd>
                        </div>
                      ) : null}
                      {lines.extra ? (
                        <div>
                          <dt className="font-semibold text-slate-800">Option complémentaire</dt>
                          <dd className="mt-0.5">{lines.extra}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <p className="text-xs text-slate-700 sm:text-sm">
                      Vendu par : <span className="font-semibold text-brand-600">{item.organizerName}</span>
                    </p>
                    {itemExtra ? <div className="pt-2">{itemExtra}</div> : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
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
