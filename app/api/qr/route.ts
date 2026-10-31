import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import {
  buildMediaDeepLink,
  buildMeQrPayload,
  buildQrPoster,
  extractQrImage,
  normalizeSlideIndex,
} from "../../lib/qr-code.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(value: unknown, init?: ResponseInit) {
  return Response.json(value, init);
}

type QrRequestBody = {
  mediaId?: unknown;
  slideIndex?: unknown;
  title?: unknown;
};

const qrResultCache = new Map<string, { imageUrl: string; provider: string; expiresAt: number }>();
const QR_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function readProviderImage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType.split(";")[0]};base64,${bytes.toString("base64")}`;
  }

  const json = await response.json().catch(() => null);
  return extractQrImage(json);
}

async function createWithMeQr({
  token,
  targetUrl,
  title,
  logoUrl,
}: {
  token: string;
  targetUrl: string;
  title: string;
  logoUrl: string;
}) {
  const response = await fetch("https://me-qr.com/api/v2/qr/link/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-AUTH-TOKEN": token,
    },
    body: JSON.stringify(buildMeQrPayload({ link: targetUrl, title, logoUrl })),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`ME-QR ${response.status}`);
  const imageUrl = await readProviderImage(response);
  if (!imageUrl) throw new Error("ME-QR response did not include a QR image");
  return imageUrl;
}

async function createWithGenQr({
  apiKey,
  targetUrl,
}: {
  apiKey: string;
  targetUrl: string;
}) {
  const response = await fetch("https://genqrcode.com/public/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "GenQRCode-apikey": apiKey,
    },
    body: JSON.stringify({ type: 0, text: targetUrl }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GenQRCode ${response.status}`);
  const imageUrl = await readProviderImage(response);
  if (!imageUrl) throw new Error("GenQRCode response did not include a QR image");
  return imageUrl;
}

async function createLocalBrandedQr(targetUrl: string) {
  const [svg, logo] = await Promise.all([
    QRCode.toString(targetUrl, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 3,
      color: { dark: "#000000", light: "#ffffff" },
    }),
    readFile(path.join(process.cwd(), "public", "ssj-satun-logo.png")),
  ]);
  const logoData = `data:image/png;base64,${logo.toString("base64")}`;
  const overlay = [
    '<rect x="37%" y="37%" width="26%" height="26%" rx="4%" fill="#ffffff"/>',
    `<image href="${logoData}" x="40%" y="40%" width="20%" height="20%" preserveAspectRatio="xMidYMid slice"/>`,
  ].join("");
  const brandedSvg = svg.replace("</svg>", `${overlay}</svg>`);
  return `data:image/svg+xml;base64,${Buffer.from(brandedSvg).toString("base64")}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as QrRequestBody | null;
  const mediaId = typeof body?.mediaId === "string" ? body.mediaId.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const slideIndex = Math.min(99, normalizeSlideIndex(Number(body?.slideIndex)));

  if (!mediaId || mediaId.length > 240) {
    return jsonResponse({ error: "ไม่พบรหัสสื่อที่ต้องการสร้าง QR Code" }, { status: 400 });
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const origin = configuredOrigin || new URL(request.url).origin;
  const targetUrl = buildMediaDeepLink(origin, mediaId, slideIndex);
  const logoUrl = new URL("/ssj-satun-logo.png", origin).toString();
  const meQrToken = process.env.ME_QR_API_TOKEN?.trim();
  const genQrKey = process.env.GENQRCODE_API_KEY?.trim();
  const posterTitle = title.slice(0, 160) || "สื่อประชาสัมพันธ์";
  const cacheKey = `${targetUrl}\n${posterTitle}`;
  const cached = qrResultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return jsonResponse(
      { imageUrl: cached.imageUrl, targetUrl, provider: cached.provider },
      { headers: { "Cache-Control": "private, no-store", "X-QR-Cache": "HIT" } },
    );
  }

  try {
    let imageUrl = "";
    let provider = "";

    if (meQrToken) {
      try {
        imageUrl = await createWithMeQr({
          token: meQrToken,
          targetUrl,
          title,
          logoUrl,
        });
        provider = "me-qr";
      } catch {
        // Continue to the backup provider or the built-in generator.
      }
    }

    if (!imageUrl && genQrKey) {
      try {
        imageUrl = await createWithGenQr({ apiKey: genQrKey, targetUrl });
        provider = "genqrcode";
      } catch {
        // The built-in generator keeps public communication available during provider outages.
      }
    }

    if (!imageUrl) {
      imageUrl = await createLocalBrandedQr(targetUrl);
      provider = "local";
    }

    const posterImageUrl = buildQrPoster(imageUrl, posterTitle);
    qrResultCache.set(cacheKey, {
      imageUrl: posterImageUrl,
      provider,
      expiresAt: Date.now() + QR_CACHE_TTL_MS,
    });

    return jsonResponse(
      { imageUrl: posterImageUrl, targetUrl, provider },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return jsonResponse(
      { error: "สร้าง QR Code ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 502 },
    );
  }
}
