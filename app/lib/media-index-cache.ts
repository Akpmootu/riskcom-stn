import { normalizeMediaItems } from "@/app/lib/media-gallery-utils";
import { getGoogleScriptUrl, postToGoogle } from "@/app/lib/server";
import type { IncidentPhase, MediaItem } from "@/app/types";

export type IndexedMediaSnapshot = {
  allItems: MediaItem[];
  publishedItems: MediaItem[];
  byId: Map<string, MediaItem>;
  byPhase: Record<IncidentPhase, MediaItem[]>;
  byCategory: Map<string, MediaItem[]>;
  updatedAt: number;
};

const FRESH_TTL_MS = 60 * 1000; // 60 seconds fresh
const STALE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes stale-while-revalidate

let currentSnapshot: IndexedMediaSnapshot | null = null;
let inflightRefresh: Promise<IndexedMediaSnapshot> | null = null;
const deletedMediaIds = new Set<string>();

function buildIndexedSnapshot(rawItems: MediaItem[]): IndexedMediaSnapshot {
  const normalizedAll = normalizeMediaItems(rawItems, ["published", "draft"]).filter(
    (item) => !deletedMediaIds.has(item.id),
  );

  const byId = new Map<string, MediaItem>();
  const byPhase: Record<IncidentPhase, MediaItem[]> = {
    before: [],
    during: [],
    after: [],
  };
  const byCategory = new Map<string, MediaItem[]>();
  const publishedItems: MediaItem[] = [];

  for (const item of normalizedAll) {
    byId.set(item.id, item);
    if (item.status === "published") {
      publishedItems.push(item);
      if (byPhase[item.phase]) {
        byPhase[item.phase].push(item);
      }
      const cats = Array.isArray(item.categories) && item.categories.length > 0
        ? item.categories
        : [item.category];
      for (const cat of cats) {
        const list = byCategory.get(cat) ?? [];
        list.push(item);
        byCategory.set(cat, list);
      }
    }
  }

  return {
    allItems: normalizedAll,
    publishedItems,
    byId,
    byPhase,
    byCategory,
    updatedAt: Date.now(),
  };
}

async function fetchRawAllMediaFromGoogle(): Promise<MediaItem[]> {
  const url = getGoogleScriptUrl();
  if (!url) {
    throw new Error("ยังไม่ได้เชื่อมต่อ Google Apps Script");
  }

  try {
    const result = await postToGoogle({ action: "listAllMedia" }, 2);
    if (result.ok && Array.isArray(result.items)) {
      return result.items as MediaItem[];
    }
  } catch {
    // Fallback to GET action=list
  }

  const target = new URL(url);
  target.searchParams.set("action", "list");
  target.searchParams.set("status", "published");
  const response = await fetch(target, {
    headers: { accept: "application/json" },
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Google Apps Script ${response.status}`);
  }
  const parsed = (await response.json()) as {
    ok?: boolean;
    items?: MediaItem[];
    error?: string;
  };
  if (!parsed.ok || !Array.isArray(parsed.items)) {
    throw new Error(parsed.error || "ไม่พบรายการสื่อ");
  }
  return parsed.items;
}

export async function getIndexedMediaSnapshot(options?: {
  forceRefresh?: boolean;
}): Promise<IndexedMediaSnapshot> {
  const forceRefresh = Boolean(options?.forceRefresh);
  const now = Date.now();

  if (!forceRefresh && currentSnapshot) {
    const age = now - currentSnapshot.updatedAt;
    if (age < FRESH_TTL_MS) {
      return currentSnapshot;
    }
    if (age < STALE_MAX_AGE_MS) {
      // Return cached snapshot immediately & revalidate in background (SWR)
      if (!inflightRefresh) {
        inflightRefresh = fetchRawAllMediaFromGoogle()
          .then((items) => {
            currentSnapshot = buildIndexedSnapshot(items);
            return currentSnapshot;
          })
          .catch(() => currentSnapshot!)
          .finally(() => {
            inflightRefresh = null;
          });
      }
      return currentSnapshot;
    }
  }

  if (inflightRefresh) {
    return inflightRefresh;
  }

  inflightRefresh = fetchRawAllMediaFromGoogle()
    .then((items) => {
      currentSnapshot = buildIndexedSnapshot(items);
      return currentSnapshot;
    })
    .finally(() => {
      inflightRefresh = null;
    });

  return inflightRefresh;
}

export function upsertIndexedMediaItem(item: MediaItem | null | undefined): void {
  if (!item || !item.id) return;
  deletedMediaIds.delete(item.id);
  if (!currentSnapshot) return;

  const existing = currentSnapshot.allItems.filter((entry) => entry.id !== item.id);
  currentSnapshot = buildIndexedSnapshot([item, ...existing]);
}

export function removeIndexedMediaIds(ids: string[]): void {
  const validIds = ids.map((id) => String(id || "").trim()).filter(Boolean);
  for (const id of validIds) {
    deletedMediaIds.add(id);
  }
  if (!currentSnapshot) return;
  const remaining = currentSnapshot.allItems.filter(
    (entry) => !deletedMediaIds.has(entry.id),
  );
  currentSnapshot = buildIndexedSnapshot(remaining);
}
