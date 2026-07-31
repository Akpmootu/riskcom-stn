import { json, postToGoogle } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await postToGoogle({ action: "getStats" });
    if (!result.ok) throw new Error(String(result.error || ""));
    return json(result);
  } catch {
    return json({
      ok: false,
      stats: { totalViews: 0, todayViews: 0, updatedAt: "" },
    });
  }
}
