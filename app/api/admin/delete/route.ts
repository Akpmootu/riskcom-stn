import { isAdminRequest, json, postToGoogle } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return json({ ok: false, error: "รหัสผู้ดูแลไม่ถูกต้อง" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) return json({ ok: false, error: "ไม่พบรหัสสื่อ" }, { status: 400 });
    const result = await postToGoogle({ action: "delete", id: body.id });
    if (!result.ok) throw new Error(String(result.error || "ลบสื่อไม่สำเร็จ"));
    return json(result);
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "ลบสื่อไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
