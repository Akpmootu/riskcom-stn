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
    const body = (await request.json()) as { id?: string };
    if (!body.id) return json({ ok: false, error: "ไม่พบรหัสสื่อ" }, { status: 400 });
    const result = await postToGoogle({
      action: "delete",
      id: body.id,
      deletedBy: user.email,
    });
    if (!result.ok) throw new Error(String(result.error || "ลบสื่อไม่สำเร็จ"));
    return json(result);
  } catch (error) {
    return portalErrorResponse(error);
  }
}
