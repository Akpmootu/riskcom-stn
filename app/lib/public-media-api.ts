import { getItemCategories, resolveTagConfig } from "@/app/lib/category-tags";
import { getMediaSlides, normalizeMediaItems } from "@/app/lib/media-gallery-utils";
import { getIndexedMediaSnapshot } from "@/app/lib/media-index-cache";
import { getPublicApiContext } from "@/app/lib/public-api-context";
import { getGoogleScriptUrl } from "@/app/lib/server";
import { selectWatchMediaItems, type WatchSituationConfig } from "@/app/lib/watch-situation";
import type { CategoryTagConfig } from "@/app/lib/category-tags";
import type { IncidentPhase, MediaItem } from "@/app/types";

export const PUBLIC_API_VERSION = "1.1";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type PublicMediaAsset = { id: string; fileName: string; fileType: string; thumbnailUrl: string | null; downloadUrl: string | null };
export type PublicMediaTag = { name: string; color: string; backgroundColor: string; textColor: string; borderColor: string; icon: string };
export type PublicMediaItem = {
  id: string; title: string; description: string; phase: IncidentPhase;
  category: string; categories: string[]; tags: PublicMediaTag[];
  eventDate: string; location: string; keywords: string[]; altText: string;
  thumbnailUrl?: string; downloadUrl?: string; fileName: string; fileType: string;
  images: PublicMediaAsset[]; imageCount: number; viewCount: number;
  isRecommended: boolean; recommendationRank: number | null;
  recommendationReason: "pinned" | "situation-match" | null;
  createdAt?: string; updatedAt?: string;
};
export type PublicMediaSituation = Pick<WatchSituationConfig, "enabled" | "title" | "subtitle" | "severity" | "phase" | "categories" | "location" | "advisoryText" | "updatedAt" | "updatedBy">;
export type PublicMediaCatalog = { items: PublicMediaItem[]; recommended: PublicMediaItem[]; situation: PublicMediaSituation };
type SortOrder = "newest" | "oldest" | "updated" | "popular";
export type PublicMediaQuery = { q: string; phase: IncidentPhase | "all"; category: string; from: string; to: string; sort: SortOrder; page: number; limit: number };

export class PublicMediaApiError extends Error {
  constructor(message: string, public readonly status = 503, public readonly code = "MEDIA_SERVICE_UNAVAILABLE") { super(message); }
}

export function publicApiHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "Accept, Authorization, Content-Type, If-None-Match, X-API-Key");
  headers.set("access-control-expose-headers", "ETag, X-API-Version");
  if (!headers.has("cache-control")) headers.set("cache-control", "private, max-age=60, stale-while-revalidate=300");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-api-version", PUBLIC_API_VERSION);
  headers.set("x-content-type-options", "nosniff");
  headers.append("vary", "Authorization");
  headers.append("vary", "X-API-Key");
  return headers;
}
export function publicApiJson(data: unknown, init: ResponseInit = {}, etag?: string) {
  const headers = publicApiHeaders(init.headers); if (etag) headers.set("etag", etag);
  return new Response(JSON.stringify(data), { ...init, headers });
}
export function publicApiOptions() { const headers = publicApiHeaders(); headers.delete("content-type"); return new Response(null, { status: 204, headers }); }
export function publicApiError(error: unknown) {
  const known = error instanceof PublicMediaApiError; const status = known ? error.status : 503;
  return publicApiJson({ apiVersion: PUBLIC_API_VERSION, error: { code: known ? error.code : "MEDIA_SERVICE_UNAVAILABLE", message: known ? error.message : "ไม่สามารถเชื่อมต่อคลังสื่อได้ในขณะนี้ กรุณาลองใหม่ภายหลัง" } }, { status, headers: { "cache-control": "no-store", ...(status === 401 ? { "www-authenticate": "Bearer" } : {}) } });
}

export async function fetchPublicMediaCatalog(): Promise<PublicMediaCatalog> {
  const [rawItems, context] = await Promise.all([fetchRawPublishedMedia(), getPublicApiContext()]);
  const recommendedRaw = context.watchSituation.enabled ? selectWatchMediaItems(rawItems, context.watchSituation, 8) : [];
  const recommendedIds = new Map(recommendedRaw.map((item, index) => [item.id, index + 1]));
  const pinnedIds = new Set(context.watchSituation.pinnedMediaIds);
  const items = rawItems.map((item) => toPublicMediaItem(item, context.tagConfigs, recommendedIds.get(item.id) ?? null, pinnedIds.has(item.id)));
  return {
    items,
    recommended: items.filter((item) => item.isRecommended).sort((a, b) => (a.recommendationRank || 999) - (b.recommendationRank || 999)),
    situation: {
      enabled: context.watchSituation.enabled, title: context.watchSituation.title,
      subtitle: context.watchSituation.subtitle, severity: context.watchSituation.severity,
      phase: context.watchSituation.phase, categories: context.watchSituation.categories,
      location: context.watchSituation.location, advisoryText: context.watchSituation.advisoryText,
      updatedAt: context.watchSituation.updatedAt, updatedBy: context.watchSituation.updatedBy,
    },
  };
}
export async function fetchPublishedMedia() { return (await fetchPublicMediaCatalog()).items; }

async function fetchRawPublishedMedia(): Promise<MediaItem[]> {
  const scriptUrl = getGoogleScriptUrl();
  if (!scriptUrl) throw new PublicMediaApiError("ยังไม่ได้เชื่อมต่อแหล่งข้อมูลคลังสื่อ", 503, "MEDIA_SOURCE_NOT_CONFIGURED");
  try { const snapshot = await getIndexedMediaSnapshot(); if (snapshot.publishedItems.length > 0) return snapshot.publishedItems; } catch { /* direct fallback */ }
  const target = new URL(scriptUrl); target.searchParams.set("action", "list"); target.searchParams.set("status", "published");
  const response = await fetch(target, { headers: { accept: "application/json" }, redirect: "follow", cache: "force-cache", next: { revalidate: 300 } });
  if (!response.ok) throw new PublicMediaApiError(`แหล่งข้อมูลตอบกลับ ${response.status}`);
  const result = (await response.json()) as { ok?: boolean; items?: MediaItem[]; error?: string };
  if (!result.ok || !Array.isArray(result.items)) throw new PublicMediaApiError(result.error || "ไม่พบรายการสื่อ");
  return normalizeMediaItems(result.items, ["published"]);
}

export function parsePublicMediaQuery(url: URL): PublicMediaQuery {
  const phaseValue = url.searchParams.get("phase")?.trim() || "all";
  if (!["all", "before", "during", "after"].includes(phaseValue)) throw new PublicMediaApiError("phase ต้องเป็น before, during หรือ after", 400, "INVALID_PHASE");
  const sortValue = url.searchParams.get("sort")?.trim() || "newest";
  if (!["newest", "oldest", "updated", "popular"].includes(sortValue)) throw new PublicMediaApiError("sort ต้องเป็น newest, oldest, updated หรือ popular", 400, "INVALID_SORT");
  const from = parseDateParam(url.searchParams.get("from"), "from"); const to = parseDateParam(url.searchParams.get("to"), "to");
  if (from && to && from > to) throw new PublicMediaApiError("from ต้องไม่อยู่หลัง to", 400, "INVALID_DATE_RANGE");
  return { q: url.searchParams.get("q")?.trim() || "", phase: phaseValue as IncidentPhase | "all", category: url.searchParams.get("category")?.trim() || "", from, to, sort: sortValue as SortOrder, page: parsePositiveInteger(url.searchParams.get("page"), 1, "page"), limit: Math.min(parsePositiveInteger(url.searchParams.get("limit"), DEFAULT_PAGE_SIZE, "limit"), MAX_PAGE_SIZE) };
}

export function filterPublicMedia(items: PublicMediaItem[], query: PublicMediaQuery) {
  const needle = query.q.toLocaleLowerCase("th-TH"); const category = query.category.toLocaleLowerCase("th-TH");
  return items.filter((item) => {
    if (query.phase !== "all" && item.phase !== query.phase) return false;
    if (category && !item.categories.some((c) => c.toLocaleLowerCase("th-TH") === category)) return false;
    if (query.from && item.eventDate < query.from) return false; if (query.to && item.eventDate > query.to) return false;
    if (!needle) return true;
    return [item.title, item.description, item.location, ...item.categories, ...item.keywords].join(" ").toLocaleLowerCase("th-TH").includes(needle);
  }).sort((left, right) => {
    if (query.sort === "oldest") return left.eventDate.localeCompare(right.eventDate);
    if (query.sort === "updated") return getUpdatedTime(right).localeCompare(getUpdatedTime(left));
    if (query.sort === "popular") return right.viewCount - left.viewCount;
    return right.eventDate.localeCompare(left.eventDate);
  });
}

export function createMediaEtag(items: PublicMediaItem[], variant = "") {
  const signature = items.map((item) => `${item.id}:${getUpdatedTime(item)}:${item.viewCount}`).join("|");
  return `W/\"media-${items.length}-${checksum(`${signature}|${variant}`)}\"`;
}

function toPublicMediaItem(item: MediaItem, tagConfigs: CategoryTagConfig[], recommendationRank: number | null, pinned: boolean): PublicMediaItem {
  const categories = getItemCategories(item);
  const images = getMediaSlides(item).map((image) => ({ id: image.id, fileName: image.fileName, fileType: image.fileType, thumbnailUrl: image.thumbnailUrl || null, downloadUrl: image.downloadUrl || null }));
  return {
    id: item.id, title: item.title, description: item.description, phase: item.phase,
    category: item.category, categories,
    tags: categories.map((name) => { const tag = resolveTagConfig(name, tagConfigs); return { name, color: tag.color, backgroundColor: tag.bgColor, textColor: tag.textColor, borderColor: tag.borderColor, icon: tag.icon }; }),
    eventDate: item.eventDate, location: item.location, keywords: item.keywords, altText: item.altText,
    thumbnailUrl: item.thumbnailUrl, downloadUrl: item.downloadUrl, fileName: item.fileName, fileType: item.fileType,
    images, imageCount: images.length, viewCount: Number(item.viewCount || 0),
    isRecommended: recommendationRank !== null, recommendationRank,
    recommendationReason: recommendationRank === null ? null : pinned ? "pinned" : "situation-match",
    createdAt: item.createdAt, updatedAt: item.updatedAt,
  };
}

function parsePositiveInteger(value: string | null, fallback: number, name: string) { if (!value) return fallback; if (!/^\d+$/.test(value) || Number(value) < 1) throw new PublicMediaApiError(`${name} ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป`, 400, `INVALID_${name.toUpperCase()}`); return Number(value); }
function parseDateParam(value: string | null, name: string) { const normalized = value?.trim() || ""; if (normalized && !isValidDateString(normalized)) throw new PublicMediaApiError(`${name} ต้องอยู่ในรูปแบบ YYYY-MM-DD`, 400, `INVALID_${name.toUpperCase()}`); return normalized; }
function getUpdatedTime(item: PublicMediaItem) { return item.updatedAt || item.createdAt || item.eventDate; }
function isValidDateString(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const [year, month, day] = value.split("-").map(Number); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day; }
function checksum(value: string) { let hash = 0; for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0; return hash.toString(36); }
