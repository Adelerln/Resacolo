import { NextResponse } from 'next/server';
import { deriveHomeDestinationAvailability } from '@/lib/home-destination-availability';
import { getStays } from '@/lib/stays';

export const runtime = 'nodejs';
export const revalidate = 3600;

export async function GET() {
  const stays = await getStays();
  return NextResponse.json(deriveHomeDestinationAvailability(stays));
}
