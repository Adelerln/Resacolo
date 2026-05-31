'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type PublishDraftNowButtonProps = {
  draftId: string;
  organizerId: string;
};

export default function PublishDraftNowButton({ draftId, organizerId }: PublishDraftNowButtonProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publishNow() {
    setIsPublishing(true);
    setError(null);
    try {
      const response = await fetch(`/api/stay-drafts/${draftId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({
          organizerId,
          action: 'publish'
        })
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; liveStayId?: string | null }
        | null;
      if (!response.ok) {
        setError(data?.error ?? 'Publication impossible pour le moment.');
        return;
      }

      const liveStayId =
        typeof data?.liveStayId === 'string' && data.liveStayId.trim().length > 0
          ? data.liveStayId.trim()
          : null;
      if (!liveStayId) {
        setError('Publication réussie mais stayId manquant. Recharge la page.');
        return;
      }

      const next = new URL('/organisme/sejours/published-preview', window.location.origin);
      next.searchParams.set('organizerId', organizerId);
      next.searchParams.set('draftId', draftId);
      next.searchParams.set('stayId', liveStayId);
      router.replace(next.pathname + next.search);
      router.refresh();
    } catch {
      setError("Erreur réseau pendant la publication. Réessaie.");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={publishNow}
        disabled={isPublishing}
        className="organizer-btn-primary px-6 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPublishing ? 'Publication…' : 'Publier maintenant'}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
