export type MeQrPayload = {
  qrFieldsData: { link: string };
  title: string;
  format: "png";
  designType: "base";
  qrOptions: {
    size: number;
    errorCorrectionLevel: "H";
    pattern: "rounded";
    patternColor: string;
    patternBackground: string;
    cornetsOuter: "extra-rounded";
    cornetsOuterColor: string;
    cornetsInterior: "dot";
    cornetsInteriorColor: string;
    logotype: string;
    logotypeSize: number;
    logotypeMargin: number;
    logotypeHideBackground: boolean;
  };
};

export function normalizeSlideIndex(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export function buildMediaDeepLink(
  origin: string,
  mediaId: string,
  slideIndex = 0,
): string {
  const url = new URL("/", origin);
  url.searchParams.set("media", mediaId);
  url.searchParams.set("slide", String(normalizeSlideIndex(slideIndex)));
  return url.toString();
}

export function buildMeQrPayload({
  link,
  title,
  logoUrl,
}: {
  link: string;
  title: string;
  logoUrl: string;
}): MeQrPayload {
  return {
    qrFieldsData: { link },
    title: title.trim().slice(0, 160) || "คลังสื่อสารความเสี่ยง จังหวัดสตูล",
    format: "png",
    designType: "base",
    qrOptions: {
      size: 1000,
      errorCorrectionLevel: "H",
      pattern: "rounded",
      patternColor: "#000000",
      patternBackground: "#ffffff",
      cornetsOuter: "extra-rounded",
      cornetsOuterColor: "#000000",
      cornetsInterior: "dot",
      cornetsInteriorColor: "#000000",
      logotype: logoUrl,
      logotypeSize: 0.22,
      logotypeMargin: 10,
      logotypeHideBackground: true,
    },
  };
}

function escapeSvgAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildQrPoster(qrImageUrl: string): string {
  const safeImageUrl = escapeSvgAttribute(qrImageUrl);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1450" role="img" aria-labelledby="title desc">',
    '<title id="title">QR Code สื่อสารความเสี่ยง สำนักงานสาธารณสุขจังหวัดสตูล</title>',
    '<desc id="desc">QR Code พร้อมตราสัญลักษณ์และชื่อหน่วยงาน</desc>',
    '<rect width="1200" height="1450" rx="48" fill="#ffffff"/>',
    '<rect x="56" y="56" width="1088" height="1088" rx="34" fill="#ffffff" stroke="#d8dee6" stroke-width="4"/>',
    `<image href="${safeImageUrl}" x="90" y="90" width="1020" height="1020" preserveAspectRatio="xMidYMid meet"/>`,
    '<path d="M340 1190H860" stroke="#006837" stroke-width="8" stroke-linecap="round"/>',
    '<text x="600" y="1280" text-anchor="middle" fill="#111827" font-family="Kanit, Sarabun, Noto Sans Thai, Arial, sans-serif" font-size="54" font-weight="700">กลุ่มภารกิจสื่อสารความเสี่ยง</text>',
    '<text x="600" y="1365" text-anchor="middle" fill="#111827" font-family="Kanit, Sarabun, Noto Sans Thai, Arial, sans-serif" font-size="46" font-weight="600">สำนักงานสาธารณสุขจังหวัดสตูล</text>',
    "</svg>",
  ].join("");

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function isImageReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (/^https:\/\//i.test(value) || /^data:image\//i.test(value))
  );
}

export function extractQrImage(value: unknown): string {
  if (isImageReference(value)) return value;
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  for (const key of ["imageUrl", "image", "qrCodeUrl", "qrCode", "url", "file"]) {
    const direct = record[key];
    if (isImageReference(direct)) return direct;
  }

  for (const key of ["data", "result", "response", "qr", "qrCode"]) {
    const nested = extractQrImage(record[key]);
    if (nested) return nested;
  }

  return "";
}
