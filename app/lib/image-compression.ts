/**
 * Client-side image compression for web delivery.
 *
 * Resizes and re-encodes uploaded images in the browser (Canvas API) so that
 * files stored in Google Drive and shown on the public website stay small
 * while keeping text on health posters sharp.
 *
 * Recommended file-size targets:
 *  - "content": general images / article & poster images -> under 100–200 KB
 *  - "hero":    full-screen hero images / full-width banners -> 300–500 KB
 *               (hard limit 1 MB)
 */

export type ImageCompressionProfile = "content" | "hero";

export type ImageCompressionSettings = {
  label: string;
  /** Longest side (px) used as the starting resolution. */
  maxDimension: number;
  /** Smallest longest side (px) the encoder may shrink to while chasing the target. */
  minDimension: number;
  /** Desired upper bound of the output file. */
  targetBytes: number;
  /** Absolute ceiling; images are never stored above this when avoidable. */
  hardLimitBytes: number;
  maxQuality: number;
  minQuality: number;
};

export const IMAGE_COMPRESSION_PROFILES: Record<ImageCompressionProfile, ImageCompressionSettings> = {
  content: {
    label: "ภาพทั่วไป / ภาพประกอบบทความ (≤ 200 KB)",
    maxDimension: 1600,
    minDimension: 960,
    targetBytes: 200 * 1024,
    hardLimitBytes: 300 * 1024,
    maxQuality: 0.88,
    minQuality: 0.6,
  },
  hero: {
    label: "ภาพเต็มหน้าจอ / แบนเนอร์หลัก (≤ 500 KB)",
    maxDimension: 2400,
    minDimension: 1280,
    targetBytes: 500 * 1024,
    hardLimitBytes: 1024 * 1024,
    maxQuality: 0.9,
    minQuality: 0.62,
  },
};

export type ImageCompressionResult = {
  file: File;
  profile: ImageCompressionProfile;
  originalBytes: number;
  outputBytes: number;
  width: number;
  height: number;
  quality: number | null;
  /** True when a newly encoded (smaller) file replaced the original. */
  compressed: boolean;
  /** True when the output size is within the profile's target. */
  withinTarget: boolean;
};

const SKIPPED_TYPES = new Set(["image/gif", "image/svg+xml"]);

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Fall back to <img> decoding below.
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        release: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพเพื่อบีบอัดได้"));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function renderToCanvas(image: DecodedImage, longestSide: number): HTMLCanvasElement | null {
  const scale = Math.min(1, longestSide / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // JPEG has no alpha channel: flatten transparent PNG/WebP onto white.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image.source, 0, 0, width, height);
  return canvas;
}

/**
 * Finds the highest JPEG quality whose output fits `targetBytes`
 * (binary search). Returns the smallest attempt when nothing fits.
 */
async function encodeWithinTarget(
  canvas: HTMLCanvasElement,
  settings: ImageCompressionSettings,
): Promise<{ blob: Blob; quality: number; fits: boolean } | null> {
  const best = await canvasToBlob(canvas, settings.maxQuality);
  if (!best) return null;
  if (best.size <= settings.targetBytes) {
    return { blob: best, quality: settings.maxQuality, fits: true };
  }

  let low = settings.minQuality;
  let high = settings.maxQuality;
  let fitting: { blob: Blob; quality: number } | null = null;
  let smallest: { blob: Blob; quality: number } = { blob: best, quality: settings.maxQuality };

  for (let step = 0; step < 6; step += 1) {
    const mid = Number(((low + high) / 2).toFixed(3));
    const blob = await canvasToBlob(canvas, mid);
    if (!blob) break;
    if (blob.size < smallest.blob.size) smallest = { blob, quality: mid };
    if (blob.size <= settings.targetBytes) {
      fitting = { blob, quality: mid };
      low = mid;
    } else {
      high = mid;
    }
    if (high - low < 0.02) break;
  }

  if (!fitting) {
    const floor = await canvasToBlob(canvas, settings.minQuality);
    if (floor && floor.size < smallest.blob.size) {
      smallest = { blob: floor, quality: settings.minQuality };
    }
    if (floor && floor.size <= settings.targetBytes) {
      fitting = { blob: floor, quality: settings.minQuality };
    }
  }

  return fitting
    ? { ...fitting, fits: true }
    : { ...smallest, fits: false };
}

function unchangedResult(
  file: File,
  profile: ImageCompressionProfile,
  width = 0,
  height = 0,
): ImageCompressionResult {
  const settings = IMAGE_COMPRESSION_PROFILES[profile];
  return {
    file,
    profile,
    originalBytes: file.size,
    outputBytes: file.size,
    width,
    height,
    quality: null,
    compressed: false,
    withinTarget: file.size <= settings.targetBytes,
  };
}

/**
 * Compresses an image so it fits the selected web profile.
 * Non-image files (e.g. PDF), GIF and SVG are returned unchanged.
 */
export async function compressImageForWeb(
  file: File,
  profile: ImageCompressionProfile = "content",
): Promise<ImageCompressionResult> {
  if (typeof window === "undefined" || !file.type.startsWith("image/") || SKIPPED_TYPES.has(file.type)) {
    return unchangedResult(file, profile);
  }

  const settings = IMAGE_COMPRESSION_PROFILES[profile];

  let image: DecodedImage;
  try {
    image = await decodeImage(file);
  } catch {
    return unchangedResult(file, profile);
  }

  try {
    const longest = Math.max(image.width, image.height);

    // Already small, web-friendly and not oversized: keep the original bytes.
    if (
      file.size <= settings.targetBytes &&
      longest <= settings.maxDimension &&
      (file.type === "image/jpeg" || file.type === "image/webp")
    ) {
      return unchangedResult(file, profile, image.width, image.height);
    }

    let dimension = Math.min(settings.maxDimension, longest);
    let chosen: { blob: Blob; quality: number; width: number; height: number; fits: boolean } | null = null;

    // Shrink resolution step by step (15% each) until the target size is met.
    while (true) {
      const canvas = renderToCanvas(image, dimension);
      if (!canvas) break;
      const encoded = await encodeWithinTarget(canvas, settings);
      if (encoded) {
        if (!chosen || encoded.fits || encoded.blob.size < chosen.blob.size) {
          chosen = { ...encoded, width: canvas.width, height: canvas.height };
        }
        if (encoded.fits) break;
      }
      const nextDimension = Math.round(dimension * 0.85);
      if (nextDimension < Math.min(settings.minDimension, longest) || nextDimension === dimension) break;
      dimension = nextDimension;
    }

    if (!chosen || chosen.blob.size >= file.size) {
      return unchangedResult(file, profile, image.width, image.height);
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "") || "media-image";
    const output = new File([chosen.blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    return {
      file: output,
      profile,
      originalBytes: file.size,
      outputBytes: output.size,
      width: chosen.width,
      height: chosen.height,
      quality: chosen.quality,
      compressed: true,
      withinTarget: output.size <= settings.targetBytes,
    };
  } finally {
    image.release();
  }
}
