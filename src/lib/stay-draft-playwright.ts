import {
  type DraftTransportPriceDebug,
  type DraftTransportVariant,
  type ThalieSessionBaseline
} from '@/lib/stay-draft-import';

type PageWaitUntil = 'load' | 'domcontentloaded';

interface Page {
  evaluate<TArgs extends unknown[], TResult>(
    pageFunction: (...args: TArgs) => TResult,
    ...args: TArgs
  ): Promise<TResult>;
  locator(selector: string): PlaywrightLocator;
  waitForTimeout(timeoutMs: number): Promise<void>;
  waitForLoadState(state: 'load' | 'domcontentloaded'): Promise<void>;
  waitForNavigation(options?: { waitUntil?: PageWaitUntil; timeout?: number }): Promise<unknown>;
  keyboard: {
    press(key: string): Promise<unknown>;
  };
  url(): string;
  goto(
    url: string,
    options: {
      waitUntil: PageWaitUntil;
      timeout: number;
    }
  ): Promise<unknown>;
  goBack(options: { waitUntil: PageWaitUntil; timeout: number }): Promise<unknown>;
  content(): Promise<string>;
  waitForFunction<TResult, TArg>(
    pageFunction: (arg: TArg) => TResult,
    arg: TArg,
    options?: { timeout?: number }
  ): Promise<unknown>;
  waitForFunction<TResult>(
    pageFunction: () => TResult,
    options?: { timeout?: number }
  ): Promise<unknown>;
}

interface PlaywrightLocator {
  first(): PlaywrightLocator;
  nth(index: number): PlaywrightLocator;
  locator(selector: string): PlaywrightLocator;
  count(): Promise<number>;
  isVisible(): Promise<boolean>;
  click(options?: { timeout?: number }): Promise<void>;
  page(): Page;
  selectOption(
    option:
      | { index: number }
      | { value: string }
      | { label: string },
    options?: { timeout?: number }
  ): Promise<void>;
  textContent(): Promise<string | null>;
  evaluate<TElement extends Element, TArgs extends unknown[], TResult>(
    pageFunction: (element: TElement, ...args: TArgs) => TResult,
    ...args: TArgs
  ): Promise<TResult>;
  evaluateAll<TResult>(pageFunction: (elements: Element[]) => TResult): Promise<TResult>;
}

interface BrowserContext {
  newPage(): Promise<Page>;
  close(): Promise<void>;
  tracing: {
    start(options: { screenshots: boolean; snapshots: boolean }): Promise<void>;
    stop(options: { path: string }): Promise<void>;
  };
}

interface Browser {
  newContext(options?: Record<string, unknown>): Promise<BrowserContext>;
  close(): Promise<void>;
}

interface BrowserType {
  launch(options: { headless: boolean; slowMo: number }): Promise<Browser>;
}

const PLAYWRIGHT_TIMEOUT_MS = 30_000;
const PLAYWRIGHT_SCROLL_STEPS = 8;
const PLAYWRIGHT_MAX_CAROUSEL_CLICKS = 10;
const PLAYWRIGHT_MAX_IMAGE_CANDIDATE_CLICKS = 24;
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

export type DynamicStayPageSnapshot = {
  html: string;
  finalUrl: string;
  imageUrls: string[];
  videoUrls: string[];
  browserEngine: BrowserEngineName;
  transportVariants: DraftTransportVariant[];
  transportPriceDebug: DraftTransportPriceDebug[];
  transportDetected: boolean;
  /** Totaux « référence » (option ville index 0) par date — aligner les prix session sur le catalogue dynamique. */
  thalieSessionBaselines: ThalieSessionBaseline[];
};

type DynamicTransportDirection = 'outbound' | 'return' | 'generic';

type DynamicTransportOption = {
  index: number;
  value: string;
  label: string;
  selected: boolean;
};

type DynamicTransportSelect = {
  index: number;
  context: string;
  direction: DynamicTransportDirection;
  options: DynamicTransportOption[];
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

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

function shouldKeepImage(url: string): boolean {
  return /^https?:\/\//i.test(url) && !/(\.svg($|\?)|logo|icon|avatar|placeholder)/i.test(url);
}

function shouldKeepVideo(url: string): boolean {
  return /^https?:\/\//i.test(url) && /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|vimeo\.com\/|dailymotion\.com\/|loom\.com\/share\/|wistia\.|\.mp4(?:$|\?)|\.webm(?:$|\?)|\.mov(?:$|\?))/i.test(url);
}

function detectDynamicTransportDirection(context: string): DynamicTransportDirection | null {
  const key = simplifyForMatch(context);
  if (!key) return null;
  const hasTransport = /\btransport|acheminement|depart|retour|reprise\b/.test(key);
  const hasOutbound = /\baller|depart\b/.test(key);
  const hasReturn = /\bretour|reprise\b/.test(key);

  if (hasOutbound && !hasReturn) return 'outbound';
  if (hasReturn && !hasOutbound) return 'return';
  if (hasTransport) return 'generic';
  return null;
}

function normalizeDynamicTransportLabel(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value)
    .replace(/\u00A0/g, ' ')
    .replace(/\s*[\(\[]?\+?\s*[0-9][0-9\s.,]*\s*(?:€|euros?)[^\)\]]*[\)\]]?/gi, '')
    .replace(/\s*-\s*\+?\s*[0-9][0-9\s.,]*\s*(?:€|euros?)/gi, '')
    .replace(/^transport\s*(aller|retour)?\s*[:\-]\s*/i, '')
    .trim();
  if (!normalized) return null;
  const key = simplifyForMatch(normalized);
  if (!key) return null;
  if (
    ['choisir', 'selectionner', 'selectionnez', 'ville de depart', 'ville de retour', 'aucun transport', 'sans transport', 'tous'].some(
      (item) => key.includes(simplifyForMatch(item))
    )
  ) {
    return null;
  }
  return normalized;
}

async function readDynamicTransportSelects(page: Page): Promise<DynamicTransportSelect[]> {
  const raw = await page.locator('select').evaluateAll((elements: Element[]) => {
    const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

    return elements.map((element, index) => {
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
        node.closest('td,th,tr,div,fieldset,section,form')?.textContent?.slice(0, 1000) ?? ''
      );

      return {
        index,
        context: normalize([id, name, ariaLabel, title, className, linkedLabel, parentText].join(' ')),
        options: Array.from(node.options).map((option, optionIndex) => ({
          index: optionIndex,
          value: (option.value ?? '').trim(),
          label: normalize(option.textContent),
          selected: option.selected
        }))
      };
    });
  });

  return (raw as Array<{ index: number; context: string; options: DynamicTransportOption[] }>)
    .map((candidate) => ({
      ...candidate,
      direction: detectDynamicTransportDirection(candidate.context)
    }))
    .filter(
      (candidate): candidate is DynamicTransportSelect =>
        Boolean(candidate.direction) && candidate.options.length > 1
    );
}

async function setDynamicSelectOption(
  page: Page,
  selectIndex: number,
  option: DynamicTransportOption
): Promise<void> {
  const locator = page.locator('select').nth(selectIndex);
  if (option.value) {
    await locator.selectOption({ value: option.value }).catch(async () => {
      await locator.selectOption({ index: option.index });
    });
  } else {
    await locator.selectOption({ index: option.index });
  }

  await locator.evaluate((element: HTMLSelectElement, optionIndex: number) => {
    if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < element.options.length) {
      element.selectedIndex = optionIndex;
      element.value = element.options[optionIndex]?.value ?? element.value;
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
        $el.selectmenu?.('refresh');
      } catch {
        /* ignore */
      }
    }
  }, option.index);

  await page.waitForTimeout(900);
}

async function readDynamicTransportAmountCents(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const selectors = [
      '.tarif-label + .badge .sejour-tarif.active',
      '.tarif-label + .badge .sejour-tarif',
      '.badge .sejour-tarif.active',
      '.badge .sejour-tarif',
      '.sejour-tarif.active',
      '.sejour-tarif'
    ];

    const parseNumber = (raw: string) => {
      let value = raw.replace(/\s/g, '').replace(/\+/g, '');
      if (value.includes(',') && value.includes('.')) {
        value =
          value.lastIndexOf(',') > value.lastIndexOf('.')
            ? value.replace(/\./g, '').replace(',', '.')
            : value.replace(/,/g, '');
      } else if (value.includes(',')) {
        value = /,\d{1,2}$/.test(value) ? value.replace(',', '.') : value.replace(/,/g, '');
      } else {
        value = value.replace(/\.(?=\d{3}(?:\D|$))/g, '');
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
    };

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const text = (element.textContent ?? '').trim();
      if (!text) continue;
      const match = text.match(/([+-]?\s*\d[\d\s\.,]*)/);
      if (!match?.[1]) continue;
      const cents = parseNumber(match[1]);
      if (cents !== null && cents >= 0 && cents < 8_000_000) return cents;
    }
    return null;
  });
}

async function collectDynamicTransportVariants(page: Page): Promise<{
  transportVariants: DraftTransportVariant[];
  transportPriceDebug: DraftTransportPriceDebug[];
  transportDetected: boolean;
}> {
  const selects = await readDynamicTransportSelects(page);
  if (selects.length === 0) {
    return { transportVariants: [], transportPriceDebug: [], transportDetected: false };
  }

  const primary =
    selects.find((select) => select.direction === 'outbound') ??
    selects.find((select) => select.direction === 'generic') ??
    selects[0];

  const options = primary.options
    .map((option) => ({ ...option, normalizedLabel: normalizeDynamicTransportLabel(option.label) }))
    .filter((option) => Boolean(option.normalizedLabel));

  const debugRows: DraftTransportPriceDebug[] = [];
  const variants: DraftTransportVariant[] = [];

  for (const option of options) {
    try {
      await setDynamicSelectOption(page, primary.index, option);
      const amountCents = await readDynamicTransportAmountCents(page);
      const city = option.normalizedLabel ?? option.label;
      const row: DraftTransportPriceDebug = {
        variant_url: page.url(),
        departure_city: city,
        return_city: city,
        page_price_cents: amountCents,
        base_price_cents: null,
        amount_cents: amountCents,
        pricing_method: amountCents !== null ? 'absolute_price' : 'unresolved',
        confidence: amountCents !== null ? 'high' : 'low',
        reason: 'playwright-dynamic-transport',
        departure_label_raw: option.label,
        return_label_raw: option.label
      };
      debugRows.push(row);

      if (amountCents !== null) {
        variants.push({
          departure_city: city,
          return_city: city,
          amount_cents: amountCents,
          currency: 'EUR',
          source_url: page.url(),
          departure_label_raw: option.label,
          return_label_raw: option.label,
          page_price_cents: amountCents,
          base_price_cents: null,
          pricing_method: 'absolute_price',
          confidence: 'high',
          reason: 'playwright-dynamic-transport'
        });
      }
    } catch {
      // Ignore one option and continue.
    }
  }

  const deduped = new Map<string, DraftTransportVariant>();
  for (const variant of variants) {
    const key = simplifyForMatch(variant.departure_city);
    if (!key || deduped.has(key)) continue;
    deduped.set(key, variant);
  }

  return {
    transportVariants: Array.from(deduped.values()),
    transportPriceDebug: debugRows,
    transportDetected: true
  };
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

  return unique(urls.filter((url: string) => shouldKeepImage(url)));
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

  return unique(urls.filter((url: string) => shouldKeepVideo(url)));
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
  const videoDir = process.env.PLAYWRIGHT_IMPORT_VIDEO_DIR?.trim();
  return browser.newContext({
    viewport: { width: 1440, height: 1800 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0 Safari/537.36',
    ...(videoDir
      ? {
          recordVideo: {
            dir: videoDir,
            size: { width: 1440, height: 1800 }
          }
        }
      : {})
  });
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

    const transportResult = await collectDynamicTransportVariants(page);
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
      transportDetected: transportResult.transportDetected,
      thalieSessionBaselines: []
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

type PlaywrightRuntime = {
  chromium: BrowserType;
  firefox: BrowserType;
  webkit: BrowserType;
};

async function loadPlaywrightRuntime(): Promise<PlaywrightRuntime | null> {
  try {
    const dynamicImport = new Function('moduleName', 'return import(moduleName);') as (
      moduleName: string
    ) => Promise<unknown>;
    const runtime = (await dynamicImport('playwright')) as Partial<PlaywrightRuntime>;
    if (!runtime.chromium || !runtime.firefox || !runtime.webkit) {
      return null;
    }
    return runtime as PlaywrightRuntime;
  } catch (error) {
    console.warn('[playwright-import] package not available', {
      error: error instanceof Error ? error.message : 'unknown-error'
    });
    return null;
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
 * - `PLAYWRIGHT_IMPORT_VIDEO_DIR=/chemin` : vidéo MP4 du parcours (un fichier par contexte).
 * - `PLAYWRIGHT_VERBOSE_IMPORT=1` : logs résumés dans la console du serveur Next.
 */
export async function renderStayPageWithPlaywright(
  sourceUrl: string
): Promise<DynamicStayPageSnapshot | null> {
  const runtime = await loadPlaywrightRuntime();
  if (!runtime) {
    return null;
  }
  const { chromium, firefox, webkit } = runtime;

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
