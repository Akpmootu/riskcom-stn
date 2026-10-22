import { getItemCategories } from "./category-tags";
import type { IncidentPhase, MediaItem } from "../types";

export type WatchSeverity = "watch" | "warning" | "critical";

export type WatchSituationConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
  severity: WatchSeverity;
  phase: IncidentPhase | "all";
  categories: string[];
  location: string;
  advisoryText: string;
  pinnedMediaIds: string[];
  updatedAt: string;
  updatedBy?: string;
};

export const WATCH_SETTING_KEY = "watch_situation";
export const WATCH_STORAGE_KEY = "satun-risk-watch-situation-v1";

export const SEVERITY_META: Record<
  WatchSeverity,
  {
    label: string;
    badgeText: string;
    icon: string;
    accentColor: string;
  }
> = {
  watch: {
    label: "เฝ้าระวังปกติ (สีฟ้า/เขียวมรกต)",
    badgeText: "ประกาศสถานการณ์เฝ้าระวัง",
    icon: "fa-solid fa-tower-broadcast",
    accentColor: "#0ea5e9",
  },
  warning: {
    label: "เฝ้าระวังใกล้ชิด / แจ้งเตือน (สีส้มอำพัน)",
    badgeText: "แจ้งเตือนเฝ้าระวังใกล้ชิด",
    icon: "fa-solid fa-triangle-exclamation",
    accentColor: "#f59e0b",
  },
  critical: {
    label: "สถานการณ์ฉุกเฉิน / เฝ้าระวังสูงสุด (สีแดงด่วน)",
    badgeText: "ประกาศเฝ้าระวังขั้นวิกฤต",
    icon: "fa-solid fa-bell",
    accentColor: "#ef4444",
  },
};

export const DEFAULT_WATCH_SITUATION: WatchSituationConfig = {
  enabled: true,
  title: "เฝ้าระวังสถานการณ์ฝนตกหนัก น้ำท่วมฉับพลัน และโรคที่มากับน้ำ",
  subtitle:
    "ขอให้ประชาชนในพื้นที่เสี่ยงติดตามข่าวสารพยากรณ์อากาศ ระดับน้ำ และแนวทางดูแลสุขภาพจากสำนักงานสาธารณสุขจังหวัดสตูลอย่างใกล้ชิด",
  severity: "warning",
  phase: "all",
  categories: ["น้ำท่วม", "โรคติดต่อ", "โรคไข้เลือดออก"],
  location: "ทุกอำเภอในจังหวัดสตูล",
  advisoryText:
    "• 🌧️ ติดตามพยากรณ์อากาศและระดับน้ำในคลองสายหลักอย่างต่อเนื่อง\n• 🛡️ หลีกเลี่ยงการเดินลุยน้ำขังหรือโคลนชื้นแฉะด้วยเท้าเปล่า ป้องกันโรคฉี่หนูและน้ำกัดเท้า\n• 🦟 กำจัดแหล่งเพาะพันธุ์ลูกน้ำยุงลายหลังฝนตก และนอนกางมุ้งหรือทายากันยุง\n• 🆘 หากพบเหตุฉุกเฉินหรือเจ็บป่วยเร่งด่วน กดปุ่มขอความช่วยเหลือ หรือโทรสายด่วน 1669 ฟรีตลอด 24 ชม.",
  pinnedMediaIds: [],
  updatedAt: new Date().toISOString(),
  updatedBy: "สำนักงานสาธารณสุขจังหวัดสตูล",
};

export function normalizeWatchSituation(
  input: Partial<WatchSituationConfig> | null | undefined,
): WatchSituationConfig {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_WATCH_SITUATION };
  }

  const severity: WatchSeverity =
    input.severity === "critical" ||
    input.severity === "warning" ||
    input.severity === "watch"
      ? input.severity
      : DEFAULT_WATCH_SITUATION.severity;

  const phase: IncidentPhase | "all" =
    input.phase === "before" ||
    input.phase === "during" ||
    input.phase === "after" ||
    input.phase === "all"
      ? input.phase
      : DEFAULT_WATCH_SITUATION.phase;

  const categories = Array.isArray(input.categories)
    ? input.categories.map((c) => String(c || "").trim()).filter(Boolean)
    : DEFAULT_WATCH_SITUATION.categories;

  const pinnedMediaIds = Array.isArray(input.pinnedMediaIds)
    ? input.pinnedMediaIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  return {
    enabled:
      typeof input.enabled === "boolean"
        ? input.enabled
        : DEFAULT_WATCH_SITUATION.enabled,
    title:
      String(input.title || "").trim() || DEFAULT_WATCH_SITUATION.title,
    subtitle:
      String(input.subtitle || "").trim() || DEFAULT_WATCH_SITUATION.subtitle,
    severity,
    phase,
    categories:
      categories.length > 0 ? categories : DEFAULT_WATCH_SITUATION.categories,
    location:
      String(input.location || "").trim() || DEFAULT_WATCH_SITUATION.location,
    advisoryText:
      String(input.advisoryText || "").trim() ||
      DEFAULT_WATCH_SITUATION.advisoryText,
    pinnedMediaIds,
    updatedAt:
      String(input.updatedAt || "").trim() ||
      DEFAULT_WATCH_SITUATION.updatedAt,
    updatedBy:
      String(input.updatedBy || "").trim() ||
      DEFAULT_WATCH_SITUATION.updatedBy,
  };
}

export function selectWatchMediaItems(
  items: MediaItem[],
  config: WatchSituationConfig,
  maxCount = 4,
): MediaItem[] {
  if (!items.length) return [];

  const published = items.filter((item) => item.status === "published");
  const pool = published.length > 0 ? published : items;

  const pinned: MediaItem[] = [];
  if (config.pinnedMediaIds.length > 0) {
    for (const id of config.pinnedMediaIds) {
      const found = pool.find((item) => item.id === id);
      if (found && !pinned.some((p) => p.id === found.id)) {
        pinned.push(found);
      }
    }
  }

  const matching = pool.filter((item) => {
    if (pinned.some((p) => p.id === item.id)) return false;
    const phaseMatch =
      config.phase === "all" || item.phase === config.phase;
    const itemCats = getItemCategories(item);
    const categoryMatch =
      config.categories.length === 0 ||
      config.categories.some((cat) => itemCats.includes(cat));
    return phaseMatch && categoryMatch;
  });

  const combined = [...pinned, ...matching];
  if (combined.length >= maxCount) {
    return combined.slice(0, maxCount);
  }

  for (const item of pool) {
    if (combined.length >= maxCount) break;
    if (!combined.some((c) => c.id === item.id)) {
      combined.push(item);
    }
  }

  return combined.slice(0, maxCount);
}

export function readStoredWatchConfig(): WatchSituationConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WATCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WatchSituationConfig>;
    return normalizeWatchSituation(parsed);
  } catch {
    return null;
  }
}

export function writeStoredWatchConfig(config: WatchSituationConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WATCH_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}
