'use client';

import { useState } from 'react';
import AccommodationPicker from '@/components/organisme/AccommodationPicker';
import type { OrganizerAccommodationOption } from '@/lib/organisme-accommodation-options';

type StartManualStayDraftFormProps = {
  organizerId: string;
  accommodationOptions: OrganizerAccommodationOption[];
  action: (formData: FormData) => void;
};

export default function StartManualStayDraftForm({
  organizerId,
  accommodationOptions,
  action
}: StartManualStayDraftFormProps) {
  const [selectedAccommodationId, setSelectedAccommodationId] = useState('');

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Brouillon manuel
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Sélectionne d’abord le centre</h1>
        <p className="text-sm text-slate-600">
          Un séjour créé manuellement doit être rattaché à un hébergement existant. Tu pourras encore le
          changer tant que le séjour reste en brouillon.
        </p>
      </div>

      <input type="hidden" name="organizerId" value={organizerId} />
      <AccommodationPicker
        options={accommodationOptions}
        value={selectedAccommodationId}
        onChange={setSelectedAccommodationId}
        name="selectedAccommodationId"
        searchPlaceholder="Rechercher par nom, ville ou région"
        emptyMessage="Aucun hébergement existant ne correspond à cette recherche."
      />

      <div className="flex justify-end">
        <button type="submit" className="organizer-btn-primary min-h-[44px]">
          Créer le brouillon
        </button>
      </div>
    </form>
  );
}
