import { getGoogleScriptUrl } from "@/app/lib/server";
import type { IncidentPhase, MediaItem } from "@/app/types";

const API_VERSION = "1.0";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type PublicMediaItem = Pick<
  MediaItem,
  | "id"
  | "title"
  | "description"
  | "phase"
  | "category"
  | "eventDate"
  | "location"
  | "keywords"
  | "altText"
  | "thumbnailUrl"
  | "downloadUrl"
  | "fileName"
  | "fileType"
  | "createdAt"
  | "updatedAt"
>;

type SortOrder = "newest" | "oldest" | "updated";

export type PublicMediaQuery = {
  q: string;
  phase: IncidentPhase | "all";
  category: string;
  from: string;
  to: string;
  sort: SortOrder;
  page: number;
  limit: number;
};

export class PublicMediaApiError extends Error {
  constructor(
    message: string,
    public readonly status = 503,
    public readonly code = "MEDIA_SERVICE_UNAVAILABLE",
  ) {
    super(message);
  }
}

export function publicApiHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "Accept, Content-Type, If-None-Match");
  headers.set("access-control-expose-headers", "ETag, X-API-Version");
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, s-maxage=300, stale-while-revalidate=600");
  }
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-api-version", API_VERSION);
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

export function publicApiJson(
  data: unknown,
  init: ResponseInit = {},
  etag?: string,
) {
  const headers = publicApiHeaders(init.headers);
  if (etag) headers.set("etag", etag);
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function publicApiOptions() {
  const headers = publicApiHeaders();
  headers.delete("content-type");
  return new Response(null, { status: 204, headers });
}

export function publicApiError(error: unknown) {
  const known = error instanceof PublicMediaApiError;
  return publicApiJson(
    {
      apiVersion: API_VERSION,
      error: {
        code: known ? error.code : "MEDIA_SERVICE_UNAVAILABLE",
        message: known
          ? error.message
          : "ไม่สามารถเชื่อมต่อคลังสื่อได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
      },
    },
    {
      status: known ? error.status : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function fetchPublishedMedia(): Promise<PublicMediaItem[]> {
  const scriptUrl = getGoogleScriptUrl();
  if (!scriptUrl) {
    throw new PublicMediaApiError(
      "ยังไม่ได้เชื่อมต่อแหล่งข้อมูลคลังสื่อ",
      503,
      "MEDIA_SOURCE_NOT_CONFIGURED",
    );
  }

  const target = new URL(scriptUrl);
  target.searchParams.set("action", "list");
  target.searchParams.set("status", "published");

  const response = await fetch(target, {
    headers: { accept: "application/json" },
    redirect: "follow",
    cache: "force-cache",
    next: { revalidate: 300 },
  });
  if (!response.ok) {
    throw new PublicMediaApiError(`แหล่งข้อมูลตอบกลับ ${response.status}`);
  }

  const result = (await response.json()) as {
    ok?: boolean;
    items?: MediaItem[];
    error?: string;
  };
  if (!result.ok || !Array.isArray(result.items)) {
    throw new PublicMediaApiError(result.error || "ไม่พบรายการสื่อ");
  }

  return result.items
    .filter((item) => item.status === "published")
    .map(toPublicMediaItem);
}

export function parsePublicMediaQuery(url: URL): PublicMediaQuery {
  const phaseValue = url.searchParams.get("phase")?.trim() || "all";
  if (!["all", "before", "during", "after"].includes(phaseValue)) {
    throw new PublicMediaApiError(
      "phase ต้องเป็น before, during หรือ after",
      400,
      "INVALID_PHASE",
    );
  }

  const sortValue = url.searchParams.get("sort")?.trim() || "newest";
  if (!["newest", "oldest", "updated"].includes(sortValue)) {
    throw new PublicMediaApiError(
      "sort ต้องเป็น newest, oldest หรือ updated",
      400,
      "INVALID_SORT",
    );
  }

  const from = parseDateParam(url.searchParams.get("from"), "from");
  const to = parseDateParam(url.searchParams.get("to"), "to");
  if (from && to && from > to) {
    throw new PublicMediaApiError(
      "from ต้องไม่อยู่หลัง to",
      400,
      "INVALID_DATE_RANGE",
    );
  }

  return {
    q: url.searchParams.get("q")?.trim() || "",
    phase: phaseValue as IncidentPhase | "all",
    category: url.searchParams.get("category")?.trim() || "",
    from,
    to,
    sort: sortValue as SortOrder,
    page: parsePositiveInteger(url.searchParams.get("page"), 1, "page"),
    limit: Math.min(
      parsePositiveInteger(
        url.searchParams.get("limit"),
        DEFAULT_PAGE_SIZE,
        "limit",
      ),
      MAX_PAGE_SIZE,
    ),
  };
}

export function filterPublicMedia(
  items: PublicMediaItem[],
  query: PublicMediaQuery,
) {
  const needle = query.q.toLocaleLowerCase("th-TH");
  const category = query.category.toLocaleLowerCase("th-TH");

  return items
    .filter((item) => {
      if (query.phase !== "all" && item.phase !== query.phase) return false;
      if (category && item.category.toLocaleLowerCase("th-TH") !== category) {
        return false;
      }
      if (query.from && item.eventDate < query.from) return false;
      if (query.to && item.eventDate > query.to) return false;
      if (!needle) return true;
      return [
        item.title,
        item.description,
        item.location,
        item.category,
        ...item.keywords,
      ]
        .join(" ")
        .toLocaleLowerCase("th-TH")
        .includes(needle);
    })
    .sort((left, right) => {
      if (query.sort === "oldest") {
        return left.eventDate.localeCompare(right.eventDate);
      }
      if (query.sort === "updated") {
        return getUpdatedTime(right).localeCompare(getUpdatedTime(left));
      }
      return right.eventDate.localeCompare(left.eventDate);
    });
}

export function createMediaEtag(items: PublicMediaItem[], variant = "") {
  const newestUpdate = items.reduce(
    (latest, item) => (getUpdatedTime(item) > latest ? getUpdatedTime(item) : latest),
    "",
  );
  return `W/\"media-${items.length}-${newestUpdate || "empty"}-${checksum(variant)}\"`;
}

function toPublicMediaItem(item: MediaItem): PublicMediaItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    phase: item.phase,
    category: item.category,
    eventDate: item.eventDate,
    location: item.location,
    keywords: item.keywords,
    altText: item.altText,
    thumbnailUrl: item.thumbnailUrl,
    downloadUrl: item.downloadUrl,
    fileName: item.fileName,
    fileType: item.fileType,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function parsePositiveInteger(value: string | null, fallback: number, name: string) {
  if (!value) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new PublicMediaApiError(
      `${name} ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป`,
      400,
      `INVALID_${name.toUpperCase()}`,
    );
  }
  return Number(value);
}

function parseDateParam(value: string | null, name: string) {
  const normalized = value?.trim() || "";
  if (normalized && !isValidDateString(normalized)) {
    throw new PublicMediaApiError(
      `${name} ต้องอยู่ในรูปแบบ YYYY-MM-DD`,
      400,
      `INVALID_${name.toUpperCase()}`,
    );
  }
  return normalized;
}

function getUpdatedTime(item: PublicMediaItem) {
  return item.updatedAt || item.createdAt || item.eventDate;
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function checksum(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
