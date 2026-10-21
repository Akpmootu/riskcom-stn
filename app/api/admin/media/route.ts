import { formatCategoriesField } from "@/app/lib/category-tags";
import {
  encodeGalleryKeyword,
  normalizeMediaItem,
} from "@/app/lib/media-gallery-utils";
import {
  getIndexedMediaSnapshot,
  upsertIndexedMediaItem,
} from "@/app/lib/media-index-cache";
import { json, postToGoogle } from "@/app/lib/server";
import {
  portalErrorResponse,
  requireApprovedPortalUser,
} from "@/app/lib/users";
import type { MediaItem, MediaSlide } from "@/app/types";

export const dynamic = "force-dynamic";

async function mediaForUser(forceRefresh = false) {
  const { user } = await requireApprovedPortalUser();
  const snapshot = await getIndexedMediaSnapshot({ forceRefresh });
  const items = snapshot.allItems;

  if (user.role === "uploader") {
    return {
      user,
      items: items.filter(
        (item) =>
          String(item.uploadedBy || "").toLowerCase() ===
          user.email.toLowerCase(),
      ),
    };
  }
  return { user, items };
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const forceRefresh = requestUrl.searchParams.has("refresh");
    const { items } = await mediaForUser(forceRefresh);
    return json({ ok: true, items, source: "google" });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, items } = await mediaForUser();
    const body = (await request.json()) as Partial<MediaItem> & {
      id?: string;
      extraSlides?: MediaSlide[];
    };
    const current = items.find((item) => item.id === body.id);
    if (!current) {
      return json(
        { ok: false, error: "ไม่พบรายการสื่อ หรือบัญชีนี้ไม่มีสิทธิ์แก้ไข" },
        { status: 404 },
      );
    }

    const userKeywords = Array.isArray(body.keywords)
      ? body.keywords
          .map(String)
          .map((item) => item.trim())
          .filter((item) => Boolean(item) && !item.startsWith("__gallery__:"))
      : [];

    const extraSlides = Array.isArray(body.extraSlides)
      ? body.extraSlides
      : Array.isArray(current.gallery) && current.gallery.length > 1
        ? current.gallery.slice(1)
        : [];

    const galleryToken = encodeGalleryKeyword(extraSlides);
    const finalKeywords = galleryToken
      ? [...userKeywords, galleryToken]
      : userKeywords;

    const formattedCategory = formatCategoriesField(
      Array.isArray(body.categories) && body.categories.length > 0
        ? body.categories
        : body.category,
    );

    const result = await postToGoogle({
      action: "updateMedia",
      id: current.id,
      title: String(body.title || "").trim(),
      description: String(body.description || "").trim(),
      phase: body.phase,
      category: formattedCategory,
      eventDate: String(body.eventDate || ""),
      location: String(body.location || "").trim(),
      keywords: finalKeywords,
      altText: String(body.altText || "").trim(),
      status: body.status === "draft" ? "draft" : "published",
      editedBy: user.email,
    });
    if (!result.ok) {
      throw new Error(String(result.error || "แก้ไขข้อมูลสื่อไม่สำเร็จ"));
    }

    const normalizedItem =
      result.item && typeof result.item === "object"
        ? normalizeMediaItem(result.item as Partial<MediaItem> & { status?: string })
        : null;

    if (normalizedItem) {
      upsertIndexedMediaItem(normalizedItem);
    }

    return json({
      ...result,
      item: normalizedItem ?? result.item,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
