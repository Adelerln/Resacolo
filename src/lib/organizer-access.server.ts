import { cookies } from 'next/headers';
import {
  ORGANIZER_ACCESS_COOKIE_NAME,
  normalizeOrganizerAccessRole,
  type OrganizerAccessRole
} from '@/lib/organizer-access';

export function getOrganizerAccessRole(): OrganizerAccessRole {
  return normalizeOrganizerAccessRole(cookies().get(ORGANIZER_ACCESS_COOKIE_NAME)?.value);
}
