'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { useCart } from '@/context/CartContext';
import {
  createCheckoutId,
  EMPTY_CONTACT,
  ensureParticipantsForCart,
  getDefaultParticipant,
  type CheckoutContact,
  type CheckoutParticipant,
  type CheckoutState
} from '@/types/checkout';

const CHECKOUT_STORAGE_KEY = 'resacolo-checkout';

type CheckoutContextValue = {
  hydrated: boolean;
  checkoutId: string;
  contact: CheckoutContact;
  participants: Record<string, CheckoutParticipant>;
  setCheckoutId: (checkoutId: string) => void;
  setContact: (next: CheckoutContact) => void;
  updateParticipant: (cartItemId: string, next: Partial<CheckoutParticipant>) => void;
  resetCheckout: () => void;
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

function buildDefaultState(): CheckoutState {
  return {
    checkoutId: createCheckoutId(),
    contact: { ...EMPTY_CONTACT },
    participants: {}
  };
}

function loadCheckoutState(): CheckoutState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CheckoutState;
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      checkoutId: typeof parsed.checkoutId === 'string' ? parsed.checkoutId : createCheckoutId(),
      contact: {
        ...EMPTY_CONTACT,
        ...(parsed.contact ?? {})
      },
      participants:
        parsed.participants && typeof parsed.participants === 'object' ? parsed.participants : {}
    };
  } catch {
    return null;
  }
}

function saveCheckoutState(value: CheckoutState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const { items } = useCart();
  const [state, setState] = useState<CheckoutState>(buildDefaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadCheckoutState();
    if (loaded) {
      setState(loaded);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    setState((prev) => ({
      ...prev,
      participants: ensureParticipantsForCart(prev.participants, items)
    }));
  }, [hydrated, items]);

  useEffect(() => {
    if (!hydrated) return;
    saveCheckoutState(state);
  }, [hydrated, state]);

  const setCheckoutId = useCallback((checkoutId: string) => {
    setState((prev) => ({
      ...prev,
      checkoutId
    }));
  }, []);

  const setContact = useCallback((next: CheckoutContact) => {
    setState((prev) => ({
      ...prev,
      contact: {
        ...EMPTY_CONTACT,
        ...next
      }
    }));
  }, []);

  const updateParticipant = useCallback((cartItemId: string, next: Partial<CheckoutParticipant>) => {
    setState((prev) => {
      const current = prev.participants[cartItemId] ?? getDefaultParticipant(cartItemId);
      return {
        ...prev,
        participants: {
          ...prev.participants,
          [cartItemId]: {
            ...current,
            ...next,
            cartItemId
          }
        }
      };
    });
  }, []);

  const resetCheckout = useCallback(() => {
    setState(buildDefaultState());
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      checkoutId: state.checkoutId,
      contact: state.contact,
      participants: state.participants,
      setCheckoutId,
      setContact,
      updateParticipant,
      resetCheckout
    }),
    [
      hydrated,
      resetCheckout,
      setCheckoutId,
      setContact,
      state.checkoutId,
      state.contact,
      state.participants,
      updateParticipant
    ]
  );

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) {
    throw new Error('useCheckout must be used within CheckoutProvider');
  }
  return ctx;
}
