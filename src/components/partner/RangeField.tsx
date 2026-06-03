'use client';

import { useMemo, useState } from 'react';

type RangeFieldProps = {
  label: string;
  minName: string;
  maxName: string;
  minLimit: number;
  maxLimit: number;
  step?: number;
  unit?: string;
  defaultMin: number | null;
  defaultMax: number | null;
  onValuesChange?: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function RangeField({
  label,
  minName,
  maxName,
  minLimit,
  maxLimit,
  step = 1,
  unit = '',
  defaultMin,
  defaultMax,
  onValuesChange
}: RangeFieldProps) {
  const initialMin = clamp(defaultMin ?? minLimit, minLimit, maxLimit);
  const initialMax = clamp(defaultMax ?? maxLimit, minLimit, maxLimit);
  const [minValue, setMinValue] = useState(Math.min(initialMin, initialMax));
  const [maxValue, setMaxValue] = useState(Math.max(initialMin, initialMax));

  const leftPercent = useMemo(
    () => ((minValue - minLimit) / (maxLimit - minLimit)) * 100,
    [minLimit, maxLimit, minValue]
  );
  const rightPercent = useMemo(
    () => ((maxValue - minLimit) / (maxLimit - minLimit)) * 100,
    [minLimit, maxLimit, maxValue]
  );

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-700">
        {label}: <span className="font-semibold text-slate-900">{minValue}</span> -{' '}
        <span className="font-semibold text-slate-900">{maxValue}</span>
        {unit}
      </p>

      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-3 h-2 rounded-full bg-slate-200" />
        <div
          className="absolute top-3 h-2 rounded-full bg-orange-400"
          style={{
            left: `${leftPercent}%`,
            width: `${Math.max(0, rightPercent - leftPercent)}%`
          }}
        />
        <input
          type="range"
          min={minLimit}
          max={maxLimit}
          step={step}
          value={minValue}
          onChange={(event) => {
            setMinValue(clamp(Math.min(Number(event.target.value), maxValue), minLimit, maxLimit));
            onValuesChange?.();
          }}
          className="pointer-events-auto absolute left-0 right-0 top-0 h-8 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-400"
          aria-label={`${label} minimum`}
        />
        <input
          type="range"
          min={minLimit}
          max={maxLimit}
          step={step}
          value={maxValue}
          onChange={(event) => {
            setMaxValue(clamp(Math.max(Number(event.target.value), minValue), minLimit, maxLimit));
            onValuesChange?.();
          }}
          className="pointer-events-auto absolute left-0 right-0 top-0 h-8 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-400"
          aria-label={`${label} maximum`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-600">
          Min
          <input
            type="number"
            value={minValue}
            min={minLimit}
            max={maxValue}
            step={step}
            onChange={(event) => {
              setMinValue(clamp(Math.min(Number(event.target.value), maxValue), minLimit, maxLimit));
              onValuesChange?.();
            }}
            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Max
          <input
            type="number"
            value={maxValue}
            min={minValue}
            max={maxLimit}
            step={step}
            onChange={(event) => {
              setMaxValue(clamp(Math.max(Number(event.target.value), minValue), minLimit, maxLimit));
              onValuesChange?.();
            }}
            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <input type="hidden" name={minName} value={String(minValue)} />
      <input type="hidden" name={maxName} value={String(maxValue)} />
    </div>
  );
}
