import { NextResponse } from 'next/server';
import { getOrganizerExperienceRange } from '@/lib/organizer-experience-range';

export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET() {
  const range = await getOrganizerExperienceRange();
  return NextResponse.json(range);
}
