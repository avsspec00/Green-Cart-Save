// Tiny fetch wrapper for Green Cart Save backend. Reads the base URL from
// EXPO_PUBLIC_BACKEND_URL and attaches the admin JWT when present.

import { storage } from "@/src/utils/storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
const TOKEN_KEY = "greencart.admin.token.v1";

export type ActiveSponsorship = {
  product_id: string;
  bid_cents: number;
  advertiser_name: string;
};

export type Advertiser = {
  id: string;
  name: string;
  contact_email: string;
  created_at: string;
};

export type Sponsorship = {
  id: string;
  advertiser_id: string;
  advertiser_name?: string;
  product_id: string;
  bid_cents: number;
  active: boolean;
  created_at: string;
};

async function getToken(): Promise<string | null> {
  return storage.getItem<string>(TOKEN_KEY, "").then((v) => v || null);
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE_URL}/api${path}`, { ...init, headers });
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      // ignore
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Public ----------------------------------------------------------------

export async function fetchActiveSponsorships(): Promise<ActiveSponsorship[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/sponsorships/active`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ---- Auth ------------------------------------------------------------------

export async function adminLogin(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email.trim().toLowerCase(), password });
  const res = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const data = await jsonOrThrow<{ access_token: string }>(res);
  await storage.setItem(TOKEN_KEY, data.access_token);
  return data.access_token;
}

export async function adminLogout(): Promise<void> {
  await storage.removeItem(TOKEN_KEY);
}

export async function getStoredToken(): Promise<string | null> {
  return getToken();
}

export async function adminMe(): Promise<{ id: string; email: string }> {
  const res = await authedFetch("/admin/me");
  return jsonOrThrow(res);
}

// ---- Advertisers -----------------------------------------------------------

export async function listAdvertisers(): Promise<Advertiser[]> {
  const res = await authedFetch("/admin/advertisers");
  return jsonOrThrow(res);
}

export async function createAdvertiser(
  name: string,
  contact_email: string,
): Promise<Advertiser> {
  const res = await authedFetch("/admin/advertisers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, contact_email }),
  });
  return jsonOrThrow(res);
}

export async function deleteAdvertiser(id: string): Promise<void> {
  const res = await authedFetch(`/admin/advertisers/${id}`, { method: "DELETE" });
  return jsonOrThrow(res);
}

// ---- Sponsorships ----------------------------------------------------------

export async function listSponsorships(): Promise<Sponsorship[]> {
  const res = await authedFetch("/admin/sponsorships");
  return jsonOrThrow(res);
}

export async function createSponsorship(input: {
  advertiser_id: string;
  product_id: string;
  bid_cents: number;
  active?: boolean;
}): Promise<Sponsorship> {
  const res = await authedFetch("/admin/sponsorships", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active: true, ...input }),
  });
  return jsonOrThrow(res);
}

export async function updateSponsorship(
  id: string,
  patch: { active?: boolean; bid_cents?: number },
): Promise<Sponsorship> {
  const res = await authedFetch(`/admin/sponsorships/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return jsonOrThrow(res);
}

export async function deleteSponsorship(id: string): Promise<void> {
  const res = await authedFetch(`/admin/sponsorships/${id}`, { method: "DELETE" });
  return jsonOrThrow(res);
}
