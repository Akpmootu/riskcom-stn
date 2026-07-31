import { getGoogleScriptUrl, json, postToGoogle } from "@/app/lib/server";
import {
  portalErrorResponse,
  requireApprovedPortalUser,
} from "@/app/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApprovedPortalUser();
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

    const result = await postToGoogle({ action: "status" });
    return json({
      ok: true,
      connected: Boolean(result.ok),
      folderName: result.folderName,
      sheetName: result.sheetName,
      message: result.ok ? "เชื่อมต่อ Google สำเร็จ" : result.error,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
