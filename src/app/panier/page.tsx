'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Clock, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';

function formatPrice(price?: number | null) {
  if (!price) return 'Sur demande';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

export default function PanierPage() {
  const router = useRouter();
  const { items, removeItemByIndex } = useCart();

  const total = items.reduce((sum, s) => sum + (s.priceFrom ?? 0), 0);
  const hasTotal = items.every((s) => s.priceFrom != null);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h1 className="font-display mt-6 text-2xl font-bold text-slate-900">Votre panier est vide</h1>
        <p className="mt-2 text-slate-600">
          Choisissez un séjour et cliquez sur « Réserver maintenant » pour l’ajouter ici.
        </p>
        <Link
          href="/sejours"
          className="btn btn-primary btn-md mt-8"
        >
          Voir les séjours
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-slate-900">Panier</h1>
      <p className="mt-1 text-slate-600">
        {items.length} séjour{items.length > 1 ? 's' : ''} dans votre panier
      </p>

      <div className="mt-10 space-y-6">
        {items.map((stay, index) => (
          <article
            key={`${stay.slug}-${index}`}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:flex-row"
          >
            <div className="relative h-40 w-full shrink-0 sm:h-36 sm:w-48">
              <Image
                src={stay.coverImage || getMockImageUrl(mockImages.sejours.fallbackCover, 400, 80)}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 192px"
              />
            </div>
            <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
              <div>
                <Link
                  href={`/sejours/${stay.slug}`}
                  className="font-display text-lg font-semibold text-slate-900 hover:text-brand-600"
                >
                  {stay.title}
                </Link>
                <p className="mt-1 text-xs font-medium text-brand-600">{stay.organizer.name}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {stay.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {stay.duration} · {stay.ageRange}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="text-lg font-semibold text-accent-600">
                  {formatPrice(stay.priceFrom)}
                </p>
                <button
                  type="button"
                  onClick={() => removeItemByIndex(index)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Retirer du panier"
                >
                  <Trash2 className="h-4 w-4" />
                  Retirer
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-slate-900">Total</p>
            <p className="mt-0.5 text-2xl font-bold text-accent-600">
              {hasTotal ? formatPrice(total) : 'Sur demande'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sejours"
              className="btn btn-secondary btn-md"
            >
              Continuer mes recherches
            </Link>
            <button
              type="button"
              onClick={() => router.push('/contact')}
              className="btn btn-primary btn-md"
            >
              Valider le panier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
