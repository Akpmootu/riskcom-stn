export type CategoryTagConfig = {
  name: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
};

export type TagColorPreset = {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
};

export const TAG_COLOR_PRESETS: TagColorPreset[] = [
  {
    id: "sky",
    label: "ฟ้าอุทกภัย",
    color: "#0284c7",
    bgColor: "#e0f2fe",
    textColor: "#0369a1",
    borderColor: "#7dd3fc",
  },
  {
    id: "indigo",
    label: "ครามโรคติดต่อ",
    color: "#4f46e5",
    bgColor: "#e0e7ff",
    textColor: "#3730a3",
    borderColor: "#a5b4fc",
  },
  {
    id: "rose",
    label: "แดงฉุกเฉิน/ไข้เลือดออก",
    color: "#e11d48",
    bgColor: "#ffe4e6",
    textColor: "#be123c",
    borderColor: "#fda4af",
  },
  {
    id: "violet",
    label: "ม่วงหมอกควัน/PM2.5",
    color: "#7c3aed",
    bgColor: "#ede9fe",
    textColor: "#5b21b6",
    borderColor: "#c4b5fd",
  },
  {
    id: "amber",
    label: "ส้มทองอุบัติเหตุ/เตือนภัย",
    color: "#d97706",
    bgColor: "#fef3c7",
    textColor: "#b45309",
    borderColor: "#fcd34d",
  },
  {
    id: "emerald",
    label: "เขียวฟื้นฟู/ปลอดภัย",
    color: "#059669",
    bgColor: "#d1fae5",
    textColor: "#047857",
    borderColor: "#6ee7b7",
  },
  {
    id: "teal",
    label: "เขียวมรกตสาธารณสุข",
    color: "#0d9488",
    bgColor: "#ccfbf1",
    textColor: "#0f766e",
    borderColor: "#5eead4",
  },
  {
    id: "orange",
    label: "ส้มเข้มภัยแล้ง/อัคคีภัย",
    color: "#ea580c",
    bgColor: "#ffedd5",
    textColor: "#c2410c",
    borderColor: "#fdba74",
  },
  {
    id: "pink",
    label: "ชมพูดูแลกลุ่มเสี่ยง",
    color: "#db2777",
    bgColor: "#fce7f3",
    textColor: "#be185d",
    borderColor: "#f9a8d4",
  },
  {
    id: "slate",
    label: "เทาอื่นๆ/ทั่วไป",
    color: "#475569",
    bgColor: "#f1f5f9",
    textColor: "#334155",
    borderColor: "#cbd5e1",
  },
];

export const TAG_ICON_PRESETS: Array<{ icon: string; label: string }> = [
  { icon: "fa-solid fa-house-flood-water", label: "น้ำท่วม / อุทกภัย" },
  { icon: "fa-solid fa-mosquito", label: "โรคไข้เลือดออก / ยุงลาย" },
  { icon: "fa-solid fa-shield-virus", label: "โรคติดต่อ / โรคระบาด" },
  { icon: "fa-solid fa-smog", label: "หมอกควัน / PM2.5" },
  { icon: "fa-solid fa-car-burst", label: "อุบัติเหตุ / จราจร" },
  { icon: "fa-solid fa-hand-holding-medical", label: "ฟื้นฟูหลังเหตุ / การแพทย์" },
  { icon: "fa-solid fa-cloud-showers-heavy", label: "วาตภัย / พายุฝน" },
  { icon: "fa-solid fa-hill-rockslide", label: "ดินโคลนถล่ม" },
  { icon: "fa-solid fa-sun-plant-wilt", label: "ภัยแล้ง / อากาศร้อน" },
  { icon: "fa-solid fa-fire-flame-curved", label: "อัคคีภัย / ไฟป่า" },
  { icon: "fa-solid fa-utensils", label: "อาหารและน้ำดื่มปลอดภัย" },
  { icon: "fa-solid fa-heart-pulse", label: "ส่งเสริมสุขภาพ" },
  { icon: "fa-solid fa-triangle-exclamation", label: "แจ้งเตือนภัยเร่งด่วน" },
  { icon: "fa-solid fa-layer-group", label: "อื่นๆ / ทั่วไป" },
];

export const DEFAULT_CATEGORY_CONFIGS: CategoryTagConfig[] = [
  {
    name: "น้ำท่วม",
    color: "#0284c7",
    bgColor: "#e0f2fe",
    textColor: "#0369a1",
    borderColor: "#7dd3fc",
    icon: "fa-solid fa-house-flood-water",
  },
  {
    name: "ฟื้นฟูหลังเหตุ",
    color: "#059669",
    bgColor: "#d1fae5",
    textColor: "#047857",
    borderColor: "#6ee7b7",
    icon: "fa-solid fa-hand-holding-medical",
  },
  {
    name: "โรคไข้เลือดออก",
    color: "#e11d48",
    bgColor: "#ffe4e6",
    textColor: "#be123c",
    borderColor: "#fda4af",
    icon: "fa-solid fa-mosquito",
  },
  {
    name: "โรคติดต่อ",
    color: "#4f46e5",
    bgColor: "#e0e7ff",
    textColor: "#3730a3",
    borderColor: "#a5b4fc",
    icon: "fa-solid fa-shield-virus",
  },
  {
    name: "หมอกควัน",
    color: "#7c3aed",
    bgColor: "#ede9fe",
    textColor: "#5b21b6",
    borderColor: "#c4b5fd",
    icon: "fa-solid fa-smog",
  },
  {
    name: "อุบัติเหตุ",
    color: "#d97706",
    bgColor: "#fef3c7",
    textColor: "#b45309",
    borderColor: "#fcd34d",
    icon: "fa-solid fa-car-burst",
  },
  {
    name: "อื่นๆ",
    color: "#475569",
    bgColor: "#f1f5f9",
    textColor: "#334155",
    borderColor: "#cbd5e1",
    icon: "fa-solid fa-layer-group",
  },
];

export const DEFAULT_CATEGORIES = DEFAULT_CATEGORY_CONFIGS.map((item) => item.name);

export const TAG_CONFIG_STORAGE_KEY = "satun-risk-tag-configs-v1";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  const num = Number.parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function inferIconForCategory(name: string): string {
  const text = name.trim().toLowerCase();
  if (text.includes("น้ำท่วม") || text.includes("อุทกภัย") || text.includes("น้ำป่า")) {
    return "fa-solid fa-house-flood-water";
  }
  if (text.includes("ไข้เลือดออก") || text.includes("ยุง")) {
    return "fa-solid fa-mosquito";
  }
  if (text.includes("โรค") || text.includes("ระบาด") || text.includes("ติดเชื้อ") || text.includes("ฉี่หนู")) {
    return "fa-solid fa-shield-virus";
  }
  if (text.includes("หมอก") || text.includes("ควัน") || text.includes("ฝุ่น") || text.includes("pm")) {
    return "fa-solid fa-smog";
  }
  if (text.includes("อุบัติเหตุ") || text.includes("ถนน") || text.includes("จราจร")) {
    return "fa-solid fa-car-burst";
  }
  if (text.includes("ฟื้นฟู") || text.includes("เยียวยา") || text.includes("หลัง")) {
    return "fa-solid fa-hand-holding-medical";
  }
  if (text.includes("วาตภัย") || text.includes("พายุ") || text.includes("ฝน")) {
    return "fa-solid fa-cloud-showers-heavy";
  }
  if (text.includes("ดิน") || text.includes("โคลน") || text.includes("ถล่ม")) {
    return "fa-solid fa-hill-rockslide";
  }
  if (text.includes("แล้ง") || text.includes("ร้อน") || text.includes("ฮีท")) {
    return "fa-solid fa-sun-plant-wilt";
  }
  if (text.includes("ไฟ") || text.includes("อัคคีภัย")) {
    return "fa-solid fa-fire-flame-curved";
  }
  if (text.includes("อาหาร") || text.includes("น้ำดื่ม")) {
    return "fa-solid fa-utensils";
  }
  if (text.includes("อื่นๆ") || text.includes("ทั่วไป")) {
    return "fa-solid fa-layer-group";
  }
  return "fa-solid fa-tag";
}

export function buildTagConfigFromColor(
  name: string,
  colorHex?: string,
  customIcon?: string,
): CategoryTagConfig {
  const trimmedName = name.trim();
  const defaultMatch = DEFAULT_CATEGORY_CONFIGS.find((item) => item.name === trimmedName);

  const presetMatch = colorHex
    ? TAG_COLOR_PRESETS.find((p) => p.color.toLowerCase() === colorHex.toLowerCase())
    : undefined;

  if (presetMatch) {
    return {
      name: trimmedName,
      color: presetMatch.color,
      bgColor: presetMatch.bgColor,
      textColor: presetMatch.textColor,
      borderColor: presetMatch.borderColor,
      icon: customIcon || defaultMatch?.icon || inferIconForCategory(trimmedName),
    };
  }

  if (colorHex) {
    const rgb = hexToRgb(colorHex);
    if (rgb) {
      const bgColor = rgbToHex(
        rgb.r * 0.14 + 255 * 0.86,
        rgb.g * 0.14 + 255 * 0.86,
        rgb.b * 0.14 + 255 * 0.86,
      );
      const borderColor = rgbToHex(
        rgb.r * 0.42 + 255 * 0.58,
        rgb.g * 0.42 + 255 * 0.58,
        rgb.b * 0.42 + 255 * 0.58,
      );
      const textColor = rgbToHex(rgb.r * 0.78, rgb.g * 0.78, rgb.b * 0.78);
      return {
        name: trimmedName,
        color: colorHex,
        bgColor,
        textColor,
        borderColor,
        icon: customIcon || defaultMatch?.icon || inferIconForCategory(trimmedName),
      };
    }
  }

  if (defaultMatch) {
    return {
      ...defaultMatch,
      icon: customIcon || defaultMatch.icon,
    };
  }

  // Deterministic palette fallback based on tag name hash
  let hash = 0;
  for (let i = 0; i < trimmedName.length; i += 1) {
    hash = (hash * 31 + trimmedName.charCodeAt(i)) >>> 0;
  }
  const activePalette = TAG_COLOR_PRESETS[hash % (TAG_COLOR_PRESETS.length - 1)] ?? TAG_COLOR_PRESETS[0];

  return {
    name: trimmedName,
    color: activePalette.color,
    bgColor: activePalette.bgColor,
    textColor: activePalette.textColor,
    borderColor: activePalette.borderColor,
    icon: customIcon || inferIconForCategory(trimmedName),
  };
}

export function resolveTagConfig(
  name: string,
  configs?: CategoryTagConfig[] | null,
): CategoryTagConfig {
  const trimmed = name.trim();
  const match = configs?.find((item) => item.name === trimmed);
  return match ?? buildTagConfigFromColor(trimmed);
}

export function parseCategories(raw: string | string[] | undefined | null): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,|/;]+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of list) {
    const cleaned = String(entry || "").trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

export function formatCategoriesField(categories: string[] | string | undefined): string {
  const parsed = parseCategories(categories);
  return parsed.length > 0 ? parsed.join(", ") : "อื่นๆ";
}

export function getItemCategories(item: {
  category?: string;
  categories?: string[];
}): string[] {
  if (Array.isArray(item.categories) && item.categories.length > 0) {
    return item.categories;
  }
  const parsed = parseCategories(item.category);
  return parsed.length > 0 ? parsed : ["อื่นๆ"];
}

export function readStoredTagConfigs(): CategoryTagConfig[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TAG_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const valid: CategoryTagConfig[] = [];
    for (const item of parsed) {
      if (item && typeof item === "object" && "name" in item) {
        const record = item as Partial<CategoryTagConfig>;
        const name = String(record.name || "").trim();
        if (!name) continue;
        valid.push(buildTagConfigFromColor(name, record.color, record.icon));
      }
    }
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

export function writeStoredTagConfigs(configs: CategoryTagConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TAG_CONFIG_STORAGE_KEY, JSON.stringify(configs));
  } catch {
    // Ignore storage quota errors
  }
}

export function optimizeThumbnailUrl(url: string | undefined, width = 640): string | undefined {
  if (!url) return undefined;
  if (url.includes("drive.google.com/thumbnail") && url.includes("sz=w")) {
    return url.replace(/sz=w\d+/i, `sz=w${width}`);
  }
  return url;
}
