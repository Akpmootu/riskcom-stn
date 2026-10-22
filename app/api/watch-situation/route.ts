import { getGoogleScriptUrl, json, postToGoogle } from "@/app/lib/server";
import { portalErrorResponse, requireApprovedPortalUser } from "@/app/lib/users";
import {
  DEFAULT_WATCH_SITUATION,
  normalizeWatchSituation,
  WATCH_SETTING_KEY,
  type WatchSituationConfig,
} from "@/app/lib/watch-situation";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";

type WatchStore = {
  config: WatchSituationConfig | null;
  fetchedAt: number;
};

const CACHE_TTL_MS = 20 * 1000;

const globalStore = globalThis as typeof globalThis & {
  __satunWatchStore?: WatchStore;
};

function getLocalBackupPath(): string {
  try {
    return path.join(os.tmpdir(), "satun-watch-situation.json");
  } catch {
    return "/tmp/satun-watch-situation.json";
  }
}

function readLocalBackup(): WatchSituationConfig | null {
  try {
    const filePath = getLocalBackupPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      return normalizeWatchSituation(JSON.parse(raw));
    }
  } catch {
    // Ignore fallback read error
  }
  return null;
}

function writeLocalBackup(config: WatchSituationConfig): void {
  try {
    const filePath = getLocalBackupPath();
    fs.writeFileSync(filePath, JSON.stringify(config), "utf8");
  } catch {
    // Ignore fallback write error
  }
}

function getStore(): WatchStore {
  if (!globalStore.__satunWatchStore) {
    const diskFallback = readLocalBackup();
    globalStore.__satunWatchStore = {
      config: diskFallback,
      fetchedAt: diskFallback ? Date.now() : 0,
    };
  }
  return globalStore.__satunWatchStore;
}

async function loadFromGoogle(): Promise<WatchSituationConfig | null> {
  // 1. Try POST to Google Apps Script
  try {
    const result = await postToGoogle({ action: "getSiteSetting", key: WATCH_SETTING_KEY }, 2);
    if (result.ok && result.setting && typeof result.setting === "object") {
      const setting = result.setting as { value?: unknown };
      if (setting.value && typeof setting.value === "object") {
        return normalizeWatchSituation(setting.value as Partial<WatchSituationConfig>);
      }
    }
  } catch {
    // Fall back to direct GET if POST fails
    const scriptUrl = getGoogleScriptUrl();
    if (scriptUrl) {
      try {
        const getUrl = new URL(scriptUrl);
        getUrl.searchParams.set("action", "getSiteSetting");
        getUrl.searchParams.set("key", WATCH_SETTING_KEY);
        const res = await fetch(getUrl.toString(), { cache: "no-store", redirect: "follow" });
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean; setting?: { value?: unknown } };
          if (data.ok && data.setting && data.setting.value && typeof data.setting.value === "object") {
            return normalizeWatchSituation(data.setting.value as Partial<WatchSituationConfig>);
          }
        }
      } catch {
        // Fallback below
      }
    }
  }
  return null;
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
    if (remote) {
      store.config = remote;
      store.fetchedAt = Date.now();
      writeLocalBackup(remote);
      return json({ ok: true, config: store.config, source: "google" });
    }
  } catch {
    // Continue to fallback
  }

  const fallback = store.config ?? readLocalBackup() ?? { ...DEFAULT_WATCH_SITUATION };
  store.config = fallback;
  return json({ ok: true, config: fallback, source: "fallback" });
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
    store.config = config;
    store.fetchedAt = Date.now();
    writeLocalBackup(config);

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
      if (message.includes("Unknown action") || message.includes("ยังไม่ได้เชื่อมต่อ")) {
        warning =
          "ระบบบันทึกการตั้งค่าพร้อมแสดงบนหน้าแรกทันทีแล้ว แต่ Google Apps Script ยังเป็นเวอร์ชันเดิม กรุณาคัดลอกสคริปต์เวอร์ชันล่าสุดจาก public/google-apps-script.gs ไปอัปเดตและ Deploy ใหม่ในบัญชี dh.satun@gmail.com เพื่อให้ค่าบันทึกลง Google Sheet อย่างถาวร";
      } else {
        warning = `ระบบบันทึกสถานะพร้อมแสดงบนหน้าแรกแล้ว แต่การเชื่อมต่อไปยัง Google Sheets พบข้อสังเกต: ${message}`;
      }
    }

    return json({
      ok: true,
      config,
      persisted,
      warning: warning || undefined,
      message: persisted
        ? "บันทึกและส่งข้อมูลลง Google Sheets เรียบร้อยแล้ว หน้าแรกอัปเดตทันที"
        : "บันทึกข้อมูลเรียบร้อยแล้ว หน้าแรกอัปเดตทันที",
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
