import { getGoogleScriptUrl, isAdminRequest, json, postToGoogle } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return json({ ok: false, error: "รหัสผู้ดูแลไม่ถูกต้อง" }, { status: 401 });
  }

  const googleConfigured = Boolean(
    getGoogleScriptUrl() && process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim(),
  );
  if (!googleConfigured) {
    return json({
      ok: true,
      connected: false,
      message: "เข้าสู่ระบบแล้ว แต่ยังไม่ได้เชื่อมต่อ Google Drive และ Google Sheets",
    });
  }

  try {
    const result = await postToGoogle({ action: "status" });
    return json({
      ok: true,
      connected: Boolean(result.ok),
      folderName: result.folderName,
      sheetName: result.sheetName,
      message: result.ok ? "เชื่อมต่อ Google สำเร็จ" : result.error,
    });
  } catch (error) {
    return json({
      ok: true,
      connected: false,
      message: error instanceof Error ? error.message : "ตรวจสอบการเชื่อมต่อไม่สำเร็จ",
    });
  }
}
