'use client';

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useRouter } from 'next/navigation';

type ParsedRegionPath = {
  id: string;
  name: string;
  d: string;
  href: string;
  labelX: number | null;
  labelY: number | null;
};

type HoveredRegion = {
  id: string;
  name: string;
  href: string;
  leftPercent: number;
  topPercent: number;
};

type ParsedSvgMap = {
  width: number;
  height: number;
  paths: ParsedRegionPath[];
};

const CURRENT_REGION_HREFS: Record<string, string> = {
  FRHDF: '/sejours?region=hauts-de-france',
  FRGES: '/sejours?region=grand-est',
  FRPAC: '/sejours?region=provence-alpes-cote-d-azur',
  FRARA: '/sejours?region=auvergne-rhone-alpes',
  FRBFC: '/sejours?region=bourgogne-franche-comte',
  FROCC: '/sejours?region=occitanie',
  FRPDL: '/sejours?region=pays-de-la-loire',
  FRBRE: '/sejours?region=bretagne',
  FRNOR: '/sejours?region=normandie',
  FR20R: '/sejours?region=corse',
  FRNAQ: '/sejours?region=nouvelle-aquitaine',
  FRCVL: '/sejours?region=centre-val-de-loire',
  FRIDF: '/sejours?region=ile-de-france'
};

const DISPLAY_REGION_NAMES: Record<string, string> = {
  FRHDF: 'Hauts-de-France',
  FRGES: 'Grand Est',
  FRPAC: "Provence-Alpes-Côte d'Azur",
  FRARA: 'Auvergne-Rhône-Alpes',
  FRBFC: 'Bourgogne-Franche-Comté',
  FROCC: 'Occitanie',
  FRPDL: 'Pays de la Loire',
  FRBRE: 'Bretagne',
  FRNOR: 'Normandie',
  FR20R: 'Corse',
  FRNAQ: 'Nouvelle-Aquitaine',
  FRCVL: 'Centre-Val de Loire',
  FRIDF: 'Ile-de-France'
};

function parseSvgDimension(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRegionName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildHoveredRegion(
  eventTarget: SVGPathElement,
  region: ParsedRegionPath,
  svgWidth: number,
  svgHeight: number
): HoveredRegion {
  const { x, y, width } = eventTarget.getBBox();
  const leftPercent = region.labelX != null ? (region.labelX / svgWidth) * 100 : ((x + width / 2) / svgWidth) * 100;
  const topPercent = region.labelY != null ? (region.labelY / svgHeight) * 100 : (y / svgHeight) * 100;

  return {
    id: region.id,
    name: region.name,
    href: region.href,
    leftPercent,
    topPercent
  };
}

function buildHoveredRegionFromMouse(event: ReactMouseEvent<SVGPathElement>, region: ParsedRegionPath): HoveredRegion {
  const svgRect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();

  if (!svgRect || svgRect.width === 0 || svgRect.height === 0) {
    return {
      id: region.id,
      name: region.name,
      href: region.href,
      leftPercent: 50,
      topPercent: 50
    };
  }

  return {
    id: region.id,
    name: region.name,
    href: region.href,
    leftPercent: ((event.clientX - svgRect.left) / svgRect.width) * 100,
    topPercent: ((event.clientY - svgRect.top) / svgRect.height) * 100
  };
}

export function FranceRegionsMap() {
  const router = useRouter();
  const [svgMap, setSvgMap] = useState<ParsedSvgMap | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<HoveredRegion | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMap() {
      try {
        const response = await fetch('/image/accueil/fr.svg');
        if (!response.ok) {
          throw new Error(`Impossible de charger fr.svg (${response.status})`);
        }

        const rawSvg = await response.text();
        const parser = new DOMParser();
        const document = parser.parseFromString(rawSvg, 'image/svg+xml');
        const root = document.querySelector('svg');

        if (!root) {
          throw new Error('Balise svg introuvable dans fr.svg');
        }

        const width = parseSvgDimension(root.getAttribute('width'), 1000);
        const height = parseSvgDimension(root.getAttribute('height'), 960);
        const labelPointsById = new Map<string, { x: number; y: number }>();

        Array.from(document.querySelectorAll('#label_points circle')).forEach((labelPoint) => {
          const id = labelPoint.getAttribute('id');
          const x = Number.parseFloat(labelPoint.getAttribute('cx') ?? '');
          const y = Number.parseFloat(labelPoint.getAttribute('cy') ?? '');

          if (!id || Number.isNaN(x) || Number.isNaN(y)) {
            return;
          }

          labelPointsById.set(id, { x, y });
        });

        const paths = Array.from(document.querySelectorAll('#features path'))
          .map((pathElement) => {
            const d = pathElement.getAttribute('d');
            const name = pathElement.getAttribute('name');
            const id = pathElement.getAttribute('id');

            if (!d || !name || !id) {
              return null;
            }

            const labelPoint = labelPointsById.get(id);

            return {
              id,
              name: DISPLAY_REGION_NAMES[id] ?? normalizeRegionName(name),
              d,
              href: CURRENT_REGION_HREFS[id] ?? '/sejours',
              labelX: labelPoint?.x ?? null,
              labelY: labelPoint?.y ?? null
            } satisfies ParsedRegionPath;
          })
          .filter((region): region is ParsedRegionPath => Boolean(region));

        if (!isCancelled) {
          setSvgMap({ width, height, paths });
        }
      } catch (error) {
        console.error('Erreur chargement carte France', error);
      }
    }

    loadMap();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (!svgMap) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-[28px] bg-[#f8fbff] text-sm text-slate-500 sm:min-h-[340px] md:min-h-[420px]">
        Chargement de la carte…
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[760px]">
      <svg
        viewBox={`0 0 ${svgMap.width} ${svgMap.height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Carte de France interactive par région"
      >
        {svgMap.paths.map((region) => {
          const isHovered = hoveredRegion?.id === region.id;

          return (
            <path
              key={region.id}
              d={region.d}
              fill={isHovered ? '#f5c273' : '#f7931e'}
              stroke="#ffffff"
              strokeWidth="1"
              strokeLinejoin="round"
              className="cursor-pointer transition-colors duration-200"
              onMouseEnter={(event) =>
                setHoveredRegion(buildHoveredRegionFromMouse(event, region))
              }
              onMouseMove={(event) => setHoveredRegion(buildHoveredRegionFromMouse(event, region))}
              onFocus={(event) =>
                setHoveredRegion(buildHoveredRegion(event.currentTarget, region, svgMap.width, svgMap.height))
              }
              onMouseLeave={() => setHoveredRegion(null)}
              onBlur={() => setHoveredRegion(null)}
              onClick={() => router.push(region.href)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  router.push(region.href);
                }
              }}
              role="link"
              tabIndex={0}
              aria-label={`Voir les séjours en ${region.name}`}
            />
          );
        })}
      </svg>

      {hoveredRegion ? (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: `${hoveredRegion.leftPercent}%`,
            top: `${hoveredRegion.topPercent}%`,
            transform: 'translate(-50%, calc(-100% - 8px))'
          }}
        >
          <div
            className="relative max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-[#232323] shadow-lg sm:max-w-none sm:whitespace-nowrap sm:px-4 sm:py-2.5 sm:text-[15px]"
            style={{ fontFamily: 'var(--font-primary)', backgroundColor: '#ffffff', opacity: 1 }}
          >
            {hoveredRegion.name}
            <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-white" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
