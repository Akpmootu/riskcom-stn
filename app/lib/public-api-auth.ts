import { PublicMediaApiError } from "@/app/lib/public-media-api";

function configuredKeys() {
  const raw =
    process.env.MEDIA_API_KEYS?.trim() ||
    process.env.MEDIA_API_KEY?.trim() ||
    "";

  return raw
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      return separator > 0 ? entry.slice(separator + 1).trim() : entry;
    })
    .filter((key) => key.length >= 24);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function requirePublicApiKey(request: Request) {
  const keys = configuredKeys();
  if (keys.length === 0) {
    throw new PublicMediaApiError(
      "ระบบยังไม่ได้กำหนด API Key",
      503,
      "API_KEY_NOT_CONFIGURED",
    );
  }

  const authorization = request.headers.get("authorization")?.trim() || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const supplied = request.headers.get("x-api-key")?.trim() || bearer;

  if (!supplied || !keys.some((key) => constantTimeEqual(key, supplied))) {
    throw new PublicMediaApiError(
      "API Key ไม่ถูกต้องหรือไม่ได้ระบุ",
      401,
      "INVALID_API_KEY",
    );
  }
}
