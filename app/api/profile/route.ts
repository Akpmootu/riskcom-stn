import { json, postToGoogle } from "@/app/lib/server";
import {
  portalErrorResponse,
  requireApprovedPortalUser,
} from "@/app/lib/users";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const { identity, user } = await requireApprovedPortalUser();
    const body = (await request.json()) as Record<string, unknown>;
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const position = String(body.position || "").trim();
    const workplace = String(body.workplace || "").trim();
    const phone = String(body.phone || "").replace(/[^\d+]/g, "").trim();

    if (!firstName || !lastName || !position || !workplace || phone.length < 9) {
      return json(
        { ok: false, error: "กรุณากรอกข้อมูลโปรไฟล์ให้ครบถ้วน" },
        { status: 400 },
      );
    }

    const result = await postToGoogle({
      action: "updateProfile",
      email: user.email,
      providerAccountId: identity.providerAccountId,
      firstName,
      lastName,
      position,
      workplace,
      phone,
      imageUrl: identity.image,
    });
    if (!result.ok) {
      throw new Error(String(result.error || "อัปเดตโปรไฟล์ไม่สำเร็จ"));
    }
    return json({ ok: true, user: result.user });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
