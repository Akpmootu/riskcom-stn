import { json, postToGoogle } from "@/app/lib/server";
import {
  portalErrorResponse,
  requireApprovedPortalUser,
} from "@/app/lib/users";
import type { MediaItem } from "@/app/types";

export const dynamic = "force-dynamic";

async function mediaForUser() {
  const { user } = await requireApprovedPortalUser();
  const result = await postToGoogle({ action: "listAllMedia" });
  if (!result.ok || !Array.isArray(result.items)) {
    throw new Error(String(result.error || "ไม่สามารถโหลดรายการสื่อได้"));
  }

  const items = result.items as MediaItem[];
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

export async function GET() {
  try {
    const { items } = await mediaForUser();
    return json({ ok: true, items, source: "google" });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, items } = await mediaForUser();
    const body = (await request.json()) as Partial<MediaItem> & { id?: string };
    const current = items.find((item) => item.id === body.id);
    if (!current) {
      return json(
        { ok: false, error: "ไม่พบรายการสื่อ หรือบัญชีนี้ไม่มีสิทธิ์แก้ไข" },
        { status: 404 },
      );
    }

    const result = await postToGoogle({
      action: "updateMedia",
      id: current.id,
      title: String(body.title || "").trim(),
      description: String(body.description || "").trim(),
      phase: body.phase,
      category: String(body.category || "").trim(),
      eventDate: String(body.eventDate || ""),
      location: String(body.location || "").trim(),
      keywords: Array.isArray(body.keywords)
        ? body.keywords.map(String).map((item) => item.trim()).filter(Boolean)
        : [],
      altText: String(body.altText || "").trim(),
      status: body.status === "draft" ? "draft" : "published",
      editedBy: user.email,
    });
    if (!result.ok) {
      throw new Error(String(result.error || "แก้ไขข้อมูลสื่อไม่สำเร็จ"));
    }
    return json(result);
  } catch (error) {
    return portalErrorResponse(error);
  }
}
