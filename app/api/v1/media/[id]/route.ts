import {
  PUBLIC_API_VERSION,
  createMediaEtag,
  fetchPublicMediaCatalog,
  publicApiError,
  publicApiJson,
  publicApiOptions,
} from "@/app/lib/public-media-api";
import { requirePublicApiKey } from "@/app/lib/public-api-auth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return publicApiOptions();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requirePublicApiKey(request);
    const { id } = await context.params;
    const catalog = await fetchPublicMediaCatalog();
    const item = catalog.items.find((entry) => entry.id === decodeURIComponent(id));

    if (!item) {
      return publicApiJson(
        {
          apiVersion: PUBLIC_API_VERSION,
          error: {
            code: "MEDIA_NOT_FOUND",
            message: "ไม่พบสื่อที่ระบุ",
          },
        },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const etag = createMediaEtag([item]);
    return publicApiJson(
      {
        apiVersion: PUBLIC_API_VERSION,
        data: item,
        situation: catalog.situation,
        links: {
          self: url.toString(),
          collection: `${url.origin}/api/v1/media`,
          documentation: `${url.origin}/developers`,
          trackView: `${url.origin}/api/v1/media/${encodeURIComponent(item.id)}/view`,
        },
      },
      { status: 200 },
      etag,
    );
  } catch (error) {
    return publicApiError(error);
  }
}
