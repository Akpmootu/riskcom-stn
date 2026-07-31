import { getGoogleScriptUrl, json } from "@/app/lib/server";
import { sampleMedia } from "@/app/sample-data";
import type { MediaItem } from "@/app/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = getGoogleScriptUrl();
  if (!url) {
    return json({
      items: sampleMedia,
      source: "demo",
      message: "กำลังแสดงข้อมูลตัวอย่างก่อนเชื่อมต่อ Google Drive และ Google Sheets",
    });
  }

  try {
    const target = new URL(url);
    target.searchParams.set("action", "list");
    target.searchParams.set("status", "published");
    const response = await fetch(target, {
      headers: { accept: "application/json" },
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Google Apps Script ${response.status}`);

    const result = (await response.json()) as { ok?: boolean; items?: MediaItem[]; error?: string };
    if (!result.ok || !Array.isArray(result.items)) {
      throw new Error(result.error || "ไม่พบรายการสื่อ");
    }

    return json({ items: result.items, source: "google" });
  } catch {
    return json({
      items: sampleMedia,
      source: "demo",
      message: "เชื่อมต่อ Google ไม่สำเร็จ จึงแสดงข้อมูลตัวอย่างชั่วคราว",
    });
  }
}
