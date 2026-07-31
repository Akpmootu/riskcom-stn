import { json, postToGoogle } from "@/app/lib/server";
import {
  getPortalIdentity,
  normalizedGmail,
  portalErrorResponse,
} from "@/app/lib/users";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const identity = await getPortalIdentity();
    if (!identity) {
      return json(
        { ok: false, error: "กรุณาเข้าสู่ระบบก่อนลงทะเบียน" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const email = normalizedGmail(
      identity.provider === "google" ? identity.email : body.email,
    );
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const position = String(body.position || "").trim();
    const workplace = String(body.workplace || "").trim();
    const phone = String(body.phone || "").replace(/[^\d+]/g, "").trim();

    if (!email) {
      return json(
        { ok: false, error: "กรุณาระบุบัญชี Gmail ที่ถูกต้อง" },
        { status: 400 },
      );
    }
    if (!firstName || !lastName || !position || !workplace || phone.length < 9) {
      return json(
        { ok: false, error: "กรุณากรอกข้อมูลการลงทะเบียนให้ครบถ้วน" },
        { status: 400 },
      );
    }

    const result = await postToGoogle({
      action: "requestUser",
      email,
      firstName,
      lastName,
      position,
      workplace,
      phone,
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      imageUrl: identity.image,
    });
    if (!result.ok) {
      throw new Error(String(result.error || "บันทึกคำขอใช้งานไม่สำเร็จ"));
    }

    return json({ ok: true, user: result.user });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
