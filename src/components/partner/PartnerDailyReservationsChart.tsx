'use client';

import { useMemo, type CSSProperties } from 'react';

type DailyPoint = {
  dayKey: string;
  label: string;
  count: number;
};

function formatReservationCount(count: number) {
  return count === 1 ? '1 réservation' : `${count} réservations`;
}

function buildYAxisTicks(maxCount: number) {
  if (maxCount <= 5) {
    return Array.from({ length: maxCount + 1 }, (_, index) => maxCount - index);
  }
  const step = Math.max(1, Math.ceil(maxCount / 4));
  const ticks = new Set<number>([0, maxCount]);
  for (let value = step; value < maxCount; value += step) {
    ticks.add(value);
  }
  return Array.from(ticks).sort((a, b) => b - a);
}

function yTickStyle(tick: number, maxCount: number): CSSProperties {
  if (maxCount === 0) return { bottom: 0 };
  if (tick === 0) return { bottom: 0 };
  if (tick === maxCount) return { top: 0 };
  return { bottom: `${(tick / maxCount) * 100}%`, transform: 'translateY(50%)' };
}

export function PartnerDailyReservationsChart({
  series,
  maxCount
}: {
  series: DailyPoint[];
  maxCount: number;
}) {
  const plotHeightPx = 200;
  const yTicks = useMemo(() => buildYAxisTicks(maxCount), [maxCount]);
  const xLabelInterval = useMemo(() => Math.max(1, Math.floor(series.length / 6)), [series.length]);

  return (
    <div className="mt-4">
      <div
        className="grid gap-x-2 sm:gap-x-3"
        style={{
          gridTemplateColumns: '3rem 1fr',
          gridTemplateRows: `auto ${plotHeightPx}px auto auto`
        }}
      >
        <p className="col-start-1 row-start-1 self-end pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Résa.
        </p>

        <div className="relative col-start-1 row-start-2">
          {yTicks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 text-[10px] font-medium tabular-nums leading-none text-slate-500"
              style={yTickStyle(tick, maxCount)}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="col-start-2 row-start-2 flex items-end gap-0.5 border-b border-l border-slate-300 bg-slate-50 px-1.5">
          {series.map((point) => {
            const heightPx =
              point.count === 0
                ? 0
                : Math.max(4, Math.round((point.count / maxCount) * plotHeightPx));

            return (
              <div
                key={point.dayKey}
                className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
                  role="tooltip"
                >
                  {point.label} · {formatReservationCount(point.count)}
                </div>
                <div
                  className="relative z-10 w-full rounded-sm bg-emerald-500/85 transition group-hover:bg-emerald-500"
                  style={{ height: `${heightPx}px`, minHeight: point.count > 0 ? '4px' : undefined }}
                  aria-label={`${point.label} : ${formatReservationCount(point.count)}`}
                />
              </div>
            );
          })}
        </div>

        <div className="col-start-2 row-start-3 flex min-h-10 gap-0.5 border-l border-slate-200 bg-white px-1.5 py-2">
          {series.map((point, index) => {
            const showLabel =
              index === 0 || index === series.length - 1 || index % xLabelInterval === 0;
            return (
              <div
                key={`${point.dayKey}-label`}
                className="flex min-w-0 flex-1 items-start justify-center"
              >
                {showLabel ? (
                  <span className="text-center text-[9px] leading-tight text-slate-500">
                    {point.label}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="col-start-2 row-start-4 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Date
        </p>
      </div>
      <p className="mt-2 text-xs text-slate-500">Survoler les barres pour le détail journalier.</p>
    </div>
  );
}
