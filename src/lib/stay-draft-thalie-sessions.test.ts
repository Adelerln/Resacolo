import assert from 'node:assert/strict';
import test from 'node:test';
import { extractThalieParentSessions, extractThalieParentContent } from '@/lib/stay-draft-import';

const sourceUrl = 'https://www.thalie.eu/mangakas-automne-c2x42821264';
const sourceHtml = '<input name="HVParentID" value="41099446">';

test('Thalie recovers dates when direct access is blocked and Reader HTML has no dates', async () => {
  const originalFetch = globalThis.fetch;
  const formats: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://www.thalie.eu/')) return new Response('', { status: 403 });
    assert.ok(url.includes('ItmID=41099446'));
    const format = new Headers(init?.headers).get('x-respond-with') ?? '';
    formats.push(format);
    return new Response(format === 'markdown'
      ? '# MANGAKAS AUTOMNE\n790,00 €\nDATES : du 18 au 24 octobre 2026'
      : `<html><body><div class="PBSalesPrice">790,00 €</div>${'Transport '.repeat(70)}</body></html>`);
  };
  try {
    const sessions = await extractThalieParentSessions(sourceHtml, sourceUrl);
    assert.deepEqual(formats, ['html', 'markdown']);
    assert.equal(sessions?.length, 1);
    assert.equal(sessions[0].start_date, '2026-10-18');
    assert.equal(sessions[0].end_date, '2026-10-24');
    assert.equal(sessions[0].price, 790);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Thalie reports missing dates instead of inventing a session from the URL', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('No dates available', { status: 503 });
  try {
    await assert.rejects(extractThalieParentSessions(sourceHtml, sourceUrl), /Reader sessions/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Thalie recovers gallery images from Reader without banners, buttons or duplicate photos', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith('https://www.thalie.eu/')) return new Response('', { status: 403 });
    const format = new Headers(init?.headers).get('x-respond-with');
    return new Response(format === 'markdown'
      ? [
          '![Bandeau](https://www.thalie.eu/Files/banner.png)',
          '# MANGAKAS AUTOMNE',
          '790,00 € — du 18 au 24 octobre 2026',
          '![Réserver](https://www.thalie.eu/Files/RESERVER.png)',
          '![Atelier](http://www.thalie.eu/Files/atelier.jpg)',
          '![Atelier](https://www.thalie.eu/Files/atelier.jpg)',
          '![Plage](https://www.thalie.eu/Files/plage.jpg)'
        ].join('\n')
      : `<html><body>${'Transport '.repeat(70)}</body></html>`);
  };
  try {
    const content = await extractThalieParentContent(sourceHtml, sourceUrl);
    assert.deepEqual(content?.images, [
      'https://www.thalie.eu/Files/atelier.jpg',
      'https://www.thalie.eu/Files/plage.jpg'
    ]);
    assert.equal(content?.sessions[0].start_date, '2026-10-18');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
