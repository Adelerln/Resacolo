import assert from 'node:assert/strict';
import test from 'node:test';
import { extractThalieCancellationInsurance } from '@/lib/stay-draft-import';

function page(insured: boolean, city = 'Paris') {
  return `<html><body><table>
    <tr><td>Transport aller</td><td><select name="PDTOPTVALUEID0"><option selected value="${city}">${city}</option></select></td></tr>
    <tr><td>Assurance</td><td><select name="PDTOPTVALUEID2">
      <option value="base" url="base" ${insured ? '' : 'selected'}>ASSURANCE DE BASE</option>
      <option value="annulation" url="annulation" ${insured ? 'selected' : ''}>ASSURANCE ANNULATION</option>
    </select></td></tr></table><div itemprop="offers"><span class="PBSalesPrice">${insured ? '823' : '790'},00 €</span></div></body></html>`;
}

test('imports only the cancellation supplement, not the full stay price', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(page(String(url).endsWith('/annulation')));
  try {
    const options = await extractThalieCancellationInsurance(page(false), 'https://www.thalie.eu/base');
    assert.equal(options.length, 1);
    assert.equal(options[0].price, 33);
    assert.equal(options[0].amount_cents, 3300);
    assert.equal(options[0].option_kind, 'insurance');
  } finally { globalThis.fetch = originalFetch; }
});

test('rejects a price difference when transport changes between insurance variants', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const insured = String(url).endsWith('/annulation');
    return new Response(page(insured, insured ? 'Lyon' : 'Paris'));
  };
  try {
    assert.deepEqual(await extractThalieCancellationInsurance(page(false), 'https://www.thalie.eu/base'), []);
  } finally { globalThis.fetch = originalFetch; }
});
