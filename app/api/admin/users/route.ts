import type { PortalRole, PortalStatus } from "@/app/auth-types";
import { json, postToGoogle } from "@/app/lib/server";
import {
  listPortalUsers,
  normalizedGmail,
  portalErrorResponse,
  requireApprovedPortalUser,
  SUPER_ADMIN_EMAIL,
} from "@/app/lib/users";

export const dynamic = "force-dynamic";

const validStatuses = new Set<PortalStatus>([
  "pending",
  "approved",
  "rejected",
]);
const validRoles = new Set<PortalRole>(["admin", "uploader"]);

export async function GET() {
  try {
    await requireApprovedPortalUser(["super_admin", "admin"]);
    return json({ ok: true, users: await listPortalUsers() });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user: actor } = await requireApprovedPortalUser([
      "super_admin",
      "admin",
    ]);
    const body = (await request.json()) as Record<string, unknown>;
    const email = normalizedGmail(body.email);
    const status = String(body.status || "") as PortalStatus;
    const role = String(body.role || "") as PortalRole;

    if (
      !email ||
      email === SUPER_ADMIN_EMAIL ||
      !validStatuses.has(status) ||
      !validRoles.has(role)
    ) {
      return json(
        { ok: false, error: "ข้อมูลการอนุมัติไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const users = await listPortalUsers();
    const target = users.find((entry) => entry.email === email);
    if (!target) {
      return json({ ok: false, error: "ไม่พบสมาชิก" }, { status: 404 });
    }
    if (
      actor.role !== "super_admin" &&
      (target.role !== "uploader" || role !== "uploader")
    ) {
      return json(
        { ok: false, error: "เฉพาะ Super Admin เท่านั้นที่จัดการผู้ดูแลระบบได้" },
        { status: 403 },
      );
    }

    const result = await postToGoogle({
      action: "manageUser",
      email,
      status,
      role,
      approvedBy: actor.email,
    });
    if (!result.ok) {
      throw new Error(String(result.error || "อัปเดตสิทธิ์สมาชิกไม่สำเร็จ"));
    }
    return json({ ok: true, user: result.user });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
