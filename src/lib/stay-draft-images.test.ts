import assert from 'node:assert/strict';
import test from 'node:test';
import { extractStayData, selectBestStayImages } from '@/lib/stay-draft-import';

test('image extraction prioritizes the linked original and largest srcset over the thumbnail', () => {
  const html = '<html><body><a href="/photo-original.png"><img src="/photo-small.png" srcset="/photo-medium.png 600w, /photo-large.png 1600w"></a></body></html>';
  assert.deepEqual(extractStayData(html, 'https://example.com/stay').images.slice(0, 3), [
    'https://example.com/photo-original.png',
    'https://example.com/photo-large.png',
    'https://example.com/photo-small.png'
  ]);
});

test('selection does not add a rejected thumbnail back to fill the gallery', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const small = String(url).includes('small');
    const buffer = Buffer.alloc(small ? 2000 : 250000, small ? 1 : 2);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
    buffer.writeUInt32BE(small ? 160 : 1600, 16);
    buffer.writeUInt32BE(small ? 100 : 1000, 20);
    return new Response(buffer, { headers: { 'content-type': 'image/png' } });
  };
  try {
    const selected = await selectBestStayImages(
      '<a href="/photo-original.png"><img src="/photo-small.png" alt="Séjour cinéma"></a>',
      'https://example.com/stay',
      ['https://example.com/photo-small.png'],
      { title: 'Séjour cinéma' }
    );
    assert.deepEqual(selected, ['https://example.com/photo-original.png']);
  } finally { globalThis.fetch = originalFetch; }
});
