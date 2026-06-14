import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatMnemosStaffRole } from '@/lib/mnemos-display';
import type { Database } from '@/types/supabase';

export type MnemosInternalAssigneeOption = {
  userId: string;
  displayLabel: string;
};

function readUserDisplayName(metadata: Record<string, unknown> | undefined, email: string | null) {
  const fullName =
    (typeof metadata?.full_name === 'string' && metadata.full_name.trim()) ||
    (typeof metadata?.name === 'string' && metadata.name.trim()) ||
    '';
  if (fullName) return fullName;
  if (email) return email;
  return 'Utilisateur';
}

export async function loadMnemosInternalAssignees(
  supabase: SupabaseClient<Database>
): Promise<MnemosInternalAssigneeOption[]> {
  const { data: staff, error } = await supabase.from('staff_users').select('user_id, role').order('role');
  if (error) throw new Error(error.message);

  const rows = staff ?? [];
  const options = await Promise.all(
    rows.map(async (row) => {
      const { data } = await supabase.auth.admin.getUserById(row.user_id);
      const metadata = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const name = readUserDisplayName(metadata, data.user?.email ?? null);
      return {
        userId: row.user_id,
        displayLabel: `${name} (${formatMnemosStaffRole(row.role)})`
      };
    })
  );

  return options.sort((left, right) => left.displayLabel.localeCompare(right.displayLabel, 'fr'));
}
