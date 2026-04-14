import type { Browser, BrowserContext, BrowserType, Page } from 'playwright';
import type { DraftTransportPriceDebug, DraftTransportVariant } from '@/lib/stay-draft-import';

const PLAYWRIGHT_TIMEOUT_MS = 30_000;
const PLAYWRIGHT_SCROLL_STEPS = 8;
const PLAYWRIGHT_MAX_CAROUSEL_CLICKS = 10;
const PLAYWRIGHT_MAX_IMAGE_CANDIDATE_CLICKS = 24;
const PLAYWRIGHT_SELECT_WAIT_MS = 2_200;
const PLAYWRIGHT_MAX_TRANSPORT_COMBINATIONS = 36;
const CAROUSEL_HINT_PATTERN =
  /\b(carrousel|carousel|slider|swiper|slick|splide|embla|flickity|glide|diaporama|galerie|mosaic|mosaique|lightgallery|fancybox|photos)\b/i;

function playwrightImportHeadless(): boolean {
  const headed =
    process.env.PLAYWRIGHT_HEADED === '1' ||
    process.env.PLAYWRIGHT_HEADED?.toLowerCase() === 'true' ||
    process.env.IMPORT_STAY_PLAYWRIGHT_HEADED === '1' ||
    process.env.IMPORT_STAY_PLAYWRIGHT_HEADED?.toLowerCase() === 'true';
  return !headed;
}

function playwrightImportSlowMo(): number {
  const raw = process.env.PLAYWRIGHT_SLOW_MO_MS?.trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), 2000);
}

type BrowserEngineName = 'chromium' | 'firefox' | 'webkit';
type TransportDirection = 'outbound' | 'return' | 'generic';

type RawTransportSelectOption = {
  index: number;
  value: string;
  rawLabel: string;
  selected: boolean;
};

type RawTransportSelectCandidate = {
  selectIndex: number;
  context: string;
  options: RawTransportSelectOption[];
};

type TransportSelectOption = RawTransportSelectOption & {
  label: string | null;
  isBaseReference: boolean;
};

type TransportSelectCandidate = {
  selectIndex: number;
  direction: TransportDirection;
  context: string;
  options: TransportSelectOption[];
  selectedOption: TransportSelectOption | null;
};

type ObservedTransportCombination = {
  departureCity: string;
  returnCity: string;
  departureLabelRaw: string | null;
  returnLabelRaw: string | null;
  pagePriceCents: number | null;
  observationKind: 'same-city-pair' | 'cartesian' | 'outbound-with-default-return' | 'return-with-default-outbound' | 'single-select';
};

export type DynamicStayPageSnapshot = {
  html: string;
  finalUrl: string;
  imageUrls: string[];
  videoUrls: string[];
  browserEngine: BrowserEngineName;
  transportVariants: DraftTransportVariant[];
  transportPriceDebug: DraftTransportPriceDebug[];
  transportDetected: boolean;
};

const TRANSPORT_BASE_REFERENCE_KEYS = [
  'depose centre',
  'depose sur le centre',
  'depose au centre',
  'reprise centre',
  'reprise sur le centre',
  'reprise au centre',
  'sans transport',
  'sans acheminement',
  'sans convoyage',
  'rendez vous sur place',
  'rdv sur place',
  'sur place',
  'depart centre',
  'retour centre'
];

const TRANSPORT_PLACEHOLDER_KEYS = [
  'choisir',
  'selectionner',
  'selectionnez',
  'sélectionner',
  'sélectionnez',
  'ville de depart',
  'ville depart',
  'villes de depart',
  'ville de retour',
  'transport aller',
  'transport retour',
  'aucun transport',
  'sans transport',
  'none',
  'tous'
];

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function simplifyForMatch(value: string | null | undefined): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function shouldKeepImage(url: string): boolean {
  return /^https?:\/\//i.test(url) && !/(\.svg($|\?)|logo|icon|avatar|placeholder)/i.test(url);
}

function shouldKeepVideo(url: string): boolean {
  return /^https?:\/\//i.test(url) && /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|vimeo\.com\/|dailymotion\.com\/|loom\.com\/share\/|wistia\.|\.mp4(?:$|\?)|\.webm(?:$|\?)|\.mov(?:$|\?))/i.test(url);
}

function sanitizeTransportLabel(value: string | null | undefined): string {
  if (!value) return '';
  return normalizeWhitespace(value)
    .replace(/\u00A0/g, ' ')
    .replace(/\s*[\(\[]?\+?\s*[0-9][0-9\s.,]*\s*(?:€|euros?)[^\)\]]*[\)\]]?/gi, '')
    .replace(/\s*-\s*\+?\s*[0-9][0-9\s.,]*\s*(?:€|euros?)/gi, '')
    .replace(/^transport\s*(aller|retour)?\s*[:\-]\s*/i, '')
    .trim();
}

function normalizeTransportCityLabel(value: string | null | undefined): string | null {
  const normalized = sanitizeTransportLabel(value);
  if (!normalized) return null;
  const key = simplifyForMatch(normalized);
  if (!key) return null;
  if (TRANSPORT_PLACEHOLDER_KEYS.some((item) => key.includes(simplifyForMatch(item)))) {
    return null;
  }
  return normalized.length > 80 ? normalized.slice(0, 80).trim() : normalized;
}

function isBaseTransportReference(value: string | null | undefined): boolean {
  const key = simplifyForMatch(value);
  if (!key) return false;
  return TRANSPORT_BASE_REFERENCE_KEYS.some((candidate) => key.includes(simplifyForMatch(candidate)));
}

function detectTransportDirection(context: string): TransportDirection | null {
  const key = simplifyForMatch(context);
  if (!key) return null;

  const hasTransport = /\btransport|acheminement|depart|départ|retour|reprise\b/i.test(key);
  const hasOutbound = /\baller|depart|départ|outbound\b/i.test(key);
  const hasReturn = /\bretour|arrivee|arrivée|reprise|inbound\b/i.test(key);

  if (hasOutbound && !hasReturn) return 'outbound';
  if (hasReturn && !hasOutbound) return 'return';
  if (hasTransport) return 'generic';

  // Menus type colonies / réservation (ex. name="PDTOPTVALUEID1") sans libellé « transport » à proximité
  if (/pdtopt|optvalueid|optvalue|hubville|villedepart|ville_depart|choixville/i.test(key)) {
    return 'generic';
  }

  return null;
}

function parseFrenchAmount(
  rawValue: string | null | undefined,
  minEur: number = 30,
  maxEur: number = 20_000
): number | null {
  if (!rawValue) return null;
  let normalized = normalizeWhitespace(rawValue).replace(/[^\d.,]/g, '');
  if (!normalized) return null;

  if (normalized.includes('.') && normalized.includes(',')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = /,\d{1,2}$/.test(normalized)
      ? normalized.replace(',', '.')
      : normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(/\.(?=\d{3}(?:\.|$))/g, '');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount);
  if (rounded < minEur || rounded > maxEur) return null;
  return rounded;
}

/** Montants visibles sur la fiche (dont supplément transport, base 0 €). */
function findPriceInText(text: string): number | null {
  const fromMatch = text.match(/\b(?:à\s+partir\s+de|dès)\s*([0-9][0-9\s.,]*)\s*(?:€|euros?)/i);
  if (fromMatch?.[1]) {
    const amount = parseFrenchAmount(fromMatch[1], 0, 20_000);
    if (amount !== null) return amount;
  }

  const genericPattern = /\b([0-9][0-9\s.,]{1,})\s*(?:€|euros?)/gi;
  let match: RegExpExecArray | null = null;
  while ((match = genericPattern.exec(text)) !== null) {
    const amount = parseFrenchAmount(match[1], 0, 20_000);
    if (amount !== null) return amount;
  }

  return null;
}

function makeTransportVariantKey(departureCity: string, returnCity: string): string {
  return `${simplifyForMatch(departureCity)}|${simplifyForMatch(returnCity)}`;
}

function scoreTransportVariant(row: DraftTransportVariant): number {
  let score = 0;
  if (typeof row.amount_cents === 'number') score += 100;
  if (row.confidence === 'high') score += 30;
  if (row.confidence === 'medium') score += 20;
  if (row.confidence === 'low') score += 10;
  return score;
}

function dedupeTransportVariants(rows: DraftTransportVariant[]): DraftTransportVariant[] {
  const map = new Map<string, DraftTransportVariant>();

  for (const row of rows) {
    const departureCity = normalizeTransportCityLabel(row.departure_city) ?? row.departure_city;
    const returnCity = normalizeTransportCityLabel(row.return_city) ?? row.return_city;
    if (!departureCity && !returnCity) continue;
    const safeDeparture = departureCity || returnCity;
    const safeReturn = returnCity || departureCity;
    const key = makeTransportVariantKey(safeDeparture, safeReturn);
    const existing = map.get(key);
    const candidate = {
      ...row,
      departure_city: safeDeparture,
      return_city: safeReturn
    };

    if (!existing || scoreTransportVariant(candidate) > scoreTransportVariant(existing)) {
      map.set(key, candidate);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.departure_city}|${a.return_city}`.localeCompare(`${b.departure_city}|${b.return_city}`, 'fr')
  );
}

export function shouldUsePlaywrightForDynamicImages(html: string, extractedImageCount: number): boolean {
  if (extractedImageCount < 4) return true;
  return CAROUSEL_HINT_PATTERN.test(html);
}

async function collectPageImageUrls(page: Page): Promise<string[]> {
  const urls = await page.evaluate(() => {
    const values = new Set<string>();

    const normalizeUrl = (raw: string | null | undefined) => {
      if (!raw) return null;
      try {
        return new URL(raw, window.location.href).toString();
      } catch {
        return null;
      }
    };

    const addUrl = (raw: string | null | undefined) => {
      const resolved = normalizeUrl(raw);
      if (resolved) values.add(resolved);
    };

    document.querySelectorAll('picture source').forEach((source) => {
      const srcset = source.getAttribute('srcset');
      if (srcset) {
        const last = srcset.split(',').pop()?.trim().split(/\s+/)[0] ?? null;
        addUrl(last);
      }
    });

    document.querySelectorAll('img').forEach((img) => {
      const element = img as HTMLImageElement;
      addUrl(element.currentSrc || element.src);
      addUrl(element.getAttribute('data-src'));
      addUrl(element.getAttribute('data-lazy-src'));
      addUrl(element.getAttribute('data-original'));
      addUrl(element.getAttribute('data-full'));
      addUrl(element.getAttribute('data-image'));
      addUrl(element.getAttribute('data-zoom-image'));
      addUrl(element.getAttribute('srcset')?.split(',').pop()?.trim().split(' ')[0] ?? null);
      addUrl(element.getAttribute('data-srcset')?.split(',').pop()?.trim().split(' ')[0] ?? null);

      const linkedAnchor = element.closest('a');
      if (linkedAnchor) {
        addUrl(linkedAnchor.getAttribute('href'));
        addUrl(linkedAnchor.getAttribute('data-src'));
        addUrl(linkedAnchor.getAttribute('data-full'));
        addUrl(linkedAnchor.getAttribute('data-fancybox'));
      }
    });

    document.querySelectorAll<HTMLElement>('[style*="background-image"]').forEach((node) => {
      const style = node.style.backgroundImage;
      const match = style.match(/url\(["']?(.*?)["']?\)/i);
      if (match?.[1]) addUrl(match[1]);
    });

    document.querySelectorAll('a[href]').forEach((anchor) => {
      const href = (anchor as HTMLAnchorElement).getAttribute('href');
      if (href && /\.(?:jpe?g|png|webp|gif|avif)(?:$|\?)/i.test(href)) {
        addUrl(href);
      }
    });

    return Array.from(values);
  });

  return unique(urls.filter((url) => shouldKeepImage(url)));
}

async function collectPageVideoUrls(page: Page): Promise<string[]> {
  const urls = await page.evaluate(() => {
    const values = new Set<string>();

    const normalizeUrl = (raw: string | null | undefined) => {
      if (!raw) return null;
      try {
        return new URL(raw, window.location.href).toString();
      } catch {
        return null;
      }
    };

    const videoLike = (href: string) =>
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|vimeo\.com\/|dailymotion\.com\/|loom\.com\/share\/|wistia\.|\.mp4(?:$|\?)|\.webm(?:$|\?)|\.mov(?:$|\?))/i.test(
        href
      );

    const addUrlsFromJavaScriptBlob = (blob: string) => {
      const re = /https?:\/\/[^'")\s]+/gi;
      let match: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((match = re.exec(blob)) !== null) {
        const trimmed = match[0].replace(/[),;.]+$/, '');
        try {
          const href = new URL(trimmed).href;
          if (videoLike(href)) values.add(href);
        } catch {
          /* ignore */
        }
      }
    };

    const addUrl = (raw: string | null | undefined) => {
      const trimmed = raw?.trim() ?? '';
      if (!trimmed) return;
      if (/^javascript:/i.test(trimmed)) {
        addUrlsFromJavaScriptBlob(trimmed);
        return;
      }
      const resolved = normalizeUrl(raw);
      if (resolved) values.add(resolved);
    };

    document
      .querySelectorAll('a[href], iframe[src], video[src], source[src], [data-video], [data-video-url], [data-youtube], [data-vimeo]')
      .forEach((node) => {
        const element = node as HTMLElement;
        addUrl(element.getAttribute('href'));
        addUrl(element.getAttribute('src'));
        addUrl(element.getAttribute('data-video'));
        addUrl(element.getAttribute('data-video-url'));
        addUrl(element.getAttribute('data-youtube'));
        addUrl(element.getAttribute('data-vimeo'));
        addUrl(element.getAttribute('data-src'));
        addUrl(element.getAttribute('data-url'));
      });

    return Array.from(values);
  });

  return unique(urls.filter((url) => shouldKeepVideo(url)));
}

async function safeClick(locator: ReturnType<Page['locator']>) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const current = locator.nth(index);
    try {
      if (!(await current.isVisible())) continue;
      await current.click({ timeout: 1_500 });
      await current.page().waitForTimeout(250);
    } catch {
      // Ignore individual click failures.
    }
  }
}

async function acceptCookieBanners(page: Page) {
  const selectors = [
    'button:has-text("Accepter")',
    'button:has-text("Tout accepter")',
    'button:has-text("J’accepte")',
    `button:has-text("J'accepte")`,
    'button:has-text("Accept all")',
    '[aria-label*="accept" i]',
    '[id*="accept" i]'
  ];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible()) {
        await locator.click({ timeout: 1_500 });
        await page.waitForTimeout(300);
        return;
      }
    } catch {
      // Ignore banner failures.
    }
  }
}

async function scrollPage(page: Page) {
  for (let index = 0; index < PLAYWRIGHT_SCROLL_STEPS; index += 1) {
    await page.evaluate(
      ({ step, totalSteps }: { step: number; totalSteps: number }) => {
        const maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const ratio = totalSteps <= 1 ? 1 : step / (totalSteps - 1);
        window.scrollTo({ top: Math.round(maxScroll * ratio), behavior: 'instant' });
      },
      { step: index, totalSteps: PLAYWRIGHT_SCROLL_STEPS }
    );
    await page.waitForTimeout(350);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

async function expandCarousels(page: Page) {
  const nextSelectors = [
    '.swiper-button-next',
    '.slick-next',
    '.splide__arrow--next',
    '.flickity-button.next',
    '.glide__arrow--right',
    '[data-carousel-next]',
    '[data-slide="next"]',
    '[aria-label*="suivant" i]',
    '[aria-label*="next" i]',
    'button:has-text("Suivant")',
    'button:has-text("Next")',
    'button[class*="next" i]',
    '.carousel-control-next',
    '.carousel .next'
  ];

  for (let turn = 0; turn < PLAYWRIGHT_MAX_CAROUSEL_CLICKS; turn += 1) {
    for (const selector of nextSelectors) {
      await safeClick(page.locator(selector));
    }
  }
}

async function closeOpenImageOverlays(page: Page) {
  const closeSelectors = [
    '.fancybox__button--close',
    '.mfp-close',
    '.lg-close',
    '.pswp__button--close',
    '.glightbox-clean .gclose',
    '[aria-label*="fermer" i]',
    '[aria-label*="close" i]',
    'button:has-text("Fermer")',
    'button:has-text("Close")'
  ];

  for (const selector of closeSelectors) {
    await safeClick(page.locator(selector));
  }

  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(150);
}

async function clickLocatorAndRecover(page: Page, locator: ReturnType<Page['locator']>) {
  const beforeUrl = page.url();
  try {
    await locator.click({ timeout: 1_500 });
  } catch {
    return;
  }

  await page.waitForTimeout(400);

  if (page.url() !== beforeUrl) {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    await acceptCookieBanners(page);
    await scrollPage(page);
  }
}

async function exploreClickableGalleryImages(page: Page): Promise<string[]> {
  const discovered = new Set<string>(await collectPageImageUrls(page));
  const candidateSelectors = [
    '[data-fancybox]',
    '[data-lightbox]',
    '[data-glightbox]',
    'button img',
    '[role="button"] img',
    '[class*="thumb"] img',
    '[class*="thumbnail"] img',
    '[class*="gallery"] img',
    '[class*="carousel"] img',
    '.swiper-slide img',
    '.slick-slide img',
    '.splide__slide img'
  ];

  for (const selector of candidateSelectors) {
    const locator = page.locator(selector);
    const count = Math.min(await locator.count(), PLAYWRIGHT_MAX_IMAGE_CANDIDATE_CLICKS);

    for (let index = 0; index < count; index += 1) {
      const current = locator.nth(index);
      try {
        if (!(await current.isVisible())) continue;
      } catch {
        continue;
      }

      await clickLocatorAndRecover(page, current);
      for (const url of await collectPageImageUrls(page)) {
        discovered.add(url);
      }
      await closeOpenImageOverlays(page);
    }
  }

  return Array.from(discovered);
}

async function createContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 1440, height: 1800 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0 Safari/537.36'
  });
}

async function extractCurrentPriceCentsFromPage(page: Page): Promise<number | null> {
  const transportCents = await page.evaluate(() => {
    const selectors = [
      'span.sejour-tarif.active',
      'span.sejour-tarif',
      '.tarif-transport .badge',
      '.tarif-transport'
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const raw = (element.textContent ?? '').trim();
      if (!raw) continue;
      const match = raw.match(/([+-]?\s*\d[\d\s\.,]*)\s*(?:€|eur(?:os)?)?/i);
      if (!match) continue;
      let num = match[1].replace(/\s/g, '').replace(/\+/g, '');
      if (num.includes(',') && num.includes('.')) {
        num =
          num.lastIndexOf(',') > num.lastIndexOf('.')
            ? num.replace(/\./g, '').replace(',', '.')
            : num.replace(/,/g, '');
      } else if (num.includes(',')) {
        num = /,\d{1,2}$/.test(num) ? num.replace(',', '.') : num.replace(/,/g, '');
      } else {
        num = num.replace(/\.(?=\d{3}(?:\D|$))/g, '');
      }
      const value = Number(num);
      if (Number.isFinite(value) && value >= 0 && value < 80_000) {
        return Math.round(value * 100);
      }
    }
    return null;
  });

  if (transportCents !== null) {
    return transportCents;
  }

  const priceCandidates = await page.evaluate(() => {
    const values: string[] = [];
    const selectors = [
      '[itemprop="price"]',
      '[class*="prix"]',
      '[id*="prix"]',
      '[class*="price"]',
      '[id*="price"]',
      '[class*="tarif"]',
      '[id*="tarif"]',
      '[class*="montant"]',
      '[data-price]',
      '[data-testid*="price" i]',
      '[class*="supplement"]',
      '[id*="supplement"]',
      '.prix',
      '.price'
    ];

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const element = node as HTMLElement;
        const parts = [
          element.getAttribute('content') ?? '',
          element.getAttribute('value') ?? '',
          element.innerText ?? element.textContent ?? ''
        ]
          .join(' ')
          .trim();
        if (parts) values.push(parts);
      });
    }

    values.push(document.body.innerText ?? '');
    return values.slice(0, 50);
  });

  for (const candidate of priceCandidates) {
    const amount = findPriceInText(candidate);
    if (amount !== null) return Math.round(amount * 100);
  }

  return null;
}

async function readTransportSelects(page: Page): Promise<TransportSelectCandidate[]> {
  const raw = await page.locator('select').evaluateAll((elements) => {
    const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

    return elements.map((element, selectIndex) => {
      const node = element as HTMLSelectElement;
      const id = normalize(node.id);
      const name = normalize(node.getAttribute('name'));
      const ariaLabel = normalize(node.getAttribute('aria-label'));
      const title = normalize(node.getAttribute('title'));
      const className = normalize(node.className);
      const linkedLabel = id
        ? normalize(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent)
        : '';
      const parentText = normalize(
        node.closest('td,th,tr,div,fieldset,section,form')?.textContent?.slice(0, 1400) ?? ''
      );

      return {
        selectIndex,
        context: normalize([id, name, ariaLabel, title, className, linkedLabel, parentText].join(' ')),
        options: Array.from(node.options).map((option, index) => ({
          index,
          value: option.value ?? '',
          rawLabel: normalize(option.textContent),
          selected: option.selected
        }))
      };
    });
  });

  const candidates: TransportSelectCandidate[] = [];
  for (const candidate of raw as RawTransportSelectCandidate[]) {
    const direction = detectTransportDirection(candidate.context);
    if (!direction) continue;

    const options = candidate.options
      .map<TransportSelectOption>((option) => ({
        ...option,
        label: normalizeTransportCityLabel(option.rawLabel),
        isBaseReference: isBaseTransportReference(option.rawLabel)
      }))
      .filter((option) => Boolean(option.label) || option.isBaseReference || option.selected);

    if (options.length === 0) continue;

    candidates.push({
      selectIndex: candidate.selectIndex,
      direction,
      context: candidate.context,
      options,
      selectedOption: options.find((option) => option.selected) ?? options[0] ?? null
    });
  }

  return candidates;
}

function pickTransportSelects(candidates: TransportSelectCandidate[]): {
  outbound: TransportSelectCandidate | null;
  returnSelect: TransportSelectCandidate | null;
} {
  const scoreCandidate = (candidate: TransportSelectCandidate) =>
    candidate.options.filter((option) => option.label).length * 10 +
    candidate.options.filter((option) => option.isBaseReference).length * 3;

  const outboundDirect =
    candidates
      .filter((candidate) => candidate.direction === 'outbound')
      .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0] ?? null;
  const returnDirect =
    candidates
      .filter((candidate) => candidate.direction === 'return')
      .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0] ?? null;
  const generic = candidates
    .filter((candidate) => candidate.direction === 'generic')
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  const outbound = outboundDirect ?? generic[0] ?? null;
  const returnSelect = returnDirect ?? (generic.length > 1 ? generic[1] : null);

  return {
    outbound,
    returnSelect:
      outbound && returnSelect && outbound.selectIndex === returnSelect.selectIndex ? null : returnSelect
  };
}

function chooseBaseOption(candidate: TransportSelectCandidate | null): TransportSelectOption | null {
  if (!candidate) return null;
  return (
    candidate.options.find((option) => option.isBaseReference) ??
    candidate.selectedOption ??
    candidate.options.find((option) => option.label) ??
    candidate.options[0] ??
    null
  );
}

async function setSelectOptionByIndex(
  page: Page,
  selectIndex: number,
  optionIndex: number
): Promise<void> {
  const locator = page.locator('select').nth(selectIndex);
  await locator.selectOption({ index: optionIndex });
  await locator.evaluate((element: HTMLSelectElement, idx: number) => {
    if (Number.isInteger(idx) && idx >= 0 && idx < element.options.length) {
      element.selectedIndex = idx;
      element.value = element.options[idx]?.value ?? element.value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    const w = window as unknown as {
      jQuery?: (el: Element) => {
        val?: (v: string) => void;
        trigger?: (ev: string) => void;
        selectmenu?: (cmd: string) => void;
      };
    };
    const $el = w.jQuery?.(element);
    if ($el?.val && $el.trigger) {
      try {
        $el.val(element.value);
        $el.trigger('change');
        $el.trigger('selectmenuchange');
      } catch {
        /* ignore */
      }
      try {
        $el.selectmenu?.('refresh');
      } catch {
        /* ignore */
      }
    }
  }, optionIndex);
  await page.waitForTimeout(PLAYWRIGHT_SELECT_WAIT_MS);
}

async function applyTransportSelection(
  page: Page,
  outbound: { selectIndex: number; optionIndex: number } | null,
  returnSelect: { selectIndex: number; optionIndex: number } | null
) {
  if (outbound) {
    await setSelectOptionByIndex(page, outbound.selectIndex, outbound.optionIndex);
  }
  if (returnSelect) {
    await setSelectOptionByIndex(page, returnSelect.selectIndex, returnSelect.optionIndex);
  }
}

async function observeTransportCombination(
  page: Page,
  outboundSelect: TransportSelectCandidate | null,
  returnSelect: TransportSelectCandidate | null,
  outboundOption: TransportSelectOption | null,
  returnOption: TransportSelectOption | null,
  baseOutbound: TransportSelectOption | null,
  baseReturn: TransportSelectOption | null,
  observationKind: ObservedTransportCombination['observationKind']
): Promise<ObservedTransportCombination | null> {
  await applyTransportSelection(
    page,
    outboundSelect && baseOutbound
      ? { selectIndex: outboundSelect.selectIndex, optionIndex: baseOutbound.index }
      : null,
    returnSelect && baseReturn
      ? { selectIndex: returnSelect.selectIndex, optionIndex: baseReturn.index }
      : null
  );

  await applyTransportSelection(
    page,
    outboundSelect && outboundOption
      ? { selectIndex: outboundSelect.selectIndex, optionIndex: outboundOption.index }
      : null,
    returnSelect && returnOption
      ? { selectIndex: returnSelect.selectIndex, optionIndex: returnOption.index }
      : null
  );

  await page.waitForTimeout(450);

  let departureCity =
    outboundOption?.label ?? returnOption?.label ?? baseOutbound?.label ?? baseReturn?.label ?? null;
  let returnCity =
    returnOption?.label ?? outboundOption?.label ?? baseReturn?.label ?? baseOutbound?.label ?? null;

  // Un seul menu « ville de départ » : la base (ex. dépose centre / 0 €) est le point d’arrivée, pas la même ville.
  if (outboundOption && !returnOption) {
    returnCity = baseReturn?.label ?? baseOutbound?.label ?? returnCity;
  } else if (returnOption && !outboundOption) {
    departureCity = baseOutbound?.label ?? baseReturn?.label ?? departureCity;
  }

  if (!departureCity && !returnCity) return null;

  return {
    departureCity: departureCity ?? returnCity ?? '',
    returnCity: returnCity ?? departureCity ?? '',
    departureLabelRaw: outboundOption?.rawLabel ?? baseOutbound?.rawLabel ?? null,
    returnLabelRaw: returnOption?.rawLabel ?? baseReturn?.rawLabel ?? null,
    pagePriceCents: await extractCurrentPriceCentsFromPage(page),
    observationKind
  };
}

function buildTransportRowsFromObserved(
  sourceUrl: string,
  observed: ObservedTransportCombination[],
  explicitBasePriceCents: number | null,
  hasExplicitBaseReference: boolean
): { transportVariants: DraftTransportVariant[]; transportPriceDebug: DraftTransportPriceDebug[] } {
  const observedPrices = observed
    .map((row) => row.pagePriceCents)
    .filter((value): value is number => typeof value === 'number');
  const inferredBasePriceCents =
    typeof explicitBasePriceCents === 'number'
      ? explicitBasePriceCents
      : observedPrices.length > 0
        ? Math.min(...observedPrices)
        : null;
  const baseReason = hasExplicitBaseReference
    ? 'playwright-explicit-base'
    : typeof inferredBasePriceCents === 'number'
      ? 'playwright-min-observed-base'
      : 'playwright-no-base';

  const debugRows: DraftTransportPriceDebug[] = observed.map((row) => {
    let amountCents: number | null = null;
    let pricingMethod: DraftTransportPriceDebug['pricing_method'] = 'unresolved';
    let confidence: DraftTransportPriceDebug['confidence'] = 'low';

    if (typeof row.pagePriceCents === 'number' && typeof inferredBasePriceCents === 'number') {
      const delta = row.pagePriceCents - inferredBasePriceCents;
      if (delta >= 0) {
        amountCents = delta;
        pricingMethod = 'delta_from_base';
        confidence = hasExplicitBaseReference
          ? 'high'
          : row.observationKind === 'same-city-pair' || row.observationKind === 'single-select'
            ? 'medium'
            : 'low';
      }
    }

    return {
      variant_url: sourceUrl,
      departure_city: row.departureCity,
      return_city: row.returnCity,
      page_price_cents: row.pagePriceCents,
      base_price_cents: inferredBasePriceCents,
      amount_cents: amountCents,
      pricing_method: pricingMethod,
      confidence,
      reason: `${baseReason}:${row.observationKind}`,
      departure_label_raw: row.departureLabelRaw,
      return_label_raw: row.returnLabelRaw
    };
  });

  const variants = dedupeTransportVariants(
    debugRows
      .filter((row) => row.departure_city || row.return_city)
      .map((row) => ({
        departure_city: row.departure_city ?? row.return_city ?? '',
        return_city: row.return_city ?? row.departure_city ?? '',
        amount_cents: row.amount_cents,
        currency: 'EUR' as const,
        source_url: sourceUrl,
        departure_label_raw: row.departure_label_raw ?? null,
        return_label_raw: row.return_label_raw ?? null,
        page_price_cents: row.page_price_cents,
        base_price_cents: row.base_price_cents,
        pricing_method: row.pricing_method,
        confidence: row.confidence,
        reason: row.reason
      }))
  );

  return {
    transportVariants: variants,
    transportPriceDebug: debugRows
  };
}

function transportOptionCityKeys(options: TransportSelectOption[]): Set<string> {
  return new Set(
    options
      .filter((option) => Boolean(option.label) && !option.isBaseReference)
      .map((option) => simplifyForMatch(option.label ?? ''))
      .filter(Boolean)
  );
}

/** Deux menus avec les mêmes villes (aller + retour) : éviter le produit cartésien. */
function mirroredCitySelectLists(
  outbound: TransportSelectCandidate,
  returnSelect: TransportSelectCandidate
): boolean {
  const a = transportOptionCityKeys(outbound.options);
  const b = transportOptionCityKeys(returnSelect.options);
  if (a.size < 2 || b.size < 2) return false;
  let overlap = 0;
  Array.from(a).forEach((key) => {
    if (b.has(key)) overlap += 1;
  });
  return overlap / Math.min(a.size, b.size) >= 0.65;
}

async function collectTransportVariants(page: Page): Promise<{
  transportVariants: DraftTransportVariant[];
  transportPriceDebug: DraftTransportPriceDebug[];
  transportDetected: boolean;
}> {
  const candidates = await readTransportSelects(page);
  const { outbound, returnSelect } = pickTransportSelects(candidates);
  if (!outbound && !returnSelect) {
    return {
      transportVariants: [],
      transportPriceDebug: [],
      transportDetected: false
    };
  }

  const baseOutbound = chooseBaseOption(outbound);
  const baseReturn = chooseBaseOption(returnSelect);

  await applyTransportSelection(
    page,
    outbound && baseOutbound ? { selectIndex: outbound.selectIndex, optionIndex: baseOutbound.index } : null,
    returnSelect && baseReturn
      ? { selectIndex: returnSelect.selectIndex, optionIndex: baseReturn.index }
      : null
  );

  const explicitBasePriceCents = await extractCurrentPriceCentsFromPage(page);
  const hasExplicitBaseReference = Boolean(baseOutbound?.isBaseReference || baseReturn?.isBaseReference);
  const observed = new Map<string, ObservedTransportCombination>();

  const pushObserved = (value: ObservedTransportCombination | null) => {
    if (!value) return;
    const key = makeTransportVariantKey(value.departureCity, value.returnCity);
    if (!key) return;
    const existing = observed.get(key);
    if (!existing || (existing.pagePriceCents === null && value.pagePriceCents !== null)) {
      observed.set(key, value);
    }
  };

  const normalizedOutboundOptions =
    outbound?.options.filter((option) => option.label && !option.isBaseReference) ?? [];
  const normalizedReturnOptions =
    returnSelect?.options.filter((option) => option.label && !option.isBaseReference) ?? [];

  if (outbound && returnSelect) {
    const returnByLabel = new Map(
      normalizedReturnOptions
        .map((option) => [simplifyForMatch(option.label), option] as const)
        .filter(([label]) => Boolean(label))
    );

    const overlappingPairs = normalizedOutboundOptions
      .map((outboundOption) => {
        const key = simplifyForMatch(outboundOption.label);
        return {
          outboundOption,
          returnOption: key ? returnByLabel.get(key) ?? null : null
        };
      })
      .filter(
        (pair): pair is { outboundOption: TransportSelectOption; returnOption: TransportSelectOption } =>
          Boolean(pair.returnOption)
      );

    const mirroredLists = mirroredCitySelectLists(outbound, returnSelect);

    if (mirroredLists) {
      const sameCityPairs =
        overlappingPairs.length > 0
          ? overlappingPairs
          : normalizedOutboundOptions
              .map((outboundOption) => {
                const key = simplifyForMatch(outboundOption.label ?? '');
                const returnOption = key ? returnByLabel.get(key) ?? null : null;
                return returnOption
                  ? { outboundOption, returnOption }
                  : null;
              })
              .filter(
                (pair): pair is { outboundOption: TransportSelectOption; returnOption: TransportSelectOption } =>
                  Boolean(pair)
              );

      if (sameCityPairs.length > 0) {
        for (const pair of sameCityPairs) {
          pushObserved(
            await observeTransportCombination(
              page,
              outbound,
              returnSelect,
              pair.outboundOption,
              pair.returnOption,
              baseOutbound,
              baseReturn,
              'same-city-pair'
            )
          );
        }
      } else {
        const defaultReturn =
          baseReturn ??
          returnSelect.options.find((option) => option.isBaseReference) ??
          returnSelect.options[0] ??
          null;
        if (defaultReturn) {
          for (const outboundOption of normalizedOutboundOptions) {
            pushObserved(
              await observeTransportCombination(
                page,
                outbound,
                returnSelect,
                outboundOption,
                defaultReturn,
                baseOutbound,
                baseReturn,
                'outbound-with-default-return'
              )
            );
          }
        }
      }
    } else if (overlappingPairs.length > 0) {
      for (const pair of overlappingPairs) {
        pushObserved(
          await observeTransportCombination(
            page,
            outbound,
            returnSelect,
            pair.outboundOption,
            pair.returnOption,
            baseOutbound,
            baseReturn,
            'same-city-pair'
          )
        );
      }
    } else if (normalizedOutboundOptions.length * normalizedReturnOptions.length <= PLAYWRIGHT_MAX_TRANSPORT_COMBINATIONS) {
      for (const outboundOption of normalizedOutboundOptions) {
        for (const returnOption of normalizedReturnOptions) {
          pushObserved(
            await observeTransportCombination(
              page,
              outbound,
              returnSelect,
              outboundOption,
              returnOption,
              baseOutbound,
              baseReturn,
              'cartesian'
            )
          );
        }
      }
    } else {
      for (const outboundOption of normalizedOutboundOptions) {
        pushObserved(
          await observeTransportCombination(
            page,
            outbound,
            returnSelect,
            outboundOption,
            baseReturn,
            baseOutbound,
            baseReturn,
            'outbound-with-default-return'
          )
        );
      }
      for (const returnOption of normalizedReturnOptions) {
        pushObserved(
          await observeTransportCombination(
            page,
            outbound,
            returnSelect,
            baseOutbound,
            returnOption,
            baseOutbound,
            baseReturn,
            'return-with-default-outbound'
          )
        );
      }
    }
  } else {
    const singleSelect = outbound ?? returnSelect;
    const singleBase = baseOutbound ?? baseReturn;
    const singleOptions = singleSelect?.options.filter((option) => option.label && !option.isBaseReference) ?? [];

    for (const option of singleOptions) {
      pushObserved(
        await observeTransportCombination(
          page,
          singleSelect ?? null,
          null,
          option,
          null,
          singleBase,
          null,
          'single-select'
        )
      );
    }
  }

  return {
    ...buildTransportRowsFromObserved(page.url(), Array.from(observed.values()), explicitBasePriceCents, hasExplicitBaseReference),
    transportDetected: true
  };
}

async function snapshotWithEngine(
  playwright: Record<BrowserEngineName, BrowserType>,
  browserEngine: BrowserEngineName,
  sourceUrl: string
): Promise<DynamicStayPageSnapshot | null> {
  const launcher = playwright[browserEngine];
  const browser = await launcher.launch({
    headless: playwrightImportHeadless(),
    slowMo: playwrightImportSlowMo()
  });

  let context: Awaited<ReturnType<Browser['newContext']>> | null = null;
  const traceDir = process.env.PLAYWRIGHT_TRACE_DIR?.trim() ?? '';
  let tracingStarted = false;

  try {
    context = await createContext(browser);
    if (traceDir) {
      await context.tracing.start({ screenshots: true, snapshots: true });
      tracingStarted = true;
    }

    const page = await context.newPage();
    await page.goto(sourceUrl, { waitUntil: 'load', timeout: PLAYWRIGHT_TIMEOUT_MS });
    await page.waitForTimeout(1_000);
    await acceptCookieBanners(page);
    await scrollPage(page);
    await expandCarousels(page);
    await page.waitForTimeout(1_500);

    const transportResult = await collectTransportVariants(page).catch((error) => {
      console.warn('[playwright-import] dynamic transport failed', {
        sourceUrl,
        browserEngine,
        error: error instanceof Error ? error.message : 'unknown-error'
      });
      return {
        transportVariants: [],
        transportPriceDebug: [],
        transportDetected: false
      };
    });
    const html = await page.content();
    const imageUrls = unique([
      ...(await collectPageImageUrls(page)),
      ...(await exploreClickableGalleryImages(page))
    ]);
    const videoUrls = await collectPageVideoUrls(page);
    const finalUrl = page.url();

    if (tracingStarted && traceDir) {
      const tracePath = `${traceDir.replace(/\/+$/, '')}/stay-import-${browserEngine}-${Date.now()}.zip`;
      await context.tracing.stop({ path: tracePath });
      tracingStarted = false;
      console.info('[playwright-import] Trace enregistrée (ouvrir avec npx playwright show-trace)', {
        tracePath,
        sourceUrl,
        browserEngine
      });
    }

    await context.close();
    context = null;

    if (process.env.PLAYWRIGHT_VERBOSE_IMPORT === '1') {
      console.info('[playwright-import] snapshot', {
        browserEngine,
        sourceUrl,
        htmlLength: html.length,
        imageCount: imageUrls.length,
        videoCount: videoUrls.length,
        transportVariantCount: transportResult.transportVariants.length,
        transportDetected: transportResult.transportDetected
      });
    }

    return {
      html,
      finalUrl,
      imageUrls,
      videoUrls,
      browserEngine,
      transportVariants: transportResult.transportVariants,
      transportPriceDebug: transportResult.transportPriceDebug,
      transportDetected: transportResult.transportDetected
    };
  } catch (error) {
    if (tracingStarted && context && traceDir) {
      const tracePath = `${traceDir.replace(/\/+$/, '')}/stay-import-ERROR-${browserEngine}-${Date.now()}.zip`;
      try {
        await context.tracing.stop({ path: tracePath });
        console.warn('[playwright-import] Trace enregistrée après erreur', {
          tracePath,
          message: error instanceof Error ? error.message : String(error)
        });
      } catch {
        /* ignore */
      }
      tracingStarted = false;
    }
    throw error;
  } finally {
    if (context) {
      await context.close().catch(() => undefined);
    }
    await browser.close();
  }
}

/**
 * Rend la page séjour dans un navigateur réel pour images carrousel, vidéos et transport dynamique.
 *
 * **Voir ce que fait Playwright (dev local)** :
 * - `PWDEBUG=1` avant `npm run dev` : inspecteur Playwright (pause / pas à pas).
 * - `PLAYWRIGHT_HEADED=1` ou `IMPORT_STAY_PLAYWRIGHT_HEADED=1` : fenêtre visible (pas headless).
 * - `PLAYWRIGHT_SLOW_MO_MS=250` : ralentit les actions.
 * - `PLAYWRIGHT_TRACE_DIR=/chemin/vers/dossier` : enregistre un fichier `.zip` ; puis
 *   `npx playwright show-trace /chemin/…/stay-import-chromium-….zip`.
 * - `PLAYWRIGHT_VERBOSE_IMPORT=1` : logs résumés dans la console du serveur Next.
 */
export async function renderStayPageWithPlaywright(
  sourceUrl: string
): Promise<DynamicStayPageSnapshot | null> {
  const { chromium, firefox, webkit } = await import('playwright');

  const engines: BrowserEngineName[] = ['chromium', 'firefox', 'webkit'];
  for (const engine of engines) {
    try {
      const snapshot = await snapshotWithEngine({ chromium, firefox, webkit }, engine, sourceUrl);
      if (
        snapshot &&
        (snapshot.html.length > 0 ||
          snapshot.imageUrls.length > 0 ||
          snapshot.videoUrls.length > 0 ||
          snapshot.transportVariants.length > 0 ||
          snapshot.transportDetected)
      ) {
        return snapshot;
      }
    } catch (error) {
      console.warn('[playwright-import] engine failed', {
        engine,
        sourceUrl,
        error: error instanceof Error ? error.message : 'unknown-error'
      });
    }
  }

  return null;
}
