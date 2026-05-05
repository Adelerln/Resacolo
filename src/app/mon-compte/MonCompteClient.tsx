'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Heart,
  Mail,
  MapPin,
  CalendarDays,
  UserRound,
  ShieldCheck,
  Settings,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import FamilyReservationDetailsModal from '@/components/account/FamilyReservationDetailsModal';
import { useFavorites } from '@/components/favorites/FavoritesProvider';
import { fetchFamilyProfileSnapshot } from '@/lib/account-profile/client';
import { formatPhoneDisplay, parentStatusLabel } from '@/lib/account-preferences';
import type { FamilyProfile, FamilyReservation } from '@/types/family-profile';
import type { Stay } from '@/types/stay';

type MonCompteClientProps = {
  initialProfile: FamilyProfile;
  reservations: FamilyReservation[];
  favoriteStays: Stay[];
  profileLoadError?: string | null;
};

function formatAddress(line1: string, line2: string, postalCode: string, city: string) {
  return [line1, line2, `${postalCode} ${city}`.trim()].filter(Boolean).join(', ');
}

function buildProfileDisplayName(profile: FamilyProfile) {
  const fullName = [profile.billingFirstName, profile.billingLastName].filter(Boolean).join(' ').trim();
  return fullName || 'Famille';
}

function mapProfileToParent1Name(profile: FamilyProfile) {
  const fullName = [profile.billingFirstName, profile.billingLastName].filter(Boolean).join(' ').trim();
  return fullName || 'Non renseigné';
}

export default function MonCompteClient({
  initialProfile,
  reservations,
  favoriteStays,
  profileLoadError
}: MonCompteClientProps) {
  const [profile, setProfile] = useState<FamilyProfile>(initialProfile);
  const [reservationList, setReservationList] = useState<FamilyReservation[]>(reservations);
  const reservationsColumnRef = useRef<HTMLElement | null>(null);
  const favoritesColumnRef = useRef<HTMLElement | null>(null);
  const favoritesListRef = useRef<HTMLDivElement | null>(null);
  const firstFavoriteCardRef = useRef<HTMLAnchorElement | null>(null);
  const [favoritesSectionMinHeight, setFavoritesSectionMinHeight] = useState<number | null>(null);
  const [favoritesListMaxHeight, setFavoritesListMaxHeight] = useState<number | null>(null);
  const [favoritesListScrollable, setFavoritesListScrollable] = useState(false);
  const { favoriteIdsArray, isLoaded } = useFavorites();

  useEffect(() => {
    let cancelled = false;
    fetchFamilyProfileSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setProfile(snapshot.profile);
        setReservationList(snapshot.reservations);
      })
      .catch(() => {
        // Keep server-rendered profile as fallback.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const reservationsEl = reservationsColumnRef.current;
    const favoritesEl = favoritesColumnRef.current;
    const listEl = favoritesListRef.current;
    if (!reservationsEl || !favoritesEl || !listEl || visibleFavoriteStays.length === 0) {
      setFavoritesSectionMinHeight(null);
      setFavoritesListMaxHeight(null);
      setFavoritesListScrollable(false);
      return;
    }

    const recompute = () => {
      const reservationHeight = reservationsEl.offsetHeight;
      const favoritesNaturalHeight = favoritesEl.scrollHeight;
      const cardHeight = firstFavoriteCardRef.current?.offsetHeight ?? 0;
      const gap = 12; // space-y-3
      const twoAndHalfCardsHeight = cardHeight > 0 ? Math.round(cardHeight * 2.5 + gap * 2) : null;

      if (favoritesNaturalHeight < reservationHeight) {
        setFavoritesSectionMinHeight(reservationHeight);
        setFavoritesListMaxHeight(null);
        setFavoritesListScrollable(false);
        return;
      }

      if (Math.abs(favoritesNaturalHeight - reservationHeight) <= 2) {
        setFavoritesSectionMinHeight(reservationHeight);
        setFavoritesListMaxHeight(reservationHeight);
        setFavoritesListScrollable(true);
        return;
      }

      setFavoritesSectionMinHeight(null);
      setFavoritesListMaxHeight(twoAndHalfCardsHeight);
      setFavoritesListScrollable(Boolean(twoAndHalfCardsHeight));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(reservationsEl);
    observer.observe(favoritesEl);
    return () => observer.disconnect();
  }, [visibleFavoriteStays, reservationList]);

  const parent1Name = useMemo(() => mapProfileToParent1Name(profile), [profile]);
  const fullAddress = useMemo(
    () =>
      formatAddress(profile.addressLine1, profile.addressLine2, profile.postalCode, profile.city) ||
      'Non renseignée',
    [profile]
  );
  const showParent2 = useMemo(
    () =>
      Boolean(
        profile.parent2Name ||
          profile.parent2Phone ||
          profile.parent2Email ||
          profile.parent2StatusOther ||
          profile.parent2HasDifferentAddress
      ),
    [profile]
  );
  const visibleFavoriteStays = useMemo(() => {
    if (!isLoaded) return favoriteStays;
    const ids = new Set(favoriteIdsArray);
    return favoriteStays.filter((stay) => ids.has(stay.id));
  }, [favoriteIdsArray, favoriteStays, isLoaded]);

  const formatEuroFromCents = (cents: number, currency = 'EUR') =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(cents / 100);

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="section-container py-10 sm:py-14">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-md sm:h-16 sm:w-16">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mon compte</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                Bonjour {buildProfileDisplayName(profile)}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Mail className="h-4 w-4" />
                {profile.email || 'Email non renseigné'}
                <span className="mx-1 hidden text-slate-300 sm:inline">|</span>
                <MapPin className="h-4 w-4" />
                {profile.city || 'Ville non renseignée'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact/preferences" className="btn btn-secondary btn-sm">
              <Settings className="h-4 w-4" />
              Mes informations
            </Link>
            <form action="/api/auth/logout" method="post">
              <input type="hidden" name="redirectTo" value="/login/familles" />
              <button type="submit" className="btn btn-primary btn-sm">
                Se déconnecter
              </button>
            </form>
          </div>
        </header>
        {profileLoadError ? (
          <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {profileLoadError}
          </p>
        ) : null}

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-slate-900">Informations du compte</h2>
          <article className="mt-4 rounded-xl border border-blue-100 bg-blue-100/70 p-3.5">
            <h3 className="text-sm font-semibold text-slate-900">Parent 1</h3>
            <dl className="mt-2.5 grid gap-x-8 gap-y-2.5 text-sm text-slate-700 md:grid-cols-2">
              <div className="space-y-0.5">
                <dt className="text-slate-500">Nom</dt>
                <dd className="font-medium text-slate-900">{parent1Name}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-slate-500">Statut</dt>
                <dd className="font-medium text-slate-900">
                  {parentStatusLabel(profile.parent1Status, profile.parent1StatusOther)}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-slate-500">Portable</dt>
                <dd className="font-medium text-slate-900">{formatPhoneDisplay(profile.phone)}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-900">{profile.email || 'Non renseigné'}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-slate-500">Adresse</dt>
                <dd className="font-medium text-slate-900">{fullAddress}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-slate-500">Parent 2</dt>
                <dd className="font-medium text-slate-900">
                  {showParent2 ? profile.parent2Name || 'Non renseigné' : 'Masqué / non renseigné'}
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <div className="mt-8 grid items-start gap-8 xl:grid-cols-2">
          <section ref={reservationsColumnRef} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">Réservations</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Retrouvez ici vos réservations à venir et passées.
                  </p>
                </div>
                <CalendarDays className="h-8 w-8 text-accent-500" />
              </div>

              {reservationList.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Vous n&apos;avez pas encore de réservation. Parcourez les séjours et ajoutez-les à votre panier.
                </p>
              ) : (
                <ul className="mt-6 space-y-4">
                  {reservationList.map((reservation) => (
                    <li
                      key={reservation.orderId}
                      className={`rounded-xl border p-4 text-sm ${
                        reservation.isPast
                          ? 'border-slate-200 bg-slate-100/90 text-slate-500'
                          : 'border-slate-100 bg-slate-50/60 text-slate-700'
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-display text-base font-semibold ${
                              reservation.isPast ? 'text-slate-500' : 'text-slate-900'
                            }`}
                          >
                            {reservation.title}
                          </p>
                          <p className={`mt-1 flex items-center gap-2 text-xs ${reservation.isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                            <CalendarDays className="h-4 w-4" />
                            {reservation.dates}
                          </p>
                          <p className={`mt-1 text-xs ${reservation.isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                            {reservation.child}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <p
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                reservation.isPast
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {reservation.status}
                            </p>
                            {reservation.remainingBalanceCents > 0 ? (
                              <p className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                <Wallet className="h-3.5 w-3.5" />
                                Solde restant : {formatEuroFromCents(reservation.remainingBalanceCents, reservation.currency)}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <FamilyReservationDetailsModal reservation={reservation} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

          </section>

          <section
            ref={favoritesColumnRef}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            style={favoritesSectionMinHeight ? { minHeight: favoritesSectionMinHeight } : undefined}
          >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">Séjours favoris</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Les séjours que vous avez ajoutés en favoris depuis la page catalogue.
                  </p>
                </div>
                <Heart className="h-7 w-7 text-accent-500" />
              </div>

              {visibleFavoriteStays.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Vous n&apos;avez pas encore de favoris. Cliquez sur le cœur depuis une fiche séjour pour l&apos;ajouter.
                </p>
              ) : (
                <div
                  ref={favoritesListRef}
                  className={`mt-6 space-y-3 ${favoritesListScrollable ? 'overflow-y-auto pr-1' : ''}`}
                  style={favoritesListMaxHeight ? { maxHeight: favoritesListMaxHeight } : undefined}
                >
                  {visibleFavoriteStays.map((stay) => {
                    const locationLabel = stay.displayLocation || stay.location || stay.region || 'Lieu à préciser';
                    const seasonLabel = stay.seasonName || stay.period[0] || 'Saison à préciser';
                    const stayImage = stay.coverImage || stay.galleryImages?.[0] || '';
                    return (
                      <Link
                        ref={firstFavoriteCardRef.current ? undefined : firstFavoriteCardRef}
                        key={stay.id}
                        href={`/sejours/${stay.canonicalSlug}`}
                        className="block overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-r from-white via-white to-blue-50/40 text-sm text-slate-700 transition hover:border-blue-200 hover:shadow-sm"
                      >
                        {stayImage ? (
                          <div className="h-36 w-full overflow-hidden bg-slate-100">
                            <img
                              src={stayImage}
                              alt={stay.title}
                              className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center bg-gradient-to-r from-brand-100 via-blue-100 to-cyan-100">
                            <span className="px-4 text-center font-display text-base font-semibold text-brand-700">
                              {stay.title}
                            </span>
                          </div>
                        )}
                        <div className="p-4">
                        <p className="line-clamp-2 font-display text-base font-semibold text-slate-900">
                          {stay.title}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-700">Saison</p>
                            <p className="mt-0.5 text-xs font-semibold text-brand-800">{seasonLabel}</p>
                          </div>
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Âge</p>
                            <p className="mt-0.5 text-xs font-semibold text-emerald-800">{stay.ageRange || 'Tous âges'}</p>
                          </div>
                          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">Lieu</p>
                            <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-amber-800">{locationLabel}</p>
                          </div>
                        </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {visibleFavoriteStays.length > 0 ? (
                <div className="mt-5 flex justify-end">
                  <Link href="/account/favorites" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                    Voir tous les favoris
                  </Link>
                </div>
              ) : null}
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          <h3 className="font-display text-base font-semibold text-slate-900">Aide & confidentialité</h3>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/bien-choisir-sa-colo" className="hover:text-brand-600">
                Bien choisir sa colo
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-brand-600">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/confidentialite" className="hover:text-brand-600">
                Politique de confidentialité
              </Link>
            </li>
          </ul>
        </section>
      </section>
    </div>
  );
}
