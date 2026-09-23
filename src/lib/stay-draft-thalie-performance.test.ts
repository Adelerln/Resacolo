import assert from 'node:assert/strict';
import test from 'node:test';
import { extractThalieOptionUrlPricing } from '@/lib/stay-draft-import';

test('loads transport cities concurrently with a limit of four and reuses the source page', async () => {
  const cities = ['Paris', 'Lyon', 'Marseille', 'Nice', 'Nantes', 'Bordeaux', 'Lille', 'Toulouse'];
  const html = `<table><tr><td>Transport aller</td><td><select name="PDTOPTVALUEID0">
    <option selected url="/source">DÉPOSE CENTRE</option>
    ${cities.map((city, i) => `<option url="/city-${i}">${city}</option>`).join('')}
    </select></td></tr></table><div itemprop="offers"><meta itemprop="price" content="790"></div>`;
  const originalFetch = globalThis.fetch;
  let active = 0;
  let peak = 0;
  const requested: string[] = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return new Response('<div itemprop="offers"><meta itemprop="price" content="890"></div>');
  };
  try {
    const result = await extractThalieOptionUrlPricing(html, 'https://www.thalie.eu/source');
    assert.equal(peak, 4);
    assert.equal(requested.length, cities.length);
    assert.equal(new Set(requested).size, cities.length);
    assert.ok(!requested.some((url) => url.endsWith('/source')));
    assert.equal(result.transportVariants.length, cities.length);
    assert.ok(result.transportVariants.every((option) => option.amount_cents === 20000));
  } finally { globalThis.fetch = originalFetch; }
});
