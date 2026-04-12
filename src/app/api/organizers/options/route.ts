import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type OrganizerOption = {
  id: string;
  name: string;
};

export const revalidate = 300;

export async function GET() {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('organizers')
    .select('id,name')
    .order('name', { ascending: true });

  if (error || !data) {
    return NextResponse.json({ organizers: [] as OrganizerOption[] }, { status: 200 });
  }

  const organizers = data
    .map((organizer) => ({
      id: organizer.id,
      name: organizer.name.trim()
    }))
    .filter((organizer) => organizer.name.length > 0);

  return NextResponse.json({ organizers });
}
