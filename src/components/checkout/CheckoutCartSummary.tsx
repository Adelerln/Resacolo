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

export function CheckoutCartSummary({ items, pricing }: { items: CartItem[]; pricing?: CheckoutPricing | null }) {
  const byId = new Map((pricing?.items ?? []).map((item) => [item.cartItemId, item]));
  const fallbackTotal = items.reduce((sum, item) => sum + (item.unitPrice ?? 0), 0);

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
