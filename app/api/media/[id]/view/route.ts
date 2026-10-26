import { trackMediaView } from "@/app/lib/media-views";
import { json } from "@/app/lib/server";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { viewerToken?: string };
    return json({ ok: true, ...(await trackMediaView(decodeURIComponent(id), body.viewerToken || "")) });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "TRACK_VIEW_FAILED" }, { status: 400 });
  }
}
