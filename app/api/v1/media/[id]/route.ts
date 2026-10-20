import {
  createMediaEtag,
  fetchPublishedMedia,
  publicApiError,
  publicApiJson,
  publicApiOptions,
} from "@/app/lib/public-media-api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return publicApiOptions();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const items = await fetchPublishedMedia();
    const item = items.find((entry) => entry.id === decodeURIComponent(id));

    if (!item) {
      return publicApiJson(
        {
          apiVersion: "1.0",
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
        apiVersion: "1.0",
        data: item,
        links: {
          self: url.toString(),
          collection: `${url.origin}/api/v1/media`,
          documentation: `${url.origin}/developers`,
        },
      },
      { status: 200 },
      etag,
    );
  } catch (error) {
    return publicApiError(error);
  }
}
