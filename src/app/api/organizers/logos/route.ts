import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type OrganizerLogo = {
  id: string;
  name: string;
  logoUrl: string;
};

export const revalidate = 600;

export async function GET() {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('organizers')
    .select('id,name,logo_path')
    .order('name', { ascending: true });

  if (error || !data) {
    return NextResponse.json({ logos: [] }, { status: 200 });
  }

  const sorted = [...data].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', 'fr', { sensitivity: 'base' })
  );

  const unique = sorted.reduce((acc, org) => {
    const key = (org.name ?? '').trim().toLowerCase();
    if (!key || acc.has(key)) return acc;
    acc.set(key, org);
    return acc;
  }, new Map<string, (typeof sorted)[number]>());

  const logos = (
    await Promise.all(
      [...unique.values()]
        .filter((org) => org.logo_path)
        .map(async (org) => {
          const path = org.logo_path as string;
          const { data: signed } = await supabase.storage
            .from('organizer-logo')
            .createSignedUrl(path, 60 * 15);

          const signedUrl = signed?.signedUrl;
          if (signedUrl) {
            return { id: org.id, name: org.name ?? '', logoUrl: signedUrl };
          }

          const publicUrl = supabase.storage.from('organizer-logo').getPublicUrl(path).data.publicUrl;
          if (!publicUrl) return null;

          return { id: org.id, name: org.name ?? '', logoUrl: publicUrl };
        })
    )
  ).filter((item): item is OrganizerLogo => Boolean(item));

  return NextResponse.json({ logos });
}
