import {
  createMediaEtag,
  fetchPublishedMedia,
  filterPublicMedia,
  parsePublicMediaQuery,
  publicApiError,
  publicApiJson,
  publicApiOptions,
} from "@/app/lib/public-media-api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return publicApiOptions();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = parsePublicMediaQuery(url);
    const allItems = await fetchPublishedMedia();
    const filteredItems = filterPublicMedia(allItems, query);
    const total = filteredItems.length;
    const totalPages = Math.ceil(total / query.limit);
    const start = (query.page - 1) * query.limit;
    const items = filteredItems.slice(start, start + query.limit);
    const etag = createMediaEtag(items, `${url.search}|${total}`);

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          "access-control-allow-origin": "*",
          "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
          etag,
          "x-api-version": "1.0",
        },
      });
    }

    const baseUrl = `${url.origin}/api/v1/media`;
    return publicApiJson(
      {
        apiVersion: "1.0",
        data: items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
          hasNext: query.page < totalPages,
          hasPrevious: query.page > 1 && totalPages > 0,
        },
        links: {
          self: url.toString(),
          documentation: `${url.origin}/developers`,
          next:
            query.page < totalPages
              ? withPage(url, query.page + 1)
              : null,
          previous:
            query.page > 1 && totalPages > 0
              ? withPage(url, query.page - 1)
              : null,
          itemTemplate: `${baseUrl}/{id}`,
        },
      },
      { status: 200 },
      etag,
    );
  } catch (error) {
    return publicApiError(error);
  }
}

function withPage(url: URL, page: number) {
  const target = new URL(url);
  target.searchParams.set("page", String(page));
  return target.toString();
}
