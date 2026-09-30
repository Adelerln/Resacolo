import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** Domaines images organisateurs / médias autorisés (hors SSRF). */
const ALLOWED_HOST_SUFFIXES = [
  'resacolo.com',
  'supabase.co',
  'images.unsplash.com',
  'thalie.eu',
  'www.thalie.eu',
  'choisirsacolo.fr',
  'www.choisirsacolo.fr',
  'cesl.fr',
  'www.cesl.fr',
  'zigotours.com',
  'www.zigotours.com',
  'aventures-vacances-energie.com',
  'www.aventures-vacances-energie.com',
  'cei-voyage.fr',
  'www.cei-voyage.fr',
  'colos.chic-planet.fr',
  'chic-planet.fr',
  'eole-loisirs.com',
  'www.eole-loisirs.com',
  'eterpa.fr',
  'www.eterpa.fr',
  'colosdubonheur.fr',
  'www.colosdubonheur.fr'
];

function normalizeHost(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

function isAllowedHostname(hostname: string) {
  const host = normalizeHost(hostname);
  if (!host || host === 'localhost' || host.endsWith('.local')) return false;
  return ALLOWED_HOST_SUFFIXES.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function isPrivateIp(ip: string) {
  const value = ip.toLowerCase();
  if (value === '::1' || value === '0.0.0.0') return true;
  if (value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')) return true;

  const parts = value.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

async function assertPublicResolvableHost(hostname: string) {
  const host = normalizeHost(hostname);
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new Error('Hôte image interdit.');
    }
    return;
  }

  const records = await lookup(host, { all: true, verbatim: true });
  if (!records.length) {
    throw new Error('Hôte image introuvable.');
  }
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error('Hôte image interdit.');
  }
}

function parseImageUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (!isAllowedHostname(parsed.hostname)) return null;
  return parsed;
}

async function fetchAllowedImage(startUrl: URL, signal: AbortSignal) {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicResolvableHost(current.hostname);

    const upstream = await fetch(current.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; ResacoloDraftImageProxy/1.0; +https://resacolo.com)',
        accept: 'image/*,*/*;q=0.8'
      }
    });

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location');
      if (!location) {
        throw new Error('Redirection image invalide.');
      }
      const nextUrl = parseImageUrl(new URL(location, current).toString());
      if (!nextUrl) {
        throw new Error('Redirection vers un domaine non autorisé.');
      }
      current = nextUrl;
      continue;
    }

    return { upstream, finalUrl: current };
  }

  throw new Error('Trop de redirections image.');
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  const canUseProxy =
    session.role === 'ORGANISATEUR' ||
    session.role === 'ADMIN' ||
    session.role === 'ADMIN_SALES' ||
    session.role === 'MNEMOS';
  if (!canUseProxy) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const rawUrl = new URL(req.url).searchParams.get('url')?.trim() ?? '';
  const parsedUrl = parseImageUrl(rawUrl);
  if (!parsedUrl) {
    return NextResponse.json({ error: 'URL image non autorisée.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const { upstream } = await fetchAllowedImage(parsedUrl, controller.signal);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Impossible de charger l'image distante (${upstream.status}).` },
        { status: upstream.status }
      );
    }

    const contentTypeHeader = upstream.headers.get('content-type');
    const contentType = contentTypeHeader
      ? contentTypeHeader.split(';')[0]?.toLowerCase() ?? ''
      : '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'La ressource distante n’est pas une image.' }, { status: 415 });
    }

    const contentLength = Number(upstream.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image trop volumineuse.' }, { status: 413 });
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image trop volumineuse.' }, { status: 413 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'private, max-age=300',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    const status = /interdit|non autoris/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: `Échec chargement image: ${message}` }, { status });
  } finally {
    clearTimeout(timeout);
  }
}
