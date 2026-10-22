import {
  buildTagConfigFromColor,
  type CategoryTagConfig,
  DEFAULT_CATEGORY_CONFIGS,
  parseCategories,
} from "@/app/lib/category-tags";
import { getGoogleScriptUrl, json, postToGoogle } from "@/app/lib/server";
import { portalErrorResponse, requireApprovedPortalUser } from "@/app/lib/users";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";

export const DEFAULT_CATEGORIES = DEFAULT_CATEGORY_CONFIGS.map((item) => item.name);

const TAG_STORAGE_KEY = "category_tags";

// In-memory cache
let systemTagConfigs: CategoryTagConfig[] | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 25 * 1000;

function getLocalBackupPath(): string {
  try {
    return path.join(os.tmpdir(), "satun-category-tags.json");
  } catch {
    return "/tmp/satun-category-tags.json";
  }
}

function readLocalBackup(): CategoryTagConfig[] | null {
  try {
    const p = getLocalBackupPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return null;
}

function writeLocalBackup(configs: CategoryTagConfig[]): void {
  try {
    fs.writeFileSync(getLocalBackupPath(), JSON.stringify(configs), "utf8");
  } catch {}
}

async function loadTagsFromGoogle(): Promise<CategoryTagConfig[] | null> {
  try {
    const res = await postToGoogle({ action: "getSiteSetting", key: TAG_STORAGE_KEY }, 2);
    if (res.ok && res.setting && typeof res.setting === "object") {
      const setting = res.setting as { value?: unknown };
      if (Array.isArray(setting.value) && setting.value.length > 0) {
        return setting.value as CategoryTagConfig[];
      }
    }
  } catch {
    const url = getGoogleScriptUrl();
    if (url) {
      try {
        const getUrl = new URL(url);
        getUrl.searchParams.set("action", "getSiteSetting");
        getUrl.searchParams.set("key", TAG_STORAGE_KEY);
        const res = await fetch(getUrl.toString(), { cache: "no-store", redirect: "follow" });
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean; setting?: { value?: unknown } };
          if (data.ok && data.setting && Array.isArray(data.setting.value)) {
            return data.setting.value as CategoryTagConfig[];
          }
        }
      } catch {}
    }
  }
  return null;
}

async function persistTagsToGoogle(
  configs: CategoryTagConfig[],
  userEmail: string,
): Promise<boolean> {
  writeLocalBackup(configs);
  try {
    const res = await postToGoogle({
      action: "saveSiteSetting",
      key: TAG_STORAGE_KEY,
      value: configs,
      updatedBy: userEmail,
    });
    return res.ok !== false;
  } catch (err) {
    console.error("Failed to persist category tags to Google Sheets:", err);
    return false;
  }
}

async function suggestTagIconWithAi(
  tagName: string,
): Promise<{ icon: string; color: string; reason: string }> {
  const TYPHOON_API_URL = "https://api.opentyphoon.ai/v1/chat/completions";
  const TYPHOON_API_KEY =
    process.env.TYPHOON_API_KEY ||
    "sk-bViwADuR4simjjphPzc4n7jpuavwwCzRBngWwBnooLWrLamA";

  const prompt = `คุณคือผู้เชี่ยวชาญด้าน UI/UX และ Iconography
สำหรับชื่อหมวดหมู่/ประเภทเหตุการณ์ความเสี่ยง: "${tagName}"
กรุณาเลือก:
1. ไอคอน Font Awesome 6 (หมวด fa-solid ที่มีอยู่จริง เช่น fa-solid fa-mosquito, fa-solid fa-water, fa-solid fa-house-chimney-crack, fa-solid fa-car-burst, fa-solid fa-cloud-rain, fa-solid fa-wind, fa-solid fa-sun-plant-wilt, fa-solid fa-mask-face, fa-solid fa-fire, fa-solid fa-triangle-exclamation, fa-solid fa-shield-virus, fa-solid fa-heart-pulse, fa-solid fa-virus, fa-solid fa-bacteria, fa-solid fa-skull-crossbones, fa-solid fa-truck-medical, fa-solid fa-bell)
2. รหัสสี HEX 1 สี ที่เหมาะกับประเภทเหตุการณ์นี้ (เช่น สีแดง/ส้มสำหรับเตือนภัยอันตราย, สีฟ้าสำหรับน้ำท่วม, สีเขียวสำหรับฟื้นฟู/สิ่งแวดล้อม, สีม่วงสำหรับโรคติดต่อ)

ตอบกลับเป็น JSON เท่านั้น:
{
  "icon": "fa-solid fa-...",
  "color": "#HEX",
  "reason": "เหตุผลสั้นๆ ไม่เกิน 1 ประโยค"
}`;

  try {
    const res = await fetch(TYPHOON_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TYPHOON_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "typhoon-v2.5-30b-a3b-instruct",
        messages: [
          {
            role: "system",
            content:
              "คุณคือผู้เชี่ยวชาญด้านไอคอน Font Awesome 6 และชุดสี UI ตอบกลับเป็น JSON เท่านั้น",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = String(data.choices?.[0]?.message?.content || "").trim();
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { icon?: string; color?: string; reason?: string };
        if (parsed.icon && typeof parsed.icon === "string") {
          return {
            icon: parsed.icon.startsWith("fa-") ? parsed.icon : `fa-solid fa-${parsed.icon}`,
            color: /^#[0-9a-fA-F]{6}$/.test(parsed.color || "") ? (parsed.color as string) : "#0284c7",
            reason: String(parsed.reason || ""),
          };
        }
      }
    }
  } catch {}

  // Heuristic fallback
  const lower = tagName.toLowerCase();
  if (lower.includes("ยุง") || lower.includes("ไข้เลือดออก")) {
    return { icon: "fa-solid fa-mosquito", color: "#e11d48", reason: "สื่อถึงโรคไข้เลือดออกและยุงลาย" };
  }
  if (lower.includes("น้ำ") || lower.includes("อุทกภัย") || lower.includes("จม")) {
    return { icon: "fa-solid fa-water", color: "#0284c7", reason: "สื่อถึงน้ำท่วมและอุทกภัย" };
  }
  if (lower.includes("ฝุ่น") || lower.includes("ควัน") || lower.includes("pm")) {
    return { icon: "fa-solid fa-smog", color: "#7c3aed", reason: "สื่อถึงมลพิษทางอากาศและหมอกควัน" };
  }
  if (lower.includes("อุบัติเหตุ") || lower.includes("รถ") || lower.includes("จราจร")) {
    return { icon: "fa-solid fa-car-burst", color: "#d97706", reason: "สื่อถึงอุบัติเหตุจราจร" };
  }
  if (lower.includes("ไฟ") || lower.includes("เพลิง") || lower.includes("ไหม้")) {
    return { icon: "fa-solid fa-fire", color: "#dc2626", reason: "สื่อถึงอัคคีภัย" };
  }
  if (lower.includes("พายุ") || lower.includes("ลม") || lower.includes("วาตภัย")) {
    return { icon: "fa-solid fa-wind", color: "#0891b2", reason: "สื่อถึงวาตภัย" };
  }
  if (lower.includes("โรค") || lower.includes("เชื้อ") || lower.includes("ติดต่อ")) {
    return { icon: "fa-solid fa-shield-virus", color: "#9333ea", reason: "สื่อถึงการป้องกันโรคติดต่อ" };
  }

  return { icon: "fa-solid fa-triangle-exclamation", color: "#d97706", reason: "ไอคอนแจ้งเตือนความเสี่ยงทั่วไป" };
}

async function getEffectiveTagConfigs(): Promise<CategoryTagConfig[]> {
  const isFresh = systemTagConfigs && Date.now() - lastFetchedAt < CACHE_TTL_MS;
  if (isFresh && systemTagConfigs) return systemTagConfigs;

  const remote = await loadTagsFromGoogle();
  if (remote && remote.length > 0) {
    systemTagConfigs = remote;
    lastFetchedAt = Date.now();
    writeLocalBackup(remote);
    return remote;
  }

  const disk = readLocalBackup();
  if (disk && disk.length > 0) {
    systemTagConfigs = disk;
    lastFetchedAt = Date.now();
    return disk;
  }

  systemTagConfigs = [...DEFAULT_CATEGORY_CONFIGS];
  return systemTagConfigs;
}

export async function GET() {
  try {
    const configs = await getEffectiveTagConfigs();
    return json({
      ok: true,
      categories: configs.map((item) => item.name),
      tagConfigs: configs,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user: portalUser } = await requireApprovedPortalUser([
      "super_admin",
      "admin",
      "uploader",
    ]);

    const body = (await request.json()) as {
      action?: "add" | "update" | "reset" | "sync" | "suggestIcon";
      name?: string;
      oldName?: string;
      color?: string;
      icon?: string;
      categories?: string[];
      tagConfigs?: CategoryTagConfig[];
    };

    if (body.action === "suggestIcon") {
      const tagName = String(body.name || "").trim();
      if (!tagName) {
        return json({ ok: false, error: "กรุณาระบุชื่อ Tag เพื่อวิเคราะห์ไอคอน" }, { status: 400 });
      }
      const suggestion = await suggestTagIconWithAi(tagName);
      return json({ ok: true, ...suggestion });
    }

    let configs = await getEffectiveTagConfigs();

    if (body.action === "reset") {
      configs = [...DEFAULT_CATEGORY_CONFIGS];
      systemTagConfigs = configs;
      lastFetchedAt = Date.now();
      await persistTagsToGoogle(configs, portalUser.email);
      return json({
        ok: true,
        categories: configs.map((item) => item.name),
        tagConfigs: configs,
        persisted: true,
      });
    }

    if (Array.isArray(body.tagConfigs) && body.tagConfigs.length > 0) {
      const cleaned: CategoryTagConfig[] = [];
      const seen = new Set<string>();
      for (const raw of body.tagConfigs) {
        const name = String(raw?.name || "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        cleaned.push(buildTagConfigFromColor(name, raw.color, raw.icon));
      }
      if (cleaned.length > 0) {
        configs = cleaned;
        systemTagConfigs = configs;
        lastFetchedAt = Date.now();
        await persistTagsToGoogle(configs, portalUser.email);
      }
      return json({
        ok: true,
        categories: configs.map((item) => item.name),
        tagConfigs: configs,
        persisted: true,
      });
    }

    if (Array.isArray(body.categories)) {
      const cleanedNames = parseCategories(body.categories);
      for (const name of cleanedNames) {
        if (!configs.some((item) => item.name === name)) {
          configs.push(buildTagConfigFromColor(name));
        }
      }
      systemTagConfigs = configs;
      lastFetchedAt = Date.now();
      await persistTagsToGoogle(configs, portalUser.email);
      return json({
        ok: true,
        categories: configs.map((item) => item.name),
        tagConfigs: configs,
        persisted: true,
      });
    }

    if (body.action === "update") {
      const targetName = String(body.oldName || body.name || "").trim();
      const nextName = String(body.name || targetName).trim();
      if (!targetName || !nextName) {
        return json({ ok: false, error: "กรุณาระบุชื่อ Tag ที่ต้องการแก้ไข" }, { status: 400 });
      }
      const existingIdx = configs.findIndex((item) => item.name === targetName);
      const updatedConfig = buildTagConfigFromColor(nextName, body.color, body.icon);
      if (existingIdx >= 0) {
        configs[existingIdx] = updatedConfig;
      } else {
        configs.push(updatedConfig);
      }
      systemTagConfigs = configs;
      lastFetchedAt = Date.now();
      await persistTagsToGoogle(configs, portalUser.email);
      return json({
        ok: true,
        categories: configs.map((item) => item.name),
        tagConfigs: configs,
        persisted: true,
      });
    }

    // Default: Add single or comma-separated tags
    const rawInput = String(body.name || "").trim();
    const parsedNames = parseCategories(rawInput);
    if (parsedNames.length === 0) {
      return json({ ok: false, error: "กรุณาระบุชื่อประเภทเหตุการณ์ / Tag" }, { status: 400 });
    }

    for (let idx = 0; idx < parsedNames.length; idx += 1) {
      const name = parsedNames[idx];
      const existingIdx = configs.findIndex((item) => item.name === name);
      const nextConfig = buildTagConfigFromColor(
        name,
        idx === 0 ? body.color : undefined,
        idx === 0 ? body.icon : undefined,
      );
      if (existingIdx >= 0) {
        if (body.color || body.icon) {
          configs[existingIdx] = nextConfig;
        }
      } else {
        configs.push(nextConfig);
      }
    }

    systemTagConfigs = configs;
    lastFetchedAt = Date.now();
    await persistTagsToGoogle(configs, portalUser.email);

    return json({
      ok: true,
      categories: configs.map((item) => item.name),
      tagConfigs: configs,
      persisted: true,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user: portalUser } = await requireApprovedPortalUser(["super_admin", "admin"]);
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim();

    if (!name) {
      return json(
        { ok: false, error: "กรุณาระบุชื่อประเภทเหตุการณ์ / Tag ที่ต้องการลบ" },
        { status: 400 },
      );
    }

    let configs = await getEffectiveTagConfigs();

    if (configs.length <= 1 && configs[0]?.name === name) {
      return json(
        { ok: false, error: "ต้องมีประเภทเหตุการณ์อย่างน้อย 1 รายการในระบบ" },
        { status: 400 },
      );
    }

    configs = configs.filter((item) => item.name !== name);
    systemTagConfigs = configs;
    lastFetchedAt = Date.now();
    await persistTagsToGoogle(configs, portalUser.email);

    return json({
      ok: true,
      categories: configs.map((item) => item.name),
      tagConfigs: configs,
      persisted: true,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
