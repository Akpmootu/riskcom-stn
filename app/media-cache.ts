import type { MediaItem, MediaResponse } from "./types";

export const MEDIA_CACHE_KEY = "satun-risk-media-cache-v2";
export const ADMIN_MEDIA_CACHE_KEY = "satun-risk-admin-media-cache-v1";
export const MEDIA_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

type StoredMediaCache = {
  version: 2;
  cachedAt: number;
  response: MediaResponse;
};

export type MediaCacheSnapshot = StoredMediaCache & {
  isFresh: boolean;
};

export function readMediaCache(): MediaCacheSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(MEDIA_CACHE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredMediaCache>;
    if (
      stored.version !== 2 ||
      typeof stored.cachedAt !== "number" ||
      !stored.response ||
      !Array.isArray(stored.response.items) ||
      (stored.response.source !== "google" && stored.response.source !== "demo")
    ) {
      window.localStorage.removeItem(MEDIA_CACHE_KEY);
      return null;
    }

    return {
      version: 2,
      cachedAt: stored.cachedAt,
      response: stored.response,
      isFresh:
        stored.response.source === "google" &&
        Date.now() - stored.cachedAt < MEDIA_CACHE_MAX_AGE_MS,
    };
  } catch {
    return null;
  }
}

export function writeMediaCache(response: MediaResponse, cachedAt = Date.now()) {
  if (typeof window === "undefined") return;

  try {
    const stored: StoredMediaCache = {
      version: 2,
      cachedAt,
      response,
    };
    window.localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(stored));
  } catch {
    // Browsers may disable storage or run out of quota; live data still works.
  }
}

export function readAdminMediaCache(): {
  items: MediaItem[];
  source: MediaResponse["source"];
  cachedAt: number;
  isFresh: boolean;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_MEDIA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      cachedAt?: number;
      items?: MediaItem[];
      source?: MediaResponse["source"];
    };
    if (!Array.isArray(parsed.items) || typeof parsed.cachedAt !== "number") {
      return null;
    }
    return {
      items: parsed.items,
      source: parsed.source === "google" ? "google" : "demo",
      cachedAt: parsed.cachedAt,
      isFresh: Date.now() - parsed.cachedAt < 2 * 60 * 1000,
    };
  } catch {
    return null;
  }
}

export function writeAdminMediaCache(
  items: MediaItem[],
  source: MediaResponse["source"] = "google",
  cachedAt = Date.now(),
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ADMIN_MEDIA_CACHE_KEY,
      JSON.stringify({ items, source, cachedAt }),
    );
  } catch {
    // Ignore storage errors
  }
}

export function clearMediaCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MEDIA_CACHE_KEY);
    window.localStorage.removeItem(ADMIN_MEDIA_CACHE_KEY);
  } catch {
    // Storage may be unavailable in private browsing.
  }
}
