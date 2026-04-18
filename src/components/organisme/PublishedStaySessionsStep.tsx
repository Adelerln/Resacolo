import RemainingPlacesEditor from '@/components/organisme/RemainingPlacesEditor';
import {
  organizerStayAddSession,
  organizerStayDeleteSession,
  organizerStayUpdateSessionRemainingPlaces
} from '@/lib/organizer-stay-session-actions';
import { sessionStatusLabel } from '@/lib/ui/labels';

type SessionItem = {
  id: string;
  start_date: string;
  end_date: string;
  capacity_total: number;
  status: string;
  session_prices:
    | { amount_cents: number; currency: string }
    | { amount_cents: number; currency: string }[]
    | null;
};

function getSessionPriceAmountCents(sessionItem: SessionItem) {
  if (!sessionItem.session_prices) return null;
  if (Array.isArray(sessionItem.session_prices)) {
    return sessionItem.session_prices[0]?.amount_cents ?? null;
  }
  return sessionItem.session_prices.amount_cents ?? null;
}

function formatReservedPlacesLabel(count: number, total: number) {
  const reservedWord = count > 1 ? 'places réservées' : 'place réservée';
  return `${count} ${reservedWord} /${total}`;
}

function formatRemainingPlacesLabel(count: number) {
  const remainingWord = count > 1 ? 'places restantes' : 'place restante';
  return `${count} ${remainingWord}`;
}

export default function PublishedStaySessionsStep({
  stayId,
  organizerId,
  returnTo,
  sessions,
  reservedSessionCounts
}: {
  stayId: string;
  organizerId: string;
  returnTo: 'detail' | 'edit';
  sessions: SessionItem[];
  reservedSessionCounts: Map<string, number>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Sessions</h3>
        <p className="mt-1 text-sm text-slate-600">
          Gestion des dates, capacités et prix. Les modifications sont enregistrées immédiatement.
        </p>
      </div>

      <ul className="space-y-2 text-sm text-slate-600">
        {sessions.map((sessionItem) => {
          const reservedCount = reservedSessionCounts.get(sessionItem.id) ?? 0;
          const remainingPlaces = Math.max(0, sessionItem.capacity_total - reservedCount);
          const displayStatus =
            sessionItem.status === 'COMPLETED' || sessionItem.status === 'ARCHIVED'
              ? sessionItem.status
              : remainingPlaces === 0
                ? 'FULL'
                : 'OPEN';

          return (
            <li
              key={sessionItem.id}
              className="flex flex-col gap-4 rounded-lg border border-slate-100 px-3 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div>
                  {new Date(sessionItem.start_date).toLocaleDateString('fr-FR')} -{' '}
                  {new Date(sessionItem.end_date).toLocaleDateString('fr-FR')}
                </div>
                <div className="text-xs text-slate-500">
                  {formatReservedPlacesLabel(reservedCount, sessionItem.capacity_total)} (
                  {sessionStatusLabel(displayStatus)})
                </div>
                {getSessionPriceAmountCents(sessionItem) !== null && (
                  <div className="text-xs text-slate-500">
                    Prix:{' '}
                    {(getSessionPriceAmountCents(sessionItem)! / 100).toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'EUR'
                    })}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <div className="text-sm font-medium text-slate-700">
                  {formatRemainingPlacesLabel(remainingPlaces)}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <RemainingPlacesEditor
                    action={organizerStayUpdateSessionRemainingPlaces}
                    initialValue={remainingPlaces}
                    hiddenFields={{
                      session_id: sessionItem.id,
                      stay_id: stayId,
                      organizer_id: organizerId,
                      return_to: returnTo
                    }}
                  />
                  <form action={organizerStayDeleteSession}>
                    <input type="hidden" name="stay_id" value={stayId} />
                    <input type="hidden" name="organizer_id" value={organizerId} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <input type="hidden" name="session_id" value={sessionItem.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
                    >
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
        {sessions.length === 0 && <li>Aucune session.</li>}
      </ul>

      <form action={organizerStayAddSession} className="space-y-3 border-t border-slate-100 pt-4">
        <input type="hidden" name="stay_id" value={stayId} />
        <input type="hidden" name="organizer_id" value={organizerId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">
            Début
            <input
              name="startDate"
              type="date"
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
              required
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Fin
            <input
              name="endDate"
              type="date"
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
              required
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Capacité
            <input
              name="capacityTotal"
              type="number"
              min="0"
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
              required
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Prix en euro
            <input
              name="amount_euros"
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
              placeholder="0,00"
            />
          </label>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
        >
          Ajouter session
        </button>
      </form>
    </div>
  );
}
