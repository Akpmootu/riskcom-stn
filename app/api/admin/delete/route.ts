import { json, postToGoogle } from "@/app/lib/server";
import {
  portalErrorResponse,
  requireApprovedPortalUser,
} from "@/app/lib/users";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await requireApprovedPortalUser([
      "super_admin",
      "admin",
    ]);
    const body = (await request.json()) as { id?: string; slideIds?: string[] };
    if (!body.id) return json({ ok: false, error: "ไม่พบรหัสสื่อ" }, { status: 400 });

    const result = await postToGoogle({
      action: "delete",
      id: body.id,
      deletedBy: user.email,
    });
    if (!result.ok) throw new Error(String(result.error || "ลบสื่อไม่สำเร็จ"));

    if (Array.isArray(body.slideIds)) {
      const extraIds = body.slideIds
        .map((entry) => String(entry || "").trim())
        .filter((entry) => Boolean(entry) && entry !== body.id);
      if (extraIds.length > 0) {
        await Promise.allSettled(
          extraIds.map((slideId) =>
            postToGoogle({
              action: "delete",
              id: slideId,
              deletedBy: user.email,
            }),
          ),
        );
      }
    }

    return json(result);
  } catch (error) {
    return portalErrorResponse(error);
  }
}
