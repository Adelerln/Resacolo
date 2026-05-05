'use client';

import { useEffect, useMemo, useState } from 'react';
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

  const parent1Name = useMemo(() => mapProfileToParent1Name(profile), [profile]);
  const fullAddress = useMemo(
    () =>
      formatAddress(profile.addressLine1, profile.addressLine2, profile.postalCode, profile.city) ||
      'Non renseignée',
    [profile]
  );
  const parent2Address = useMemo(() => {
    if (!profile.parent2HasDifferentAddress) return 'Identique à l’adresse du domicile';
    return (
      formatAddress(
        profile.parent2AddressLine1,
        profile.parent2AddressLine2,
        profile.parent2PostalCode,
        profile.parent2City
      ) || 'Non renseignée'
    );
  }, [profile]);
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

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          <div className="space-y-8">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

              <div className="mt-5 flex justify-end">
                <Link href="/sejours" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  Voir tous les séjours
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,2fr)_0.9fr_0.9fr_1.2fr] gap-3 bg-slate-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <span>Séjour</span>
                    <span className="text-center">Saison</span>
                    <span className="text-center">Âge</span>
                    <span className="text-right">Lieu</span>
                  </div>
                  <div className="max-h-[18.5rem] overflow-y-auto">
                    {visibleFavoriteStays.map((stay) => {
                      const locationLabel =
                        stay.displayLocation || stay.location || stay.region || 'Lieu à préciser';
                      const seasonLabel = stay.seasonName || stay.period[0] || 'Saison à préciser';
                      return (
                        <Link
                          key={stay.id}
                          href={`/sejours/${stay.canonicalSlug}`}
                          className="grid grid-cols-[minmax(0,2fr)_0.9fr_0.9fr_1.2fr] items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          <span className="line-clamp-2 font-display text-base font-semibold text-slate-900">
                            {stay.title}
                          </span>
                          <span className="text-center text-xs font-semibold uppercase tracking-[0.04em] text-slate-700">
                            {seasonLabel}
                          </span>
                          <span className="text-center font-medium text-slate-900">
                            {stay.ageRange || 'Tous âges'}
                          </span>
                          <span className="text-right font-medium text-slate-900">
                            {locationLabel}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
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

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-slate-900">Informations du compte</h2>
              <div className="mt-4 space-y-4">
                <article className="rounded-xl border border-blue-100 bg-blue-100/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Parent 1</h3>
                  <dl className="mt-3 space-y-2 text-sm text-slate-700 break-words">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Nom</dt>
                      <dd className="font-medium text-slate-900">{parent1Name}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Statut</dt>
                      <dd className="font-medium text-slate-900">
                        {parentStatusLabel(profile.parent1Status, profile.parent1StatusOther)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Portable</dt>
                      <dd className="font-medium text-slate-900">{formatPhoneDisplay(profile.phone)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Email</dt>
                      <dd className="font-medium text-slate-900">{profile.email || 'Non renseigné'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Adresse</dt>
                      <dd className="max-w-[65%] text-right font-medium text-slate-900">{fullAddress}</dd>
                    </div>
                  </dl>
                </article>

                {showParent2 ? (
                <article className="rounded-xl border border-orange-100 bg-orange-100/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Parent 2</h3>
                  <dl className="mt-3 space-y-2 text-sm text-slate-700 break-words">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Nom</dt>
                      <dd className="font-medium text-slate-900">{profile.parent2Name || 'Non renseigné'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Statut</dt>
                      <dd className="font-medium text-slate-900">
                        {parentStatusLabel(profile.parent2Status, profile.parent2StatusOther)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Portable</dt>
                      <dd className="font-medium text-slate-900">
                        {profile.parent2Phone ? formatPhoneDisplay(profile.parent2Phone) : 'Non renseigné'}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Email</dt>
                      <dd className="font-medium text-slate-900">
                        {profile.parent2Email || 'Non renseigné'}
                      </dd>
                    </div>
                    {profile.parent2HasDifferentAddress && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-slate-500">Adresse</dt>
                        <dd className="max-w-[65%] text-right font-medium text-slate-900">{parent2Address}</dd>
                      </div>
                    )}
                  </dl>
                </article>
                ) : null}
              </div>

            </section>

            <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
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
          </aside>
        </div>
      </section>
    </div>
  );
}
