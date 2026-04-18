import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const FETCH_TIMEOUT_MS = 15_000;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url')?.trim() ?? '';
  if (!url || !isHttpUrl(url)) {
    return NextResponse.json({ error: 'URL image invalide.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; ResacoloDraftImageProxy/1.0; +https://resacolo.com)',
        accept: 'image/*,*/*;q=0.8'
      }
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Impossible de charger l'image distante (${upstream.status}).` },
        { status: upstream.status }
      );
    }

    const contentTypeHeader = upstream.headers.get('content-type');
    const contentType = contentTypeHeader ? contentTypeHeader.split(';')[0]?.toLowerCase() ?? '' : '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'La ressource distante n’est pas une image.' }, { status: 415 });
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=3600, s-maxage=3600'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    return NextResponse.json({ error: `Échec chargement image: ${message}` }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
