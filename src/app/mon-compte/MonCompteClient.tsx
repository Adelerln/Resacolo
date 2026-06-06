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
  Wallet,
  Building2,
  Link2,
  Unlink
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatMoneyCentsFr } from '@/lib/format-money-fr';
import { orderStatusBadgeClassName } from '@/lib/order-workflow';
import { useFavorites } from '@/components/favorites/FavoritesProvider';
import {
  createFamilyChild,
  deleteFamilyChild,
  attachFamilyCseAffiliation,
  detachFamilyCseAffiliation,
  fetchFamilyProfileSnapshot,
  updateFamilyChild
} from '@/lib/account-profile/client';
import { formatPhoneDisplay, parentStatusLabel } from '@/lib/account-preferences';
import type {
  FamilyCseAffiliation,
  FamilyProfile,
  FamilyProfileChildInput,
  FamilyReservation
} from '@/types/family-profile';
import type { Stay } from '@/types/stay';

type MonCompteClientProps = {
  initialProfile: FamilyProfile;
  reservations: FamilyReservation[];
  initialCseAffiliation: FamilyCseAffiliation | null;
  favoriteStays: Stay[];
  profileLoadError?: string | null;
};

const ACCOUNT_PANEL_VISIBLE_ITEMS = 3;
/** Hauteur fixe partagée entre carte réservation et carte favori (colonne image 96px). */
const ACCOUNT_PANEL_ITEM_HEIGHT = 'h-[9rem]';
/** 3 cartes de 9rem + 2 espacements de 12px (space-y-3). */
const ACCOUNT_PANEL_LIST_MAX_HEIGHT = 'calc(9rem * 3 + 0.75rem * 2)';

/** Hauteur réservée identique sous les deux panneaux pour aligner le début des listes de cartes. */
const ACCOUNT_PANEL_HEADER_CLASS =
  'flex min-h-[3rem] items-center justify-between gap-3 border-b border-transparent';

function formatAddress(line1: string, line2: string, postalCode: string, city: string) {
  return [line1, line2, `${postalCode} ${city}`.trim()].filter(Boolean).join(', ');
}

function buildProfileDisplayName(profile: FamilyProfile) {
  const fullName = [profile.billingFirstName, profile.billingLastName].filter(Boolean).join(' ').trim();
  return fullName || 'Famille';
}

function splitName(value: string | null | undefined) {
  const clean = value?.trim() ?? '';
  if (!clean) {
    return { firstName: '', lastName: '' };
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function formatChildBirthdate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value || 'Date non renseignée';
  return date.toLocaleDateString('fr-FR');
}

const EMPTY_CHILD_FORM: FamilyProfileChildInput = {
  firstName: '',
  lastName: '',
  birthdate: '',
  gender: '',
  additionalInfo: ''
};

export default function MonCompteClient({
  initialProfile,
  reservations,
  initialCseAffiliation,
  favoriteStays,
  profileLoadError
}: MonCompteClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<FamilyProfile>(initialProfile);
  const [reservationList, setReservationList] = useState<FamilyReservation[]>(reservations);
  const [cseAffiliation, setCseAffiliation] = useState<FamilyCseAffiliation | null>(initialCseAffiliation);
  const [cseCodeInput, setCseCodeInput] = useState(initialCseAffiliation?.code ?? initialProfile.cseOrganization ?? '');
  const [cseSubmitError, setCseSubmitError] = useState<string | null>(null);
  const [cseSubmitSuccess, setCseSubmitSuccess] = useState<string | null>(null);
  const [isSubmittingCse, setIsSubmittingCse] = useState(false);
  const [childForm, setChildForm] = useState<FamilyProfileChildInput>(EMPTY_CHILD_FORM);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [childError, setChildError] = useState<string | null>(null);
  const [childSuccess, setChildSuccess] = useState<string | null>(null);
  const [isSavingChild, setIsSavingChild] = useState(false);
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);
  const { favoriteIdsArray, isLoaded } = useFavorites();

  const visibleFavoriteStays = useMemo(() => {
    if (!isLoaded) return favoriteStays;
    const ids = new Set(favoriteIdsArray);
    return favoriteStays.filter((stay) => ids.has(stay.id));
  }, [favoriteIdsArray, favoriteStays, isLoaded]);

  useEffect(() => {
    let cancelled = false;
    fetchFamilyProfileSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setProfile(snapshot.profile);
        setReservationList(snapshot.reservations);
        setCseAffiliation(snapshot.cseAffiliation);
        setCseCodeInput(snapshot.cseAffiliation?.code ?? snapshot.profile.cseOrganization ?? '');
      })
      .catch(() => {
        // Keep server-rendered profile as fallback.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const parent2Identity = useMemo(() => splitName(profile.parent2Name), [profile.parent2Name]);
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

  const reservationsScrollable = reservationList.length > ACCOUNT_PANEL_VISIBLE_ITEMS;
  const favoritesScrollable = visibleFavoriteStays.length > ACCOUNT_PANEL_VISIBLE_ITEMS;

  async function handleAttachCse() {
    setCseSubmitError(null);
    setCseSubmitSuccess(null);
    setIsSubmittingCse(true);

    try {
      const response = await attachFamilyCseAffiliation(cseCodeInput);
      setProfile(response.profile);
      setReservationList(response.reservations);
      setCseAffiliation(response.cseAffiliation);
      setCseCodeInput(response.cseAffiliation?.code ?? response.profile.cseOrganization ?? '');
      setCseSubmitSuccess('Votre rattachement CSE a bien été enregistré.');
      router.refresh();
    } catch (error) {
      setCseSubmitError(error instanceof Error ? error.message : 'Impossible de rattacher ce compte au CSE.');
    } finally {
      setIsSubmittingCse(false);
    }
  }

  async function handleDetachCse() {
    setCseSubmitError(null);
    setCseSubmitSuccess(null);
    setIsSubmittingCse(true);

    try {
      const response = await detachFamilyCseAffiliation();
      setProfile(response.profile);
      setReservationList(response.reservations);
      setCseAffiliation(response.cseAffiliation);
      setCseCodeInput('');
      setCseSubmitSuccess('Votre rattachement CSE a bien été supprimé.');
      router.refresh();
    } catch (error) {
      setCseSubmitError(error instanceof Error ? error.message : 'Impossible de désaffilier ce compte du CSE.');
    } finally {
      setIsSubmittingCse(false);
    }
  }

  async function handleSaveChild(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChildError(null);
    setChildSuccess(null);
    setIsSavingChild(true);

    try {
      const payload: FamilyProfileChildInput = {
        firstName: childForm.firstName.trim(),
        lastName: childForm.lastName.trim(),
        birthdate: childForm.birthdate,
        gender: childForm.gender,
        additionalInfo: childForm.additionalInfo.trim()
      };
      const response = editingChildId
        ? await updateFamilyChild(editingChildId, payload)
        : await createFamilyChild(payload);
      setProfile((prev) => {
        const otherChildren = prev.children.filter((child) => child.id !== response.child.id);
        const nextChildren = editingChildId
          ? [...otherChildren, response.child]
          : [response.child, ...otherChildren];
        nextChildren.sort((left, right) => right.birthdate.localeCompare(left.birthdate));
        return {
          ...prev,
          children: nextChildren
        };
      });
      setChildForm(EMPTY_CHILD_FORM);
      setEditingChildId(null);
      setChildSuccess(editingChildId ? "L'enfant a été mis à jour." : "L'enfant a été ajouté.");
    } catch (error) {
      setChildError(error instanceof Error ? error.message : "Impossible d'enregistrer l'enfant.");
    } finally {
      setIsSavingChild(false);
    }
  }

  function handleEditChild(childId: string) {
    const child = profile.children.find((entry) => entry.id === childId);
    if (!child) return;
    setEditingChildId(child.id);
    setChildForm({
      firstName: child.firstName,
      lastName: child.lastName,
      birthdate: child.birthdate,
      gender: child.gender,
      additionalInfo: child.additionalInfo
    });
    setChildError(null);
    setChildSuccess(null);
  }

  function handleCancelChildEdit() {
    setEditingChildId(null);
    setChildForm(EMPTY_CHILD_FORM);
    setChildError(null);
    setChildSuccess(null);
  }

  async function handleDeleteChild(childId: string) {
    setChildError(null);
    setChildSuccess(null);
    setDeletingChildId(childId);

    try {
      await deleteFamilyChild(childId);
      setProfile((prev) => ({
        ...prev,
        children: prev.children.filter((child) => child.id !== childId)
      }));
      if (editingChildId === childId) {
        handleCancelChildEdit();
      }
      setChildSuccess("L'enfant a été supprimé du compte.");
    } catch (error) {
      setChildError(error instanceof Error ? error.message : "Impossible de supprimer l'enfant.");
    } finally {
      setDeletingChildId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
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
                <dt className="text-slate-500">Nom parent 1</dt>
                <dd className="font-medium text-slate-900">{profile.billingLastName || 'Non renseigné'}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-slate-500">Prénom parent 1</dt>
                <dd className="font-medium text-slate-900">{profile.billingFirstName || 'Non renseigné'}</dd>
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
                <dt className="text-slate-500">Nom parent 2</dt>
                <dd className="font-medium text-slate-900">
                  {showParent2 ? parent2Identity.lastName || 'Non renseigné' : 'Masqué / non renseigné'}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-slate-500">Prénom parent 2</dt>
                <dd className="font-medium text-slate-900">
                  {showParent2 ? parent2Identity.firstName || 'Non renseigné' : 'Masqué / non renseigné'}
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">Enfants du compte</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ces enfants seront proposés au moment de réserver un séjour.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {profile.children.length} enfant{profile.children.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-6">
            <form onSubmit={handleSaveChild} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {editingChildId ? "Modifier l'enfant" : 'Ajouter un enfant'}
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm font-medium text-slate-700">
                  Prénom
                  <input
                    type="text"
                    value={childForm.firstName}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, firstName: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Nom
                  <input
                    type="text"
                    value={childForm.lastName}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, lastName: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Date de naissance
                  <input
                    type="date"
                    value={childForm.birthdate}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, birthdate: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Genre
                  <select
                    value={childForm.gender}
                    onChange={(event) =>
                      setChildForm((prev) => ({
                        ...prev,
                        gender: event.target.value as FamilyProfileChildInput['gender']
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Non précisé</option>
                    <option value="MASCULIN">Masculin</option>
                    <option value="FEMININ">Féminin</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-4">
                  Informations complémentaires
                  <textarea
                    value={childForm.additionalInfo}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, additionalInfo: event.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>

              {childError ? (
                <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {childError}
                </p>
              ) : null}
              {childSuccess ? (
                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {childSuccess}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" disabled={isSavingChild} className="btn btn-primary btn-sm">
                  {isSavingChild ? 'Enregistrement...' : editingChildId ? 'Enregistrer' : 'Ajouter'}
                </button>
                {editingChildId ? (
                  <button type="button" onClick={handleCancelChildEdit} className="btn btn-secondary btn-sm">
                    Annuler
                  </button>
                ) : null}
              </div>
            </form>

            <div className="space-y-3">
              {profile.children.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Aucun enfant enregistré pour le moment.
                </p>
              ) : (
                profile.children.map((child) => (
                  <article key={child.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">
                          {[child.firstName, child.lastName.toUpperCase()].filter(Boolean).join(' ')}
                        </p>
                        <p className="text-sm text-slate-600">Né(e) le {formatChildBirthdate(child.birthdate)}</p>
                        {child.gender ? (
                          <p className="text-sm text-slate-600">
                            Genre : {child.gender === 'FEMININ' ? 'Féminin' : 'Masculin'}
                          </p>
                        ) : null}
                        {child.additionalInfo.trim() ? (
                          <p className="text-sm whitespace-pre-wrap text-slate-600">{child.additionalInfo.trim()}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => handleEditChild(child.id)} className="btn btn-secondary btn-sm">
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChild(child.id)}
                          disabled={deletingChildId === child.id}
                          className="btn btn-primary btn-sm"
                        >
                          {deletingChildId === child.id ? 'Suppression...' : 'Supprimer'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-2 xl:items-stretch [&>*]:min-h-0">
          <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={ACCOUNT_PANEL_HEADER_CLASS}>
                <h2 className="min-w-0 max-w-[85%] font-display text-lg font-semibold leading-snug text-slate-900 sm:max-w-none">
                  Réservations à venir et passées
                </h2>
                {reservationList.length > 0 ? (
                  <Link
                    href="/mon-compte/reservations"
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Voir toutes
                  </Link>
                ) : null}
                <CalendarDays className="h-8 w-8 shrink-0 text-accent-500" aria-hidden />
              </div>

              {reservationList.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Vous n&apos;avez pas encore de réservation. Parcourez les séjours et ajoutez-les à votre panier.
                </p>
              ) : (
                <ul
                  className={`mt-3 min-h-0 space-y-3 ${reservationsScrollable ? 'flex-1 overflow-y-auto pr-1' : ''}`}
                  style={reservationsScrollable ? { maxHeight: ACCOUNT_PANEL_LIST_MAX_HEIGHT } : undefined}
                >
                  {reservationList.map((reservation) => (
                    <li key={reservation.orderId}>
                      <Link
                        href={`/mon-compte/reservations?open=${reservation.orderId}`}
                        className={`grid ${ACCOUNT_PANEL_ITEM_HEIGHT} grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-xl border text-sm transition hover:border-slate-400 hover:shadow-sm ${
                          reservation.isPast
                            ? 'border-slate-300 bg-slate-100/90 text-slate-500'
                            : 'border-slate-300 bg-slate-50/60 text-slate-700'
                        }`}
                      >
                      {reservation.coverImage ? (
                        <div className="h-full overflow-hidden bg-slate-100">
                          <img
                            src={reservation.coverImage}
                            alt={reservation.title}
                            className={`h-full w-full object-cover ${reservation.isPast ? 'opacity-85' : ''}`}
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div
                          className={`flex h-full items-center justify-center ${
                            reservation.isPast
                              ? 'bg-slate-200/80'
                              : 'bg-gradient-to-br from-brand-100 via-blue-100 to-cyan-100'
                          }`}
                        >
                          <CalendarDays
                            className={`h-10 w-10 shrink-0 ${reservation.isPast ? 'text-slate-400' : 'text-brand-600'}`}
                            aria-hidden
                          />
                        </div>
                      )}
                      <div className="flex h-full min-w-0 flex-col overflow-hidden p-3">
                        <p
                          className={`line-clamp-1 font-display text-base font-semibold leading-snug ${
                            reservation.isPast ? 'text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {reservation.title}
                        </p>
                        <p
                          className={`mt-0.5 flex items-center gap-1.5 text-xs ${
                            reservation.isPast ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 truncate">{reservation.dates}</span>
                        </p>
                        <p
                          className={`truncate text-xs ${
                            reservation.isPast ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {reservation.child}
                        </p>
                        <div className="mt-auto min-h-0 pt-1">
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className={`inline-flex w-fit max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-0 text-[11px] font-semibold leading-4 ${
                                reservation.isPast
                                  ? 'bg-slate-200 text-slate-600'
                                  : orderStatusBadgeClassName(reservation.orderStatus)
                              }`}
                            >
                              <ShieldCheck className="h-3 w-3 shrink-0" />
                              {reservation.status}
                            </span>
                            {reservation.remainingBalanceCents > 0 ? (
                              <span className="inline-flex w-fit max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0 text-[11px] font-semibold leading-4 text-amber-700">
                                <Wallet className="h-3 w-3 shrink-0" />
                                Solde à régler : {formatMoneyCentsFr(reservation.remainingBalanceCents, reservation.currency)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={ACCOUNT_PANEL_HEADER_CLASS}>
                <h2 className="min-w-0 max-w-[85%] font-display text-lg font-semibold leading-snug text-slate-900 sm:max-w-none">
                  Séjours ajoutés aux favoris
                </h2>
                {visibleFavoriteStays.length > 0 ? (
                  <Link href="/account/favorites" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                    Voir tous les favoris
                  </Link>
                ) : null}
                <Heart className="h-8 w-8 shrink-0 text-accent-500" aria-hidden />
              </div>

              {visibleFavoriteStays.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Vous n&apos;avez pas encore de favoris. Cliquez sur le cœur depuis une fiche séjour pour l&apos;ajouter.
                </p>
              ) : (
                <div
                  className={`mt-3 min-h-0 space-y-3 ${favoritesScrollable ? 'flex-1 overflow-y-auto pr-1' : ''}`}
                  style={favoritesScrollable ? { maxHeight: ACCOUNT_PANEL_LIST_MAX_HEIGHT } : undefined}
                >
                  {visibleFavoriteStays.map((stay) => {
                    const locationLabel = stay.displayLocation || stay.location || stay.region || 'Lieu à préciser';
                    const seasonLabel = stay.seasonName || stay.period[0] || 'Saison à préciser';
                    const stayImage = stay.coverImage || stay.galleryImages?.[0] || '';
                    return (
                      <Link
                        key={stay.id}
                        href={`/sejours/${stay.canonicalSlug}`}
                        className={`grid ${ACCOUNT_PANEL_ITEM_HEIGHT} grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-r from-white via-white to-blue-50/40 text-sm text-slate-700 transition hover:border-slate-400 hover:shadow-sm`}
                      >
                        {stayImage ? (
                          <div className="h-full overflow-hidden bg-slate-100">
                            <img
                              src={stayImage}
                              alt={stay.title}
                              className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-r from-brand-100 via-blue-100 to-cyan-100">
                            <span className="px-3 text-center font-display text-sm font-semibold text-brand-700">
                              {stay.title}
                            </span>
                          </div>
                        )}
                        <div className="flex min-w-0 h-full flex-col p-3">
                          <p className="line-clamp-2 font-display text-base font-semibold leading-snug text-slate-900">
                            {stay.title}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="inline-flex max-w-full items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                              <span className="mr-1 text-brand-500">Saison</span>
                              <span className="truncate">{seasonLabel}</span>
                            </span>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              <span className="mr-1 text-emerald-500">Âge</span>
                              {stay.ageRange || 'Tous âges'}
                            </span>
                          </div>
                          <div className="mt-auto pt-1.5">
                            <span className="inline-flex max-w-full items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              <span className="mr-1 text-amber-500">Lieu</span>
                              <span className="truncate">{locationLabel}</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">Rattachement à un CSE</h3>
              <p className="mt-1 text-sm text-slate-500">
                Renseignez le code partenaire transmis par votre CSE pour rattacher ce compte.
              </p>
            </div>
            <Building2 className="h-7 w-7 shrink-0 text-accent-500" aria-hidden />
          </div>

          {cseAffiliation ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-800">{cseAffiliation.name}</p>
                  <p className="text-sm text-emerald-700">
                    Code rattaché : <span className="font-semibold">{cseAffiliation.code}</span>
                  </p>
                  <p className="text-xs text-emerald-700/90">
                    Pour modifier ce rattachement, il faut d’abord se désaffilier du CSE.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDetachCse}
                  disabled={isSubmittingCse}
                  className="btn btn-secondary btn-sm shrink-0"
                >
                  <Unlink className="h-4 w-4" />
                  Se désaffilier
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">
                  Code CSE
                  <input
                    type="text"
                    value={cseCodeInput}
                    onChange={(event) => setCseCodeInput(event.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    placeholder="Ex : CSE2026"
                    disabled={isSubmittingCse}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAttachCse}
                  disabled={isSubmittingCse || !cseCodeInput.trim()}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  <Link2 className="h-4 w-4" />
                  Rattacher mon compte
                </button>
              </div>
            </div>
          )}

          {cseSubmitError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {cseSubmitError}
            </p>
          ) : null}
          {cseSubmitSuccess ? (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {cseSubmitSuccess}
            </p>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          <h3 className="font-display text-base font-semibold text-slate-900">Aide & confidentialité</h3>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/bien-choisir-sa-colo" className="text-brand-700 hover:text-brand-800">
                Bien choisir sa colo
              </Link>
            </li>
            <li>
              <Link href="/faq" className="text-brand-700 hover:text-brand-800">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/confidentialite" className="text-brand-700 hover:text-brand-800">
                Politique de confidentialité
              </Link>
            </li>
          </ul>
        </section>

      </section>
    </div>
  );
}
