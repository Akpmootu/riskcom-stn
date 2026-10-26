import { requirePublicApiKey } from "@/app/lib/public-api-auth";
import { trackMediaView } from "@/app/lib/media-views";
import { PUBLIC_API_VERSION, PublicMediaApiError, publicApiError, publicApiJson, publicApiOptions } from "@/app/lib/public-media-api";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return publicApiOptions(); }
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requirePublicApiKey(request);
    const { id } = await context.params;
    const body = (await request.json()) as { viewerToken?: string };
    if (!body.viewerToken) throw new PublicMediaApiError("กรุณาระบุ viewerToken", 400, "VIEWER_TOKEN_REQUIRED");
    const data = await trackMediaView(decodeURIComponent(id), body.viewerToken);
    return publicApiJson({ apiVersion: PUBLIC_API_VERSION, data }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) { return publicApiError(error); }
}
