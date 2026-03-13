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
