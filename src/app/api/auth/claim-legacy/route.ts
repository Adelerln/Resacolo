import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { upsertFamilyProfileFromRegistration } from '@/lib/account-profile/server';
import {
  findLegacyWpCustomerByEmail,
  markLegacyWpCustomerClaimed
} from '@/lib/legacy-wp/server';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

/**
 * Après définition du mot de passe (recovery), seed client_profiles depuis legacy_wp_customers.
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user?.id || !user.email) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const legacy = await findLegacyWpCustomerByEmail(user.email);
    if (!legacy) {
      return NextResponse.json({ ok: true, claimed: false });
    }

    await upsertFamilyProfileFromRegistration({
      userId: user.id,
      firstName: legacy.first_name || 'Famille',
      lastName: legacy.last_name || '',
      email: user.email.trim().toLowerCase(),
      phone: legacy.phone || '',
      addressLine1: legacy.address_line1 || '',
      addressLine2: legacy.address_line2 || '',
      postalCode: legacy.postal_code || '',
      city: legacy.city || '',
      country: legacy.country || 'France'
    });

    await markLegacyWpCustomerClaimed({ userId: user.id, email: user.email });

    return NextResponse.json({ ok: true, claimed: true });
  } catch (error) {
    console.error('[auth/claim-legacy] unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
