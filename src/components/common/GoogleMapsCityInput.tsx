'use client';

import { useEffect, useRef, useState } from 'react';

type GoogleMapsCityInputProps = {
  name: string;
  label: string;
  defaultValue?: string;
  /** Mode contrôlé (ex. relecture de brouillon sans submit HTML natif). */
  value?: string;
  onValueChange?: (next: string) => void;
  /** Affiche une ligne d’aide sur l’API des communes (désactivé par défaut). */
  showApiHint?: boolean;
  required?: boolean;
  className?: string;
};

type AddressApiFeature = {
  properties?: {
    city?: string;
    name?: string;
    label?: string;
    postcode?: string;
    context?: string;
  };
};

type AddressApiResponse = {
  features?: AddressApiFeature[];
};

type Suggestion = {
  city: string;
  subtitle: string;
};

function buildSuggestion(feature: AddressApiFeature): Suggestion | null {
  const properties = feature.properties;
  if (!properties) return null;

  const city = properties.city?.trim() || properties.name?.trim() || properties.label?.split(',')[0]?.trim();
  if (!city) return null;

  const subtitleParts = [properties.postcode, properties.context].filter(Boolean);
  return {
    city,
    subtitle: subtitleParts.join(' - ')
  };
}

export default function GoogleMapsCityInput({
  name,
  label,
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  required = false,
  className
}: GoogleMapsCityInputProps) {
  const isControlled = typeof onValueChange === 'function';
  const containerRef = useRef<HTMLLabelElement | null>(null);
  const hasUserTypedRef = useRef(false);
  const skipNextLookupRef = useRef(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const displayValue = isControlled ? (controlledValue ?? '') : internalValue;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  /** Incrémenté au focus pour relancer une recherche si le champ est déjà prérempli. */
  const [focusLookupTick, setFocusLookupTick] = useState(0);

  function commitValue(next: string) {
    if (isControlled) {
      onValueChange!(next);
    } else {
      setInternalValue(next);
    }
  }

  useEffect(() => {
    if (isControlled) return;
    hasUserTypedRef.current = false;
    skipNextLookupRef.current = false;
    setInternalValue(defaultValue);
    setSuggestions([]);
    setIsOpen(false);
    setIsLoading(false);
  }, [defaultValue, isControlled]);

  useEffect(() => {
    if (!hasUserTypedRef.current) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false;
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    if (displayValue.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(
            displayValue.trim()
          )}&type=municipality&autocomplete=1&limit=6`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json'
            }
          }
        );

        if (!response.ok) {
          setSuggestions([]);
          setIsOpen(false);
          return;
        }

        const data = (await response.json()) as AddressApiResponse;
        const nextSuggestions = (data.features ?? [])
          .map(buildSuggestion)
          .filter((item): item is Suggestion => Boolean(item));

        setSuggestions(nextSuggestions);
        setIsOpen(nextSuggestions.length > 0);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [displayValue, focusLookupTick]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <label ref={containerRef} className={className ?? 'block text-sm font-medium text-slate-700'}>
      {label}
      <div className="relative mt-1">
        <input
          name={name}
          value={displayValue}
          onChange={(event) => {
            hasUserTypedRef.current = true;
            commitValue(event.target.value);
          }}
          onFocus={() => {
            if (displayValue.trim().length >= 2) {
              hasUserTypedRef.current = true;
              setFocusLookupTick((n) => n + 1);
            }
            if (hasUserTypedRef.current && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          required={required}
          autoComplete="off"
          placeholder="Commence à saisir une ville (ex. Moncoutant…)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
        {isLoading && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            Recherche...
          </span>
        )}
        {isOpen && suggestions.length > 0 && (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <ul className="max-h-72 overflow-y-auto py-1">
              {suggestions.map((suggestion) => (
                <li key={`${suggestion.city}-${suggestion.subtitle}`}>
                  <button
                    type="button"
                    onClick={() => {
                      skipNextLookupRef.current = true;
                      commitValue(suggestion.city);
                      setSuggestions([]);
                      setIsOpen(false);
                    }}
                    className="flex w-full cursor-pointer flex-col px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-900">{suggestion.city}</span>
                    {suggestion.subtitle && (
                      <span className="text-xs text-slate-500">{suggestion.subtitle}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </label>
  );
}
