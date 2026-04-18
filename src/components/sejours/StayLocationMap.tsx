'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LatLngTuple, Map as LeafletMap } from 'leaflet';
import type { StayCenterLocation } from '@/types/stay';

type StayLocationMapProps = {
  location: string;
  centerLocations?: StayCenterLocation[];
  className?: string;
};

type AddressApiResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number];
    };
  }>;
};

const EARTH_RADIUS_METERS = 6371000;
const CENTER_OFFSET_METERS = 1200;
const PUBLIC_CIRCLE_RADIUS_METERS = 2000;
const FRENCH_TILE_URL = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
const FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const FRENCH_TILE_ATTRIBUTION =
  '&copy; Contributeurs OpenStreetMap, rendu cartographique OpenStreetMap France';
const FALLBACK_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

function fnv1aHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function offsetCoordinatesDeterministically(
  latitude: number,
  longitude: number,
  key: string,
  distanceMeters = CENTER_OFFSET_METERS
): LatLngTuple {
  const bearingDegrees = fnv1aHash(key) % 360;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitudeRad = (latitude * Math.PI) / 180;
  const deltaLat = (distanceMeters / EARTH_RADIUS_METERS) * Math.cos(bearing);
  const denominator = Math.max(Math.cos(latitudeRad), 0.0001);
  const deltaLon = (distanceMeters / (EARTH_RADIUS_METERS * denominator)) * Math.sin(bearing);

  return [
    latitude + (deltaLat * 180) / Math.PI,
    longitude + (deltaLon * 180) / Math.PI
  ];
}

export default function StayLocationMap({
  location,
  centerLocations,
  className
}: StayLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [cityCoordinates, setCityCoordinates] = useState<LatLngTuple | null>(null);
  const hasCenterLocations = Boolean(centerLocations?.length);
  const approximateCenters = useMemo(
    () =>
      (centerLocations ?? [])
        .filter(
          (center) => Number.isFinite(center.latitude) && Number.isFinite(center.longitude)
        )
        .map((center) => ({
          ...center,
          coordinates: offsetCoordinatesDeterministically(
            center.latitude,
            center.longitude,
            center.id
          )
        })),
    [centerLocations]
  );
  const [isLoading, setIsLoading] = useState(!hasCenterLocations && Boolean(location));

  useEffect(() => {
    if (hasCenterLocations) {
      setCityCoordinates(null);
      setIsLoading(false);
      return;
    }

    if (!location.trim()) {
      setCityCoordinates(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadCoordinates() {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(
            location
          )}&type=municipality&autocomplete=0&limit=1`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json'
            }
          }
        );

        if (!response.ok) {
          setCityCoordinates(null);
          return;
        }

        const data = (await response.json()) as AddressApiResponse;
        const nextCoordinates = data.features?.[0]?.geometry?.coordinates;
        if (nextCoordinates && nextCoordinates.length === 2) {
          setCityCoordinates([nextCoordinates[1], nextCoordinates[0]]);
        } else {
          setCityCoordinates(null);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setCityCoordinates(null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadCoordinates();

    return () => controller.abort();
  }, [hasCenterLocations, location]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let isCancelled = false;
    const fallbackCoordinates = cityCoordinates;
    const centers = approximateCenters;
    if (!fallbackCoordinates && centers.length === 0) {
      return;
    }

    async function setupMap() {
      const L = await import('leaflet');
      if (isCancelled || !containerRef.current) {
        return;
      }

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false
      });

      const frenchTiles = L.tileLayer(FRENCH_TILE_URL, {
        subdomains: ['a', 'b', 'c'],
        attribution: FRENCH_TILE_ATTRIBUTION
      });
      const fallbackTiles = L.tileLayer(FALLBACK_TILE_URL, {
        attribution: FALLBACK_TILE_ATTRIBUTION
      });
      let hasSwitchedToFallback = false;

      frenchTiles.on('tileerror', () => {
        if (hasSwitchedToFallback) return;
        hasSwitchedToFallback = true;
        if (map.hasLayer(frenchTiles)) {
          map.removeLayer(frenchTiles);
        }
        fallbackTiles.addTo(map);
      });

      frenchTiles.addTo(map);

      if (centers.length > 0) {
        centers.forEach((center) => {
          L.circle(center.coordinates, {
            radius: PUBLIC_CIRCLE_RADIUS_METERS,
            color: '#0f766e',
            weight: 2,
            fillColor: '#14b8a6',
            fillOpacity: 0.22
          })
            .addTo(map)
            .bindTooltip(center.name, { direction: 'top' });
        });

        if (centers.length === 1) {
          map.setView(centers[0].coordinates, 10);
        } else {
          map.fitBounds(L.latLngBounds(centers.map((center) => center.coordinates)), {
            padding: [36, 36],
            maxZoom: 9
          });
        }
      } else if (fallbackCoordinates) {
        map.setView(fallbackCoordinates, 11);
        L.circleMarker(fallbackCoordinates, {
          radius: 8,
          color: '#0f766e',
          weight: 2,
          fillColor: '#14b8a6',
          fillOpacity: 0.8
        })
          .addTo(map)
          .bindPopup(location);
      }

      mapRef.current = map;
    }

    void setupMap();

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [approximateCenters, cityCoordinates, location]);

  if (isLoading) {
    return <div className="h-72 rounded-xl bg-slate-100" />;
  }

  if (!cityCoordinates && approximateCenters.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        Carte indisponible pour cette ville.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-72 overflow-hidden rounded-xl border border-slate-200'}
    />
  );
}
