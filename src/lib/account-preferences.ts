export type ParentStatus = 'pere' | 'mere' | 'grand-parent' | 'autre';

export type AccountInfo = {
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  parent1FirstName: string;
  parent1LastName: string;
  parent2FirstName: string;
  parent2LastName: string;
  parent1Phone: string;
  parent2Phone: string;
  parent1Email: string;
  parent2Email: string;
  parent1Status: ParentStatus;
  parent2Status: ParentStatus;
  parent1StatusOther: string;
  parent2StatusOther: string;
  parent2HasDifferentAddress: boolean;
  parent2AddressLine1: string;
  parent2AddressLine2: string;
  parent2PostalCode: string;
  parent2City: string;
};

export type AccountPreferences = {
  userName: string;
  userEmail: string;
  userCity: string;
  accountInfo: AccountInfo;
};

export const ACCOUNT_PREFERENCES_STORAGE_KEY = 'resacolo.accountPreferences';
export const ACCOUNT_PREFERENCES_UPDATED_EVENT = 'resacolo:account-preferences-updated';

const DEFAULT_ACCOUNT_INFO: AccountInfo = {
  addressLine1: '12 rue des Tilleuls',
  addressLine2: 'Bâtiment B, Appartement 23',
  postalCode: '69003',
  city: 'Lyon',
  parent1FirstName: 'Marie',
  parent1LastName: 'Dupont',
  parent2FirstName: 'Jean',
  parent2LastName: 'Dupont',
  parent1Phone: '06.12.34.56.78',
  parent2Phone: '06.78.90.12.34',
  parent1Email: 'parent1@example.com',
  parent2Email: 'parent2@example.com',
  parent1Status: 'mere',
  parent2Status: 'pere',
  parent1StatusOther: '',
  parent2StatusOther: '',
  parent2HasDifferentAddress: false,
  parent2AddressLine1: '',
  parent2AddressLine2: '',
  parent2PostalCode: '',
  parent2City: ''
};

export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  userName: 'Marie Dupont',
  userEmail: 'marie.dupont@example.com',
  userCity: 'Lyon, France',
  accountInfo: DEFAULT_ACCOUNT_INFO
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asParentStatus(value: unknown, fallback: ParentStatus) {
  if (value === 'pere' || value === 'mere' || value === 'grand-parent' || value === 'autre') {
    return value;
  }
  return fallback;
}

function splitName(value: unknown) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) {
    return { firstName: '', lastName: '' };
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function normalizeAccountInfo(value: unknown): AccountInfo {
  if (!isRecord(value)) {
    return DEFAULT_ACCOUNT_PREFERENCES.accountInfo;
  }

  const parent1LegacyName = splitName(value.parent1Name);
  const parent2LegacyName = splitName(value.parent2Name);

  return {
    addressLine1: asString(value.addressLine1, DEFAULT_ACCOUNT_INFO.addressLine1),
    addressLine2: asString(value.addressLine2, DEFAULT_ACCOUNT_INFO.addressLine2),
    postalCode: asString(value.postalCode, DEFAULT_ACCOUNT_INFO.postalCode),
    city: asString(value.city, DEFAULT_ACCOUNT_INFO.city),
    parent1FirstName: asString(value.parent1FirstName, parent1LegacyName.firstName || DEFAULT_ACCOUNT_INFO.parent1FirstName),
    parent1LastName: asString(value.parent1LastName, parent1LegacyName.lastName || DEFAULT_ACCOUNT_INFO.parent1LastName),
    parent2FirstName: asString(value.parent2FirstName, parent2LegacyName.firstName || DEFAULT_ACCOUNT_INFO.parent2FirstName),
    parent2LastName: asString(value.parent2LastName, parent2LegacyName.lastName || DEFAULT_ACCOUNT_INFO.parent2LastName),
    parent1Phone: asString(value.parent1Phone, DEFAULT_ACCOUNT_INFO.parent1Phone),
    parent2Phone: asString(value.parent2Phone, DEFAULT_ACCOUNT_INFO.parent2Phone),
    parent1Email: asString(value.parent1Email, DEFAULT_ACCOUNT_INFO.parent1Email),
    parent2Email: asString(value.parent2Email, DEFAULT_ACCOUNT_INFO.parent2Email),
    parent1Status: asParentStatus(value.parent1Status, DEFAULT_ACCOUNT_INFO.parent1Status),
    parent2Status: asParentStatus(value.parent2Status, DEFAULT_ACCOUNT_INFO.parent2Status),
    parent1StatusOther: asString(value.parent1StatusOther, ''),
    parent2StatusOther: asString(value.parent2StatusOther, ''),
    parent2HasDifferentAddress: asBoolean(
      value.parent2HasDifferentAddress,
      DEFAULT_ACCOUNT_INFO.parent2HasDifferentAddress
    ),
    parent2AddressLine1: asString(value.parent2AddressLine1, ''),
    parent2AddressLine2: asString(value.parent2AddressLine2, ''),
    parent2PostalCode: asString(value.parent2PostalCode, ''),
    parent2City: asString(value.parent2City, '')
  };
}

function normalizeAccountPreferences(value: unknown): AccountPreferences {
  if (!isRecord(value)) {
    return DEFAULT_ACCOUNT_PREFERENCES;
  }

  const accountInfo = normalizeAccountInfo(value.accountInfo);

  return {
    userName: asString(value.userName, DEFAULT_ACCOUNT_PREFERENCES.userName),
    userEmail: asString(value.userEmail, DEFAULT_ACCOUNT_PREFERENCES.userEmail),
    userCity: asString(value.userCity, DEFAULT_ACCOUNT_PREFERENCES.userCity),
    accountInfo
  };
}

export function readAccountPreferences() {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCOUNT_PREFERENCES;
  }

  try {
    const rawValue = window.localStorage.getItem(ACCOUNT_PREFERENCES_STORAGE_KEY);
    if (!rawValue) return DEFAULT_ACCOUNT_PREFERENCES;

    const parsed = JSON.parse(rawValue);
    return normalizeAccountPreferences(parsed);
  } catch {
    return DEFAULT_ACCOUNT_PREFERENCES;
  }
}

export function saveAccountPreferences(preferences: AccountPreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPreferences = normalizeAccountPreferences(preferences);

  try {
    window.localStorage.setItem(
      ACCOUNT_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizedPreferences)
    );
  } catch {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ACCOUNT_PREFERENCES_UPDATED_EVENT, { detail: normalizedPreferences })
  );
}

function groupDigits(value: string, groupSize: number, separator: string) {
  if (!value) return '';
  const parts: string[] = [];
  for (let index = 0; index < value.length; index += groupSize) {
    parts.push(value.slice(index, index + groupSize));
  }
  return parts.join(separator);
}

function formatNorthAmericanNational(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (!digits) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function normalizePhoneRaw(value: string) {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return hasPlus ? '+' : '';
  return hasPlus ? `+${digits}` : digits;
}

export function formatPhoneInput(value: string) {
  const normalized = normalizePhoneRaw(value);
  if (!normalized) return '';
  if (normalized === '+') return '+';

  if (normalized.startsWith('+1')) {
    const national = normalized.slice(2).slice(0, 10);
    if (!national) return '+1';
    return `+1 ${formatNorthAmericanNational(national)}`;
  }

  if (normalized.startsWith('+33')) {
    const national = normalized.slice(3).slice(0, 9);
    if (!national) return '+33';
    return `+33 ${groupDigits(national, 2, ' ')}`;
  }

  if (normalized.startsWith('+')) {
    const intlDigits = normalized.slice(1).slice(0, 15);
    return `+${groupDigits(intlDigits, 3, ' ')}`;
  }

  const localDigits = normalized.slice(0, 10);
  return groupDigits(localDigits, 2, '.');
}

export function formatPhoneDisplay(value: string) {
  const normalized = normalizePhoneRaw(value);
  if (!normalized || normalized === '+') return '';

  if (normalized.startsWith('+1')) {
    const national = normalized.slice(2).replace(/\D/g, '');
    if (!national) return '+1';
    if (national.length <= 10) return formatNorthAmericanNational(national);
    return `${formatNorthAmericanNational(national.slice(0, 10))} x${national.slice(10)}`;
  }

  if (normalized.startsWith('+33')) {
    const national = normalized.slice(3).replace(/\D/g, '').slice(0, 9);
    if (!national) return '+33';
    return `+33 ${groupDigits(national, 2, ' ')}`;
  }

  if (normalized.startsWith('+')) {
    return `+${groupDigits(normalized.slice(1).replace(/\D/g, '').slice(0, 15), 3, ' ')}`;
  }

  return groupDigits(normalized.replace(/\D/g, '').slice(0, 10), 2, '.');
}

export function formatFrenchPhone(value: string) {
  return formatPhoneDisplay(value);
}

export function parentStatusLabel(status: ParentStatus, other?: string) {
  if (status === 'pere') return 'Père';
  if (status === 'mere') return 'Mère';
  if (status === 'grand-parent') return 'Grand-parent';
  return other?.trim() || 'Autre';
}
