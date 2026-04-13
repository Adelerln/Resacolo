export type ParentStatus = 'pere' | 'mere' | 'grand-parent' | 'autre';

export type AccountInfo = {
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  parent1Name: string;
  parent2Name: string;
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
  parent1Name: 'Marie Dupont',
  parent2Name: 'Jean Dupont',
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

function normalizeAccountInfo(value: unknown): AccountInfo {
  if (!isRecord(value)) {
    return DEFAULT_ACCOUNT_PREFERENCES.accountInfo;
  }

  return {
    addressLine1: asString(value.addressLine1, DEFAULT_ACCOUNT_INFO.addressLine1),
    addressLine2: asString(value.addressLine2, DEFAULT_ACCOUNT_INFO.addressLine2),
    postalCode: asString(value.postalCode, DEFAULT_ACCOUNT_INFO.postalCode),
    city: asString(value.city, DEFAULT_ACCOUNT_INFO.city),
    parent1Name: asString(value.parent1Name, DEFAULT_ACCOUNT_INFO.parent1Name),
    parent2Name: asString(value.parent2Name, DEFAULT_ACCOUNT_INFO.parent2Name),
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

export function formatFrenchPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (!digits) return '';
  return digits.match(/.{1,2}/g)?.join('.') ?? digits;
}

export function parentStatusLabel(status: ParentStatus, other?: string) {
  if (status === 'pere') return 'Père';
  if (status === 'mere') return 'Mère';
  if (status === 'grand-parent') return 'Grand-parent';
  return other?.trim() || 'Autre';
}
