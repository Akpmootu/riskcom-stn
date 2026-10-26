import { requirePublicApiKey } from "@/app/lib/public-api-auth";
import {
  PUBLIC_API_VERSION,
  createMediaEtag,
  fetchPublicMediaCatalog,
  publicApiError,
  publicApiJson,
  publicApiOptions,
} from "@/app/lib/public-media-api";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return publicApiOptions(); }
export async function GET(request: Request) {
  try {
    requirePublicApiKey(request);
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("limit") || 8);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(20, Math.trunc(requested))) : 8;
    const catalog = await fetchPublicMediaCatalog();
    const data = catalog.recommended.slice(0, limit);
    const etag = createMediaEtag(data, catalog.situation.updatedAt);
    return publicApiJson({ apiVersion: PUBLIC_API_VERSION, situation: catalog.situation, data, total: data.length, links: { self: url.toString(), collection: `${url.origin}/api/v1/media`, documentation: `${url.origin}/developers` } }, { status: 200 }, etag);
  } catch (error) { return publicApiError(error); }
}
