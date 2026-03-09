'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode
} from 'react';
import type { Stay } from '@/types/stay';

const CART_STORAGE_KEY = 'resacolo-cart';

type CartContextValue = {
  items: Stay[];
  addItem: (stay: Stay) => void;
  removeItem: (slug: string) => void;
  removeItemByIndex: (index: number) => void;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): Stay[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stay[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(items: Stay[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Stay[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveCart(items);
  }, [items, hydrated]);

  const addItem = useCallback((stay: Stay) => {
    setItems((prev) => {
      // Éviter les doublons par slug si besoin ; ici on ajoute toujours (plusieurs participants possibles)
      return [...prev, stay];
    });
  }, []);

  const removeItem = useCallback((slug: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((s) => s.slug === slug);
      if (idx === -1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const removeItemByIndex = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      removeItemByIndex,
      count: items.length
    }),
    [items, addItem, removeItem, removeItemByIndex]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
