'use client';

import { useEffect, useRef, useState } from 'react';

type PartnerLogoFieldsetProps = {
  initialLogoUrl: string | null;
  initialScale: number | null;
  initialOffsetX: number | null;
  initialOffsetY: number | null;
  partnerName: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumber(value: number | null | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return clamp(Number(value), min, max);
}

function sliderClassName() {
  return 'mt-2 h-2 w-full cursor-pointer accent-orange-500';
}

export default function PartnerLogoFieldset({
  initialLogoUrl,
  initialScale,
  initialOffsetX,
  initialOffsetY,
  partnerName
}: PartnerLogoFieldsetProps) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(normalizeNumber(initialScale, 1, 0.6, 2.4));
  const [offsetX, setOffsetX] = useState(normalizeNumber(initialOffsetX, 0, -100, 100));
  const [offsetY, setOffsetY] = useState(normalizeNumber(initialOffsetY, 0, -100, 100));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const displayUrl = previewUrl ?? (logoUrl.trim() || null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex h-48 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayUrl}
                alt={`Logo ${partnerName}`}
                className="h-auto w-auto max-h-[74%] max-w-[74%] object-contain"
                style={{
                  transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale})`,
                  transformOrigin: 'center center'
                }}
              />
            ) : (
              <div className="px-6 text-center text-sm text-slate-400">
                Le logo apparaîtra ici après téléversement ou ajout d&apos;une URL.
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Cadre fixe du logo partenaire. Ajustez le zoom et la position avant d&apos;enregistrer.
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Fichier logo
              <input
                ref={fileInputRef}
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                  }
                  setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
                }}
              />
              <span className="mt-1 block text-xs text-slate-500">PNG, JPG, WEBP ou SVG, 5 Mo max.</span>
            </label>
            <label className="text-sm font-medium text-slate-700">
              URL du logo
              <input
                name="logo_url"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="https://..."
              />
              <span className="mt-1 block text-xs text-slate-500">
                Champ optionnel si vous préférez un logo hébergé ailleurs.
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Zoom
              <input
                type="range"
                min="0.6"
                max="2.4"
                step="0.05"
                value={scale}
                onChange={(event) => setScale(Number(event.target.value))}
                className={sliderClassName()}
              />
              <span className="mt-1 block text-xs text-slate-500">{scale.toFixed(2)}x</span>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Décalage horizontal
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={offsetX}
                onChange={(event) => setOffsetX(Number(event.target.value))}
                className={sliderClassName()}
              />
              <span className="mt-1 block text-xs text-slate-500">{offsetX}%</span>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Décalage vertical
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={offsetY}
                onChange={(event) => setOffsetY(Number(event.target.value))}
                className={sliderClassName()}
              />
              <span className="mt-1 block text-xs text-slate-500">{offsetY}%</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setScale(1);
                setOffsetX(0);
                setOffsetY(0);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              Réinitialiser le cadrage
            </button>
            <button
              type="button"
              onClick={() => {
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                }
                setPreviewUrl(null);
                setLogoUrl('');
                setScale(1);
                setOffsetX(0);
                setOffsetY(0);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              Retirer l&apos;aperçu
            </button>
          </div>
        </div>
      </div>

      <input type="hidden" name="logo_scale" value={String(scale)} />
      <input type="hidden" name="logo_offset_x" value={String(offsetX)} />
      <input type="hidden" name="logo_offset_y" value={String(offsetY)} />
    </div>
  );
}
