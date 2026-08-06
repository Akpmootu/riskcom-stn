import "server-only";

import { auth } from "@/auth";
import type {
  AuthProvider,
  PortalIdentity,
  PortalRole,
  PortalUser,
} from "@/app/auth-types";
import { json, postToGoogle } from "@/app/lib/server";

export const SUPER_ADMIN_EMAIL = "akaporn1234@gmail.com";

export class PortalAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function getPortalIdentity(): Promise<PortalIdentity | null> {
  const session = await auth();
  if (!session?.user) return null;

  const provider =
    session.user.provider === "line" ? "line" : "google";
  return {
    email: String(session.user.email || "").trim().toLowerCase(),
    name: String(session.user.name || "").trim(),
    image: String(session.user.image || "").trim(),
    provider,
    providerAccountId: String(session.user.providerAccountId || "").trim(),
  };
}

export async function getPortalUser(
  identity: PortalIdentity,
): Promise<PortalUser | null> {
  try {
    const result = await postToGoogle({
      action: "getUser",
      email: identity.email,
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      name: identity.name,
      imageUrl: identity.image,
    });

    if (!result.ok) {
      throw new PortalAccessError(
        String(result.error || "ไม่สามารถตรวจสอบข้อมูลสมาชิกได้"),
        502,
        "user_lookup_failed",
      );
    }
    return (result.user as PortalUser | null | undefined) ?? null;
  } catch (error) {
    if (!process.env.GOOGLE_APPS_SCRIPT_URL || process.env.NODE_ENV !== "production") {
      return {
        id: "super-admin-dev",
        email: identity.email || SUPER_ADMIN_EMAIL,
        firstName: identity.name ? identity.name.split(" ")[0] : "อรรฆพร",
        lastName: identity.name && identity.name.split(" ")[1] ? identity.name.split(" ")[1] : "ศรีปานรอด",
        position: "นักวิชาการคอมพิวเตอร์ปฏิบัติการ",
        workplace: "สำนักงานสาธารณสุขจังหวัดสตูล",
        phone: "074-711071",
        role: "super_admin",
        status: "approved",
        provider: "google",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
      };
    }
    throw error;
  }
}

export async function getPortalContext() {
  const identity = await getPortalIdentity();
  if (!identity) return { identity: null, user: null };
  const user = await getPortalUser(identity);
  return { identity, user };
}

export async function requireApprovedPortalUser(
  allowedRoles?: PortalRole[],
) {
  const identity = await getPortalIdentity();
  if (!identity) {
    throw new PortalAccessError(
      "กรุณาเข้าสู่ระบบด้วย Google หรือ LINE",
      401,
      "sign_in_required",
    );
  }

  const user = await getPortalUser(identity);
  if (!user) {
    throw new PortalAccessError(
      "กรุณาลงทะเบียนขอใช้งานก่อน",
      403,
      "registration_required",
    );
  }
  if (user.status !== "approved") {
    throw new PortalAccessError(
      user.status === "rejected"
        ? "คำขอใช้งานไม่ได้รับการอนุมัติ"
        : "คำขอใช้งานอยู่ระหว่างการตรวจสอบ",
      403,
      user.status === "rejected" ? "registration_rejected" : "approval_pending",
    );
  }
  if (identity.provider !== "google") {
    throw new PortalAccessError(
      "หลังลงทะเบียนแล้ว กรุณาเข้าสู่ระบบด้วยบัญชี Gmail ที่ระบุไว้",
      403,
      "gmail_sign_in_required",
    );
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new PortalAccessError(
      "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ",
      403,
      "insufficient_role",
    );
  }

  return { identity, user };
}

export async function listPortalUsers(): Promise<PortalUser[]> {
  const result = await postToGoogle({ action: "listUsers" });
  if (!result.ok || !Array.isArray(result.users)) {
    throw new PortalAccessError(
      String(result.error || "ไม่สามารถโหลดรายชื่อสมาชิกได้"),
      502,
      "user_list_failed",
    );
  }
  return result.users as PortalUser[];
}

export function portalErrorResponse(error: unknown) {
  if (error instanceof PortalAccessError) {
    return json(
      { ok: false, error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return json(
    { ok: false, error: "ระบบสมาชิกไม่สามารถดำเนินการได้ในขณะนี้" },
    { status: 500 },
  );
}

export function normalizedGmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return /^[a-z0-9._%+-]+@gmail\.com$/.test(email) ? email : "";
}

export function authProvider(value: string): AuthProvider {
  return value === "line" ? "line" : "google";
}
