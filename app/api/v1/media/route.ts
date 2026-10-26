import {
  PUBLIC_API_VERSION,
  createMediaEtag,
  fetchPublicMediaCatalog,
  filterPublicMedia,
  parsePublicMediaQuery,
  publicApiError,
  publicApiJson,
  publicApiOptions,
} from "@/app/lib/public-media-api";
import { requirePublicApiKey } from "@/app/lib/public-api-auth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return publicApiOptions();
}

export async function GET(request: Request) {
  try {
    requirePublicApiKey(request);
    const url = new URL(request.url);
    const query = parsePublicMediaQuery(url);
    const catalog = await fetchPublicMediaCatalog();
    const filteredItems = filterPublicMedia(catalog.items, query);
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
          "cache-control": "private, max-age=60, stale-while-revalidate=300",
          etag,
          "x-api-version": PUBLIC_API_VERSION,
          vary: "Authorization, X-API-Key",
        },
      });
    }

    const baseUrl = `${url.origin}/api/v1/media`;
    return publicApiJson(
      {
        apiVersion: PUBLIC_API_VERSION,
        data: items,
        situation: catalog.situation,
        recommended: catalog.recommended,
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
          recommended: `${baseUrl}/recommended`,
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
