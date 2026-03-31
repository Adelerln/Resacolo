export type OrganizerOption = {
  id: string;
  name: string;
};

export const ORGANIZER_COOKIE_NAME = 'resacolo_selected_organizer_id';

export function withOrganizerQuery(path: string, organizerId?: string | null) {
  if (!organizerId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}organizerId=${encodeURIComponent(organizerId)}`;
}
