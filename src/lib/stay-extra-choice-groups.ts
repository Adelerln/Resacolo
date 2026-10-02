export const STAY_EXTRA_OPTION_KIND_SIMPLE = 'simple';
export const STAY_EXTRA_OPTION_KIND_CHOICE_GROUP = 'choice_group';

export type ParsedStayExtraOptionRow = {
  label: string;
  amountCents: number;
  choiceGroupLabel?: string | null;
  choiceValue?: string | null;
};

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

export function isChoiceGroupExtraOptionRow(row: Record<string, unknown>): boolean {
  const kind = normalizeWhitespace(String(row.kind ?? '')).toLowerCase();
  if (kind === STAY_EXTRA_OPTION_KIND_CHOICE_GROUP) return true;
  return Array.isArray(row.choices) && row.choices.length > 0 && Boolean(row.group_label);
}

/** Ligne à conserver à l’enregistrement (option simple ou groupe à choix). */
export function isPersistableDraftExtraOptionRow(row: Record<string, unknown>): boolean {
  if (isChoiceGroupExtraOptionRow(row)) {
    const group = choiceGroupFromRecord(row);
    return Boolean(normalizeWhitespace(group.groupLabel)) && group.choices.length > 0;
  }
  return Boolean(normalizeWhitespace(String(row.label ?? '')));
}

export function emptyDraftExtraOptionChoiceGroupRecord(): Record<string, unknown> {
  return {
    kind: STAY_EXTRA_OPTION_KIND_CHOICE_GROUP,
    group_label: '',
    choices: [] as string[],
    price: null,
    currency: 'EUR'
  };
}

export function choiceGroupFromRecord(record: Record<string, unknown>): {
  groupLabel: string;
  choices: string[];
  price: string;
  currency: string;
} {
  const rawChoices = Array.isArray(record.choices) ? record.choices : [];
  return {
    groupLabel:
      record.group_label != null
        ? String(record.group_label)
        : record.label != null
          ? String(record.label)
          : '',
    choices: rawChoices
      .map((item) => normalizeWhitespace(String(item ?? '')))
      .filter(Boolean),
    price:
      typeof record.price === 'number' && Number.isFinite(record.price)
        ? String(record.price)
        : record.price != null
          ? String(record.price)
          : '',
    currency: record.currency != null ? String(record.currency) : 'EUR'
  };
}

export function choiceGroupToRecord(input: {
  groupLabel: string;
  choices: string[];
  price: string;
  currency: string;
}): Record<string, unknown> {
  const groupLabelRaw = String(input.groupLabel ?? '');
  const groupLabelTrimmed = normalizeWhitespace(groupLabelRaw);
  const choices = input.choices.map((c) => normalizeWhitespace(c)).filter(Boolean);
  const priceTrim = input.price.trim().replace(',', '.');
  const priceNum = priceTrim === '' ? null : Number(priceTrim);
  return {
    kind: STAY_EXTRA_OPTION_KIND_CHOICE_GROUP,
    group_label: groupLabelTrimmed ? groupLabelRaw : null,
    choices,
    price: priceNum !== null && Number.isFinite(priceNum) ? priceNum : null,
    currency: input.currency || 'EUR'
  };
}

/** Regroupe les lignes publiées (avec colonnes groupe) pour l’éditeur brouillon. */
export function rebuildDraftExtraRowsFromPublished(
  rows: Array<{
    label: string;
    amount_cents: number;
    choice_group_label?: string | null;
    choice_value?: string | null;
  }>
): Array<Record<string, unknown>> {
  const simple: Array<Record<string, unknown>> = [];
  const groups = new Map<
    string,
    { group_label: string; choices: string[]; price: number; currency: string }
  >();

  for (const row of rows) {
    const groupLabel = normalizeWhitespace(row.choice_group_label ?? '');
    const choiceValue = normalizeWhitespace(row.choice_value ?? '');
    if (groupLabel && choiceValue) {
      const key = `${groupLabel}|${row.amount_cents}`;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.choices.includes(choiceValue)) existing.choices.push(choiceValue);
      } else {
        groups.set(key, {
          group_label: groupLabel,
          choices: [choiceValue],
          price: row.amount_cents / 100,
          currency: 'EUR'
        });
      }
      continue;
    }
    simple.push({
      kind: STAY_EXTRA_OPTION_KIND_SIMPLE,
      label: row.label,
      price: row.amount_cents / 100,
      currency: 'EUR',
      description: null
    });
  }

  const groupRows = Array.from(groups.values()).map((group) =>
    choiceGroupToRecord({
      groupLabel: group.group_label,
      choices: group.choices,
      price: String(group.price),
      currency: group.currency
    })
  );

  return [...simple, ...groupRows];
}

export function partitionStayExtraOptionsForBooking(
  options: Array<{
    id: string;
    label: string;
    amount: number;
    choiceGroupLabel?: string | null;
    choiceValue?: string | null;
  }>
) {
  const simpleOptions: typeof options = [];
  const groups = new Map<
    string,
    { groupLabel: string; options: typeof options }
  >();

  for (const option of options) {
    const groupLabel = normalizeWhitespace(option.choiceGroupLabel ?? '');
    const choiceValue = normalizeWhitespace(option.choiceValue ?? '');
    if (groupLabel && choiceValue) {
      const bucket = groups.get(groupLabel) ?? { groupLabel, options: [] };
      bucket.options.push(option);
      groups.set(groupLabel, bucket);
      continue;
    }
    simpleOptions.push(option);
  }

  return {
    simpleOptions,
    choiceGroups: Array.from(groups.values())
  };
}
