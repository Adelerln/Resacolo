'use client';

import { useMemo, useState } from 'react';

type TagSelectFieldProps = {
  label: string;
  name: string;
  initialValues: string[];
  placeholder?: string;
  suggestions?: string[];
};

function normalizeTag(value: string) {
  return value.trim();
}

function withDisplayCaps(value: string) {
  const accentMap: Record<string, string> = {
    age: 'Âge',
    activite: 'Activité',
    activites: 'Activités',
    aout: 'Août',
    cote: 'Côte',
    ete: 'Été',
    ile: 'Île',
    iles: 'Îles',
    noel: 'Noël',
    sejour: 'Séjour',
    sejours: 'Séjours'
  };
  return value.replace(/\p{L}+/gu, (word) => {
    const normalized = word.toLowerCase();
    if (accentMap[normalized]) return accentMap[normalized];
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

export default function TagSelectField({
  label,
  name,
  initialValues,
  placeholder = 'Ajouter puis Entrée',
  suggestions = []
}: TagSelectFieldProps) {
  const [tags, setTags] = useState<string[]>(initialValues);
  const [input, setInput] = useState('');

  const normalizedSuggestions = useMemo(
    () => Array.from(new Set(suggestions.map((item) => normalizeTag(item)).filter(Boolean))),
    [suggestions]
  );

  const addTag = (raw: string) => {
    const next = normalizeTag(raw);
    if (!next) return;
    const exists = tags.some((tag) => tag.toLowerCase() === next.toLowerCase());
    if (exists) return;
    setTags((current) => [...current, next]);
    setInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="rounded-lg border border-slate-200 bg-slate-100 p-2">
        <div className="mb-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
              title="Retirer"
            >
              {withDisplayCaps(tag)} ×
            </button>
          ))}
          {tags.length === 0 ? <span className="text-xs text-slate-500">Aucun élément</span> : null}
        </div>
        <input
          list={`${name}-suggestions`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              addTag(input);
            }
          }}
          onBlur={() => addTag(input)}
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        {normalizedSuggestions.length > 0 ? (
          <datalist id={`${name}-suggestions`}>
            {normalizedSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        ) : null}
      </div>
      {tags.map((tag) => (
        <input key={`${name}-${tag}`} type="hidden" name={name} value={tag} />
      ))}
    </div>
  );
}
