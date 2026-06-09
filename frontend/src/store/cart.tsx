// Lightweight cart context backed by local AsyncStorage.
// Exposes items keyed by product id with quantity, plus helpers for total
// price and aggregate eco-impact (CO2, plastic packaging count).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { findProduct, getGreenAlternative, Product } from "@/src/data/products";
import { usePrices } from "@/src/store/prices";
import { storage } from "@/src/utils/storage";

const STORAGE_KEY = "greencart.cart.v1";
const SAVED_LISTS_KEY = "greencart.savedLists.v1";

export type CartItem = { id: string; qty: number };
export type CartMap = Record<string, number>;
export type SavedList = {
  id: string;
  name: string;
  savedAt: string; // ISO
  items: CartMap;
};

type CartContextValue = {
  items: CartMap;
  ready: boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  swapGreen: (id: string) => Product | undefined;
  swapAllGreen: () => { count: number; co2Saved: number; stores: string[] };
  total: number;
  itemCount: number;
  co2Total: number;
  plasticCount: number;
  savedLists: SavedList[];
  saveCurrentList: (name: string) => Promise<SavedList | null>;
  restoreList: (id: string) => void;
  deleteSavedList: (id: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { priceOf } = usePrices();
  const [items, setItems] = useState<CartMap>({});
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      // Fresh cart on every app launch — clear any persisted state.
      await storage.removeItem(STORAGE_KEY);
      // Saved grocery lists persist across launches.
      const raw = await storage.getItem<string>(SAVED_LISTS_KEY, "");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setSavedLists(parsed);
        } catch {}
      }
      setReady(true);
    })();
  }, []);

  // Persist saved lists whenever they change.
  useEffect(() => {
    if (!ready) return;
    storage.setItem(SAVED_LISTS_KEY, JSON.stringify(savedLists));
  }, [savedLists, ready]);

  useEffect(() => {
    if (!ready) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const add = useCallback((id: string) => {
    setItems((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = { ...prev };
      const cur = next[id] ?? 0;
      if (cur <= 1) delete next[id];
      else next[id] = cur - 1;
      return next;
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems({}), []);

  const saveCurrentList = useCallback(
    async (name: string): Promise<SavedList | null> => {
      const trimmed = name.trim() || `List ${new Date().toLocaleDateString()}`;
      if (Object.keys(items).length === 0) return null;
      const entry: SavedList = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        savedAt: new Date().toISOString(),
        items: { ...items },
      };
      setSavedLists((prev) => [entry, ...prev]);
      return entry;
    },
    [items],
  );

  const restoreList = useCallback((id: string) => {
    setSavedLists((cur) => {
      const found = cur.find((l) => l.id === id);
      if (found) setItems({ ...found.items });
      return cur;
    });
  }, []);

  const deleteSavedList = useCallback(async (id: string) => {
    setSavedLists((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const swapGreen = useCallback((id: string) => {
    const alt = getGreenAlternative(id);
    if (!alt) return undefined;
    setItems((prev) => {
      const qty = prev[id] ?? 0;
      if (qty === 0) return prev;
      const next = { ...prev };
      delete next[id];
      next[alt.id] = (next[alt.id] ?? 0) + qty;
      return next;
    });
    return alt;
  }, []);

  const swapAllGreen = useCallback(() => {
    let count = 0;
    let co2Saved = 0;
    const stores = new Set<string>();
    setItems((prev) => {
      const next: CartMap = { ...prev };
      for (const [id, qty] of Object.entries(prev)) {
        const cur = findProduct(id);
        const alt = getGreenAlternative(id);
        if (!cur || !alt) continue;
        count += qty;
        co2Saved += (cur.co2Kg - alt.co2Kg) * qty;
        stores.add(alt.brand);
        delete next[id];
        next[alt.id] = (next[alt.id] ?? 0) + qty;
      }
      return next;
    });
    return { count, co2Saved, stores: Array.from(stores) };
  }, []);

  const { total, itemCount, co2Total, plasticCount } = useMemo(() => {
    let t = 0;
    let n = 0;
    let c = 0;
    let p = 0;
    for (const [id, qty] of Object.entries(items)) {
      const prod = findProduct(id);
      if (!prod) continue;
      t += priceOf(prod.id, prod.price) * qty;
      n += qty;
      c += prod.co2Kg * qty;
      if (prod.packaging === "plastic") p += qty;
    }
    return { total: t, itemCount: n, co2Total: c, plasticCount: p };
  }, [items, priceOf]);

  const value: CartContextValue = {
    items,
    ready,
    add,
    remove,
    setQty,
    clear,
    swapGreen,
    swapAllGreen,
    total,
    itemCount,
    co2Total,
    plasticCount,
    savedLists,
    saveCurrentList,
    restoreList,
    deleteSavedList,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
