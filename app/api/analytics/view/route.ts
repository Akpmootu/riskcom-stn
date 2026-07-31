import { json, postToGoogle } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionToken?: string };
    const sessionToken = String(body.sessionToken || "").trim();
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(sessionToken)) {
      return json({ ok: false, error: "Invalid session" }, { status: 400 });
    }
    const result = await postToGoogle({
      action: "trackView",
      sessionToken,
    });
    if (!result.ok) throw new Error(String(result.error || ""));
    return json(result);
  } catch {
    return json(
      {
        ok: false,
        stats: { totalViews: 0, todayViews: 0, updatedAt: "" },
      },
      { status: 503 },
    );
  }
}
