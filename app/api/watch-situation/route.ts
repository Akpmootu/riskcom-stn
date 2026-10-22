import { json, postToGoogle } from "@/app/lib/server";
import { portalErrorResponse, requireApprovedPortalUser } from "@/app/lib/users";
import {
  DEFAULT_WATCH_SITUATION,
  normalizeWatchSituation,
  WATCH_SETTING_KEY,
  type WatchSituationConfig,
} from "@/app/lib/watch-situation";

export const dynamic = "force-dynamic";

type WatchStore = {
  config: WatchSituationConfig | null;
  fetchedAt: number;
};

const CACHE_TTL_MS = 30 * 1000;

const globalStore = globalThis as typeof globalThis & {
  __satunWatchStore?: WatchStore;
};

function getStore(): WatchStore {
  if (!globalStore.__satunWatchStore) {
    globalStore.__satunWatchStore = { config: null, fetchedAt: 0 };
  }
  return globalStore.__satunWatchStore;
}

async function loadFromGoogle(): Promise<WatchSituationConfig | null> {
  const result = await postToGoogle({ action: "getSiteSetting", key: WATCH_SETTING_KEY }, 2);
  if (result.ok === false) {
    throw new Error(String(result.error || "อ่านค่าสถานการณ์เฝ้าระวังไม่สำเร็จ"));
  }
  const setting = result.setting as { value?: unknown } | undefined;
  if (!setting || !setting.value || typeof setting.value !== "object") return null;
  return normalizeWatchSituation(setting.value as Partial<WatchSituationConfig>);
}

export async function GET(request: Request) {
  const store = getStore();
  const forceRefresh = new URL(request.url).searchParams.has("refresh");
  const isFresh = store.config && Date.now() - store.fetchedAt < CACHE_TTL_MS;

  if (isFresh && !forceRefresh) {
    return json({ ok: true, config: store.config, source: "cache" });
  }

  try {
    const remote = await loadFromGoogle();
    store.config = remote ?? store.config ?? { ...DEFAULT_WATCH_SITUATION };
    store.fetchedAt = Date.now();
    return json({ ok: true, config: store.config, source: remote ? "google" : "default" });
  } catch {
    // Apps Script not yet updated or temporarily unavailable: fall back gracefully
    const fallback = store.config ?? { ...DEFAULT_WATCH_SITUATION };
    return json({ ok: true, config: fallback, source: "fallback" });
  }
}

export async function POST(request: Request) {
  try {
    const { user: portalUser } = await requireApprovedPortalUser(["super_admin", "admin"]);
    const body = (await request.json()) as { config?: Partial<WatchSituationConfig> };
    const editorName =
      [portalUser.firstName, portalUser.lastName].filter(Boolean).join(" ").trim() || portalUser.email;

    const config = normalizeWatchSituation({
      ...body.config,
      updatedAt: new Date().toISOString(),
      updatedBy: editorName,
    });

    const store = getStore();
    let persisted = false;
    let warning = "";
    try {
      const result = await postToGoogle({
        action: "saveSiteSetting",
        key: WATCH_SETTING_KEY,
        value: config,
        updatedBy: editorName,
      });
      if (result.ok === false) {
        throw new Error(String(result.error || "บันทึกลง Google Sheets ไม่สำเร็จ"));
      }
      persisted = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warning = message.includes("Unknown action")
        ? "บันทึกชั่วคราวแล้ว แต่ Google Apps Script ยังเป็นเวอร์ชันเก่า กรุณาอัปเดตสคริปต์ (google-apps-script.gs) และ Deploy ใหม่ เพื่อให้ค่าคงอยู่ถาวร"
        : `บันทึกชั่วคราวแล้ว แต่บันทึกลง Google Sheets ไม่สำเร็จ: ${message}`;
    }

    store.config = config;
    store.fetchedAt = Date.now();

    return json({ ok: true, config, persisted, warning });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
