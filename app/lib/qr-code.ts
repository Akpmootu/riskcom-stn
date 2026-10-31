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

function wrapPosterTitle(value: string): string[] {
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 160) || "สื่อประชาสัมพันธ์";
  const maxCharacters = 42;
  const takeLine = (source: string, limit: number) => {
    const segments = Array.from(
      new Intl.Segmenter("th", { granularity: "word" }).segment(source),
    );
    let line = "";

    for (const part of segments) {
      if (Array.from(`${line}${part.segment}`.trim()).length <= limit) {
        line += part.segment;
        continue;
      }
      if (line.trim()) return { line: line.trim(), rest: source.slice(part.index).trim() };

      const characters = Array.from(part.segment);
      const first = characters.slice(0, limit).join("").trim();
      const rest = `${characters.slice(limit).join("")}${source.slice(part.index + part.segment.length)}`;
      return { line: first, rest: rest.trim() };
    }

    return { line: line.trim(), rest: "" };
  };

  const first = takeLine(normalized, maxCharacters);
  if (!first.rest) return [first.line];

  const second = takeLine(first.rest, maxCharacters - 1);
  return [first.line, second.rest ? `${second.line}…` : second.line];
}

export function buildQrPoster(qrImageUrl: string, mediaTitle: string): string {
  const safeImageUrl = escapeSvgAttribute(qrImageUrl);
  const titleLines = wrapPosterTitle(mediaTitle).map(escapeSvgAttribute);
  const titleMarkup = titleLines.length === 1
    ? `<tspan x="600" y="1285">${titleLines[0]}</tspan>`
    : titleLines
        .map((line, index) => `<tspan x="600" y="${1248 + index * 67}">${line}</tspan>`)
        .join("");
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600" role="img" aria-labelledby="title desc">',
    `<title id="title">QR Code: ${escapeSvgAttribute(mediaTitle)}</title>`,
    '<desc id="desc">QR Code พร้อมชื่อหัวข้อ ตราสัญลักษณ์ และชื่อหน่วยงาน</desc>',
    '<rect width="1200" height="1600" rx="48" fill="#ffffff"/>',
    '<rect x="56" y="56" width="1088" height="1088" rx="34" fill="#ffffff" stroke="#d8dee6" stroke-width="4"/>',
    `<image href="${safeImageUrl}" x="90" y="90" width="1020" height="1020" preserveAspectRatio="xMidYMid meet"/>`,
    `<text text-anchor="middle" fill="#0b2948" font-family="Kanit, Sarabun, Noto Sans Thai, Arial, sans-serif" font-size="52" font-weight="700">${titleMarkup}</text>`,
    '<path d="M340 1365H860" stroke="#006837" stroke-width="8" stroke-linecap="round"/>',
    '<text x="600" y="1450" text-anchor="middle" fill="#111827" font-family="Kanit, Sarabun, Noto Sans Thai, Arial, sans-serif" font-size="48" font-weight="700">กลุ่มภารกิจสื่อสารความเสี่ยง</text>',
    '<text x="600" y="1528" text-anchor="middle" fill="#111827" font-family="Kanit, Sarabun, Noto Sans Thai, Arial, sans-serif" font-size="42" font-weight="600">สำนักงานสาธารณสุขจังหวัดสตูล</text>',
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
