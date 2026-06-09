// Mock 3-day price refresh — fetches deterministic multipliers from the
// backend and applies them to the catalog. The cart total, product cards,
// saved lists, and impact basket total all read prices via `usePriceOf`.

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

type PricesResponse = {
  window: number;
  refreshed_at: string;
  next_refresh_at: string;
  multipliers: Record<string, number>;
};

type PricesState = {
  ready: boolean;
  refreshedAt: string | null;
  nextRefreshAt: string | null;
  multipliers: Record<string, number>;
  /** Returns the effective price for a product, applying the multiplier. */
  priceOf: (productId: string, basePrice: number) => number;
};

const PricesContext = createContext<PricesState | undefined>(undefined);

export function PricesProvider({ children }: { children: React.ReactNode }) {
  const [multipliers, setMultipliers] = useState<Record<string, number>>({});
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/prices/current`);
      if (!res.ok) return;
      const data: PricesResponse = await res.json();
      setMultipliers(data.multipliers);
      setRefreshedAt(data.refreshed_at);
      setNextRefreshAt(data.next_refresh_at);
    } catch {
      // network failure → keep base prices
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Re-check every hour for a new 3-day window. The backend computes the
    // window from wall-clock UTC, so this is enough to pick up changes.
    const t = setInterval(refresh, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const priceOf = useCallback(
    (productId: string, basePrice: number) => {
      const m = multipliers[productId];
      if (!m) return basePrice;
      // Round to cents.
      return Math.round(basePrice * m * 100) / 100;
    },
    [multipliers],
  );

  return (
    <PricesContext.Provider
      value={{ ready, multipliers, refreshedAt, nextRefreshAt, priceOf }}
    >
      {children}
    </PricesContext.Provider>
  );
}

export function usePrices() {
  const ctx = useContext(PricesContext);
  if (!ctx) throw new Error("usePrices must be used inside PricesProvider");
  return ctx;
}

/** Convenience hook — returns the price-of helper directly. */
export function usePriceOf() {
  return usePrices().priceOf;
}
