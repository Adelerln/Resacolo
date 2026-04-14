export function stayStatusLabel(status?: string | null) {
  switch (status) {
    case 'DRAFT':
      return 'Brouillon';
    case 'PUBLISHED':
      return 'Publié';
    case 'HIDDEN':
      return 'Masqué';
    case 'ARCHIVED':
      return 'Archivé';
    default:
      return status ?? '-';
  }
}

export function stayStatusBadgeClassName(status?: string | null) {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-800';
    case 'PUBLISHED':
      return 'bg-emerald-100 text-emerald-800';
    case 'HIDDEN':
      return 'bg-amber-100 text-amber-900';
    case 'ARCHIVED':
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function stayDraftStatusLabel(status?: string | null) {
  const s = (status ?? '').toLowerCase();
  switch (s) {
    case 'validated':
      return 'Validé (import)';
    case 'draft':
      return 'Brouillon import';
    default:
      return status ? `Import : ${status}` : 'Import';
  }
}

export function sessionStatusLabel(status?: string | null) {
  switch (status) {
    case 'OPEN':
      return 'Ouverte';
    case 'FULL':
      return 'Complète';
    case 'COMPLETED':
      return 'Terminée';
    case 'ARCHIVED':
      return 'Archivée';
    default:
      return status ?? '-';
  }
}

export function accommodationStatusLabel(status?: string | null) {
  switch (status) {
    case 'TO_VALIDATE':
      return 'À valider';
    case 'VALIDATED':
      return 'Validé';
    case 'DRAFT':
      return 'Brouillon';
    case 'ARCHIVED':
      return 'Archivé';
    default:
      return status ?? '-';
  }
}

export function accommodationStatusBadgeClassName(status?: string | null) {
  switch (status) {
    case 'TO_VALIDATE':
      return 'bg-amber-100 text-amber-800';
    case 'VALIDATED':
      return 'bg-emerald-100 text-emerald-800';
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700';
    case 'ARCHIVED':
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
