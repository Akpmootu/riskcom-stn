import { getIndexedMediaSnapshot } from "@/app/lib/media-index-cache";
import { getGoogleScriptUrl, json } from "@/app/lib/server";
import { sampleMedia } from "@/app/sample-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = getGoogleScriptUrl();
  if (!url) {
    return json({
      items: sampleMedia,
      source: "demo",
      message: "กำลังแสดงข้อมูลตัวอย่างก่อนเชื่อมต่อ Google Drive และ Google Sheets",
    });
  }

  try {
    const requestUrl = new URL(request.url);
    const forceRefresh = requestUrl.searchParams.has("refresh");
    const snapshot = await getIndexedMediaSnapshot({ forceRefresh });

    return json(
      { items: snapshot.publishedItems, source: "google" },
      forceRefresh
        ? { headers: { "cache-control": "no-store" } }
        : {
            headers: {
              "cache-control": "public, s-maxage=45, stale-while-revalidate=300",
            },
          },
    );
  } catch {
    return json({
      items: sampleMedia,
      source: "demo",
      message: "เชื่อมต่อ Google ไม่สำเร็จ จึงแสดงข้อมูลตัวอย่างชั่วคราว",
    });
  }
}
