import { json, postToGoogle } from "@/app/lib/server";
import {
  portalErrorResponse,
  requireApprovedPortalUser,
} from "@/app/lib/users";
import type { MediaItem } from "@/app/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireApprovedPortalUser();
    const mediaId = new URL(request.url).searchParams.get("mediaId")?.trim();
    if (!mediaId) {
      return json({ ok: false, error: "ไม่พบรหัสสื่อ" }, { status: 400 });
    }

    if (user.role === "uploader") {
      const mediaResult = await postToGoogle({ action: "listAllMedia" });
      const item = Array.isArray(mediaResult.items)
        ? (mediaResult.items as MediaItem[]).find(
            (entry) => entry.id === mediaId,
          )
        : undefined;
      if (
        !item ||
        String(item.uploadedBy || "").toLowerCase() !== user.email.toLowerCase()
      ) {
        return json(
          { ok: false, error: "บัญชีนี้ไม่มีสิทธิ์ดูประวัติรายการนี้" },
          { status: 403 },
        );
      }
    }

    const result = await postToGoogle({
      action: "listMediaHistory",
      mediaId,
    });
    if (!result.ok || !Array.isArray(result.history)) {
      throw new Error(String(result.error || "โหลดประวัติการแก้ไขไม่สำเร็จ"));
    }
    return json(result);
  } catch (error) {
    return portalErrorResponse(error);
  }
}
