import { cookies } from 'next/headers';
import {
  ORGANIZER_ACCESS_COOKIE_NAME,
  normalizeOrganizerAccessRole,
  type OrganizerAccessRole
} from '@/lib/organizer-access';

export async function getOrganizerAccessRole(): Promise<OrganizerAccessRole> {
  const cookieStore = await cookies();
  return normalizeOrganizerAccessRole(cookieStore.get(ORGANIZER_ACCESS_COOKIE_NAME)?.value);
}
