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
      patternColor: "#006837",
      patternBackground: "#ffffff",
      cornetsOuter: "extra-rounded",
      cornetsOuterColor: "#006837",
      cornetsInterior: "dot",
      cornetsInteriorColor: "#006837",
      logotype: logoUrl,
      logotypeSize: 0.22,
      logotypeMargin: 10,
      logotypeHideBackground: true,
    },
  };
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
