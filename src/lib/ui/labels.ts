export function stayStatusLabel(status?: string | null) {
  switch (status) {
    case 'DRAFT':
      return 'Brouillon';
    case 'PENDING':
      return 'En validation';
    case 'PUBLISHED':
      return 'Publié';
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
    case 'NEAR_FULL':
      return 'Quasi complète';
    case 'CLOSED':
      return 'Fermée';
    default:
      return status ?? '-';
  }
}
