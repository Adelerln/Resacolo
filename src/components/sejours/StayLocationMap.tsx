'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';

type StayLocationMapProps = {
  location: string;
};

type AddressApiResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number];
    };
  }>;
};

export default function StayLocationMap({ location }: StayLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(location));

  useEffect(() => {
    if (!location.trim()) {
      setCoordinates(null);
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
          setCoordinates(null);
          return;
        }

        const data = (await response.json()) as AddressApiResponse;
        const nextCoordinates = data.features?.[0]?.geometry?.coordinates;
        if (nextCoordinates && nextCoordinates.length === 2) {
          setCoordinates([nextCoordinates[1], nextCoordinates[0]]);
        } else {
          setCoordinates(null);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setCoordinates(null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadCoordinates();

    return () => controller.abort();
  }, [location]);

  useEffect(() => {
    if (!containerRef.current || !coordinates) {
      return;
    }

    let isCancelled = false;
    const nextCoordinates = coordinates;

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
      }).setView(nextCoordinates, 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      L.circleMarker(nextCoordinates, {
        radius: 8,
        color: '#0f766e',
        weight: 2,
        fillColor: '#14b8a6',
        fillOpacity: 0.8
      })
        .addTo(map)
        .bindPopup(location);

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
  }, [coordinates, location]);

  if (isLoading) {
    return <div className="h-64 rounded-xl bg-slate-100" />;
  }

  if (!coordinates) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        Carte indisponible pour cette ville.
      </div>
    );
  }

  return <div ref={containerRef} className="h-64 overflow-hidden rounded-xl border border-slate-200" />;
}
