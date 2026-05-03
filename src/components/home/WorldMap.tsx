'use client';

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';

type ParsedCountryPath = {
  id: string;
  name: string;
  matchKeys: string[];
  d: string;
};

type HoveredCountry = {
  id: string;
  name: string;
  leftPercent: number;
  topPercent: number;
};

type ParsedSvgMap = {
  width: number;
  height: number;
  paths: ParsedCountryPath[];
};

type WorldMapProps = {
  activeCountryNames?: string[] | null;
  hasActiveFrance?: boolean;
  onFranceSelect?: () => void;
  onCountrySelect?: (countryName: string, countryId: string) => void;
};

const frenchRegionNames =
  typeof Intl !== 'undefined'
    ? new Intl.DisplayNames(['fr'], { type: 'region' })
    : null;

function parseSvgDimension(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCountryKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function translateCountryName(id: string, fallbackName: string) {
  try {
    const translatedName = frenchRegionNames?.of(id.toUpperCase())?.trim();
    return translatedName && translatedName !== id.toUpperCase() ? translatedName : fallbackName;
  } catch {
    return fallbackName;
  }
}

function buildHoveredCountry(
  eventTarget: SVGPathElement,
  country: ParsedCountryPath,
  svgWidth: number,
  svgHeight: number
): HoveredCountry {
  const { x, y, width } = eventTarget.getBBox();

  return {
    id: country.id,
    name: country.name,
    leftPercent: ((x + width / 2) / svgWidth) * 100,
    topPercent: (y / svgHeight) * 100
  };
}

function buildHoveredCountryFromMouse(
  event: ReactMouseEvent<SVGPathElement>,
  country: ParsedCountryPath
): HoveredCountry {
  const svgRect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();

  if (!svgRect || svgRect.width === 0 || svgRect.height === 0) {
    return {
      id: country.id,
      name: country.name,
      leftPercent: 50,
      topPercent: 50
    };
  }

  return {
    id: country.id,
    name: country.name,
    leftPercent: ((event.clientX - svgRect.left) / svgRect.width) * 100,
    topPercent: ((event.clientY - svgRect.top) / svgRect.height) * 100
  };
}

export function WorldMap({
  activeCountryNames,
  hasActiveFrance = true,
  onFranceSelect,
  onCountrySelect
}: WorldMapProps) {
  const [svgMap, setSvgMap] = useState<ParsedSvgMap | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<HoveredCountry | null>(null);
  const activeCountryKeySet = new Set((activeCountryNames ?? []).map((country) => normalizeCountryKey(country)));
  const hasAvailability = activeCountryNames != null;

  useEffect(() => {
    let isCancelled = false;

    async function loadMap() {
      try {
        const response = await fetch('/image/accueil/world.svg');
        if (!response.ok) {
          throw new Error(`Impossible de charger world.svg (${response.status})`);
        }

        const rawSvg = await response.text();
        const parser = new DOMParser();
        const document = parser.parseFromString(rawSvg, 'image/svg+xml');
        const root = document.querySelector('svg');

        if (!root) {
          throw new Error('Balise svg introuvable dans world.svg');
        }

        const width = parseSvgDimension(root.getAttribute('width'), 1010);
        const height = parseSvgDimension(root.getAttribute('height'), 666);

        const paths = Array.from(document.querySelectorAll('path'))
          .map((pathElement) => {
            const d = pathElement.getAttribute('d');
            const name = pathElement.getAttribute('title');
            const id = pathElement.getAttribute('id');

            if (!d || !name || !id) {
              return null;
            }

            return {
              id,
              name: translateCountryName(id, name.trim()),
              matchKeys: Array.from(
                new Set([normalizeCountryKey(id), normalizeCountryKey(name.trim()), normalizeCountryKey(translateCountryName(id, name.trim()))])
              ).filter(Boolean),
              d
            } satisfies ParsedCountryPath;
          })
          .filter((country): country is ParsedCountryPath => Boolean(country));

        if (!isCancelled) {
          setSvgMap({ width, height, paths });
        }
      } catch (error) {
        console.error('Erreur chargement carte monde', error);
      }
    }

    loadMap();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (!svgMap) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500 sm:min-h-[420px] md:min-h-[560px] lg:min-h-[730px]">
        Chargement de la carte…
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[1110px]">
      <svg
        viewBox={`0 0 ${svgMap.width} ${svgMap.height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Carte du monde interactive par pays"
      >
        {svgMap.paths.map((country) => {
          const isFrance = country.id === 'FR';
          const isActive = isFrance
            ? !hasAvailability || hasActiveFrance
            : !hasAvailability || country.matchKeys.some((key) => activeCountryKeySet.has(key));
          const isHovered = isActive && hoveredCountry?.id === country.id;

          return (
            <path
              key={country.id}
              d={country.d}
              fill={isActive ? (isHovered ? '#f5c273' : '#f7931e') : '#dbe4ee'}
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeLinejoin="round"
              className={isActive ? 'cursor-pointer transition-colors duration-150' : 'transition-colors duration-150'}
              onMouseEnter={(event) => {
                if (!isActive) return;
                setHoveredCountry(buildHoveredCountryFromMouse(event, country));
              }}
              onMouseMove={(event) => {
                if (!isActive) return;
                setHoveredCountry(buildHoveredCountryFromMouse(event, country));
              }}
              onFocus={(event) =>
                isActive
                  ? setHoveredCountry(buildHoveredCountry(event.currentTarget, country, svgMap.width, svgMap.height))
                  : setHoveredCountry(null)
              }
              onMouseLeave={() => setHoveredCountry(null)}
              onBlur={() => setHoveredCountry(null)}
              onClick={() => {
                if (!isActive) return;
                if (isFrance) {
                  onFranceSelect?.();
                } else if (onCountrySelect) {
                  onCountrySelect(country.name, country.id);
                } else {
                  const href = `/sejours?q=${encodeURIComponent(country.name)}&categories=etranger`;
                  window.location.href = href;
                }
              }}
              onKeyDown={(event) => {
                if (!isActive) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (isFrance) {
                    onFranceSelect?.();
                  } else if (onCountrySelect) {
                    onCountrySelect(country.name, country.id);
                  } else {
                    window.location.href = `/sejours?q=${encodeURIComponent(country.name)}&categories=etranger`;
                  }
                }
              }}
              role={isActive ? 'button' : undefined}
              tabIndex={isActive ? 0 : -1}
              aria-label={isActive ? country.name : `${country.name} indisponible`}
            />
          );
        })}
      </svg>

      {hoveredCountry ? (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: `${hoveredCountry.leftPercent}%`,
            top: `${hoveredCountry.topPercent}%`,
            transform: 'translate(-50%, calc(-100% - 8px))'
          }}
        >
          <div className="relative max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-[#232323] shadow-lg sm:max-w-none sm:whitespace-nowrap sm:px-4 sm:py-2.5 sm:text-[15px]">
            {hoveredCountry.name}
            <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-white" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
