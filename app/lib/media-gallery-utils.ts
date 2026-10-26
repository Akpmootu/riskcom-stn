import {
  formatCategoriesField,
  parseCategories,
} from "@/app/lib/category-tags";
import type { MediaItem, MediaSlide } from "@/app/types";

export const SLIDE_ATTACHMENT_TITLE = "__SLIDE_ATTACHMENT__";
export const SLIDE_CHILD_KEYWORD = "__slide_child__";
export const GALLERY_KEYWORD_PREFIX = "__gallery__:";

type CompactSlide = {
  i: string;
  d?: string;
  n: string;
  t: string;
  u?: string;
  l?: string;
};

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeGalleryKeyword(extraSlides: MediaSlide[]): string | null {
  const valid = extraSlides.filter(
    (slide) => Boolean(slide && (slide.driveFileId || slide.thumbnailUrl || slide.downloadUrl)),
  );
  if (valid.length === 0) return null;

  const compact: CompactSlide[] = valid.map((slide) => {
    const entry: CompactSlide = {
      i: String(slide.id || ""),
      n: String(slide.fileName || "image.jpg"),
      t: String(slide.fileType || "image/jpeg"),
    };
    if (slide.driveFileId) {
      entry.d = String(slide.driveFileId);
    } else {
      if (slide.thumbnailUrl) entry.u = slide.thumbnailUrl;
      if (slide.downloadUrl) entry.l = slide.downloadUrl;
    }
    return entry;
  });

  try {
    return `${GALLERY_KEYWORD_PREFIX}${toBase64Url(JSON.stringify(compact))}`;
  } catch {
    return null;
  }
}

export function decodeGalleryKeyword(token: string): MediaSlide[] {
  if (!token.startsWith(GALLERY_KEYWORD_PREFIX)) return [];
  const encoded = token.slice(GALLERY_KEYWORD_PREFIX.length).trim();
  if (!encoded) return [];

  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as unknown;
    if (!Array.isArray(parsed)) return [];
    const slides: MediaSlide[] = [];
    for (const raw of parsed) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Partial<CompactSlide>;
      const driveFileId = entry.d ? String(entry.d) : undefined;
      const thumbnailUrl = driveFileId
        ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1600`
        : entry.u
          ? String(entry.u)
          : undefined;
      const downloadUrl = driveFileId
        ? `https://drive.google.com/uc?export=download&id=${driveFileId}`
        : entry.l
          ? String(entry.l)
          : undefined;

      slides.push({
        id: String(entry.i || driveFileId || ""),
        driveFileId,
        thumbnailUrl,
        downloadUrl,
        fileName: String(entry.n || "image.jpg"),
        fileType: String(entry.t || "image/jpeg"),
      });
    }
    return slides;
  } catch {
    return [];
  }
}

export function getMediaSlides(item: MediaItem): MediaSlide[] {
  if (Array.isArray(item.gallery) && item.gallery.length > 0) {
    return item.gallery;
  }
  return [
    {
      id: item.id,
      driveFileId: item.driveFileId,
      thumbnailUrl: item.thumbnailUrl,
      downloadUrl: item.downloadUrl,
      fileName: item.fileName,
      fileType: item.fileType,
    },
  ];
}

export function normalizeMediaItem(
  raw: Partial<MediaItem> & { status?: string },
  allowedStatuses: Array<"published" | "draft"> = ["published", "draft"],
): MediaItem | null {
  if (!raw || !raw.id) return null;

  const rawStatus = String(raw.status || "").trim().toLowerCase();
  if (!allowedStatuses.includes(rawStatus as "published" | "draft")) {
    return null;
  }

  const title = String(raw.title || "").trim();
  if (!title || title === SLIDE_ATTACHMENT_TITLE) {
    return null;
  }

  const rawKeywords = Array.isArray(raw.keywords)
    ? raw.keywords.map((k) => String(k || "").trim()).filter(Boolean)
    : [];

  if (rawKeywords.includes(SLIDE_CHILD_KEYWORD)) {
    return null;
  }

  const visibleKeywords: string[] = [];
  const extraSlides: MediaSlide[] = [];

  for (const keyword of rawKeywords) {
    if (keyword.startsWith(GALLERY_KEYWORD_PREFIX)) {
      extraSlides.push(...decodeGalleryKeyword(keyword));
    } else if (keyword !== SLIDE_CHILD_KEYWORD) {
      visibleKeywords.push(keyword);
    }
  }

  const primarySlide: MediaSlide = {
    id: String(raw.id),
    driveFileId: raw.driveFileId ? String(raw.driveFileId) : undefined,
    thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : undefined,
    downloadUrl: raw.downloadUrl ? String(raw.downloadUrl) : undefined,
    fileName: String(raw.fileName || ""),
    fileType: String(raw.fileType || "image/jpeg"),
  };

  const existingExtra =
    extraSlides.length === 0 && Array.isArray(raw.gallery) && raw.gallery.length > 1
      ? raw.gallery.slice(1)
      : extraSlides;

  const gallery = [primarySlide, ...existingExtra];
  const parsedCategories = parseCategories(
    Array.isArray(raw.categories) && raw.categories.length > 0
      ? raw.categories
      : raw.category,
  );
  const effectiveCategories =
    parsedCategories.length > 0 ? parsedCategories : ["อื่นๆ"];
  const formattedCategory = formatCategoriesField(effectiveCategories);
  const searchIndex = [
    title,
    raw.description,
    formattedCategory,
    raw.location,
    raw.fileName,
    raw.uploadedBy,
    ...effectiveCategories,
    ...visibleKeywords,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("th");

  return {
    ...(raw as MediaItem),
    id: String(raw.id),
    title,
    category: formattedCategory,
    categories: effectiveCategories,
    status: rawStatus as "published" | "draft",
    keywords: visibleKeywords,
    gallery,
    viewCount: Math.max(0, Math.trunc(Number(raw.viewCount || 0))),
    _searchIndex: searchIndex,
  };
}

export function normalizeMediaItems(
  rawItems: unknown[],
  allowedStatuses: Array<"published" | "draft"> = ["published", "draft"],
): MediaItem[] {
  if (!Array.isArray(rawItems)) return [];
  const normalized: MediaItem[] = [];
  for (const entry of rawItems) {
    if (!entry || typeof entry !== "object") continue;
    const item = normalizeMediaItem(
      entry as Partial<MediaItem> & { status?: string },
      allowedStatuses,
    );
    if (item) normalized.push(item);
  }
  return normalized;
}
