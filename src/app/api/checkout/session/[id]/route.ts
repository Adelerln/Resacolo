import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ checkoutId: params.id });
}
