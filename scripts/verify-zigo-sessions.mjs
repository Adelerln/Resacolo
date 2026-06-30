import { readFileSync } from 'fs';
import { load } from 'cheerio';

const mod = await import('../src/lib/stay-draft-import.ts');
const {
  parseSessionLabelToItem,
  parseZigotoursDateDepartOption,
  fetchZigotoursDepartureData,
  extractStayData
} = mod;

const label = '08/07/2026 au 22/07/2026';
console.log('parseSessionLabelToItem:', parseSessionLabelToItem(label));
console.log(
  'parseZigotoursDateDepartOption:',
  parseZigotoursDateDepartOption({
    label,
    dtDb: '07/08/2026',
    dtFn: '07/22/2026'
  })
);

const rows = JSON.parse(readFileSync('.zigo-getDepartDetails.json', 'utf8'));
const uniqueDates = new Map();
for (const row of rows) {
  const item = parseZigotoursDateDepartOption({
    label: String(row.date ?? ''),
    dtDb: String(row.dtDb ?? ''),
    dtFn: String(row.dtFn ?? '')
  });
  if (item?.start_date && item.end_date) {
    uniqueDates.set(`${item.start_date}|${item.end_date}`, item);
  }
}
console.log('unique sessions from fixture rows:', uniqueDates.size, Array.from(uniqueDates.keys()));

const snippetHtml =
  '<select id="dateDepart"><option value="0">Dates du séjour</option><option data-dtdb="07/08/2026" data-dtFn="07/22/2026">08/07/2026 au 22/07/2026</option></select>';
const $ = load(snippetHtml);
const opt = $('#dateDepart option').eq(1);
console.log(
  'dom option:',
  parseZigotoursDateDepartOption({
    label: opt.text(),
    dtDb: opt.attr('data-dtdb'),
    dtFn: opt.attr('data-dtfn')
  })
);

const html = readFileSync('.zigo-debug.html', 'utf8');
const extracted = extractStayData(html, 'https://www.zigotours.com/tarifsejour/419');
console.log('extractStayData sessions:', extracted.sessionsJson);

const fetchResult = await fetchZigotoursDepartureData(html, 'https://www.zigotours.com/tarifsejour/419');
console.log('fetchZigotours:', {
  reason: fetchResult.reason,
  rowCount: fetchResult.rowCount,
  sessions: fetchResult.data?.sessions?.length,
  sample: fetchResult.data?.sessions?.[0]
});
