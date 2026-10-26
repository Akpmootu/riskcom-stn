import { updateIndexedMediaViewCount } from "@/app/lib/media-index-cache";
import { postToGoogle } from "@/app/lib/server";

export type MediaViewResult = { mediaId: string; viewCount: number; counted: boolean };

export async function trackMediaView(mediaId: string, viewerToken: string): Promise<MediaViewResult> {
  const id = String(mediaId || "").trim();
  const token = String(viewerToken || "").trim();
  if (!id || id.length > 160) throw new Error("MEDIA_ID_INVALID");
  if (!/^[A-Za-z0-9._:-]{12,160}$/.test(token)) throw new Error("VIEWER_TOKEN_INVALID");
  const result = await postToGoogle({ action: "trackMediaView", mediaId: id, viewerToken: token }, 2);
  if (!result.ok) throw new Error(String(result.error || "TRACK_VIEW_FAILED"));
  const response: MediaViewResult = {
    mediaId: String(result.mediaId || id),
    viewCount: Math.max(0, Math.trunc(Number(result.viewCount || 0))),
    counted: Boolean(result.counted),
  };
  updateIndexedMediaViewCount(response.mediaId, response.viewCount);
  return response;
}
