import {
  buildTagConfigFromColor,
  type CategoryTagConfig,
  DEFAULT_CATEGORY_CONFIGS,
  parseCategories,
} from "@/app/lib/category-tags";
import { json } from "@/app/lib/server";
import { portalErrorResponse, requireApprovedPortalUser } from "@/app/lib/users";

export const dynamic = "force-dynamic";

export const DEFAULT_CATEGORIES = DEFAULT_CATEGORY_CONFIGS.map((item) => item.name);

// In-memory persistent store during runtime
let systemTagConfigs: CategoryTagConfig[] = [...DEFAULT_CATEGORY_CONFIGS];

export async function GET() {
  try {
    return json({
      ok: true,
      categories: systemTagConfigs.map((item) => item.name),
      tagConfigs: systemTagConfigs,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApprovedPortalUser(["super_admin", "admin", "uploader"]);
    const body = (await request.json()) as {
      action?: "add" | "update" | "reset" | "sync";
      name?: string;
      oldName?: string;
      color?: string;
      icon?: string;
      categories?: string[];
      tagConfigs?: CategoryTagConfig[];
    };

    if (body.action === "reset") {
      systemTagConfigs = [...DEFAULT_CATEGORY_CONFIGS];
      return json({
        ok: true,
        categories: systemTagConfigs.map((item) => item.name),
        tagConfigs: systemTagConfigs,
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
        systemTagConfigs = cleaned;
      }
      return json({
        ok: true,
        categories: systemTagConfigs.map((item) => item.name),
        tagConfigs: systemTagConfigs,
      });
    }

    if (Array.isArray(body.categories)) {
      const cleanedNames = parseCategories(body.categories);
      for (const name of cleanedNames) {
        if (!systemTagConfigs.some((item) => item.name === name)) {
          systemTagConfigs.push(buildTagConfigFromColor(name));
        }
      }
      return json({
        ok: true,
        categories: systemTagConfigs.map((item) => item.name),
        tagConfigs: systemTagConfigs,
      });
    }

    if (body.action === "update") {
      const targetName = String(body.oldName || body.name || "").trim();
      const nextName = String(body.name || targetName).trim();
      if (!targetName || !nextName) {
        return json({ ok: false, error: "กรุณาระบุชื่อ Tag ที่ต้องการแก้ไข" }, { status: 400 });
      }
      const existingIdx = systemTagConfigs.findIndex((item) => item.name === targetName);
      const updatedConfig = buildTagConfigFromColor(nextName, body.color, body.icon);
      if (existingIdx >= 0) {
        systemTagConfigs[existingIdx] = updatedConfig;
      } else {
        systemTagConfigs.push(updatedConfig);
      }
      return json({
        ok: true,
        categories: systemTagConfigs.map((item) => item.name),
        tagConfigs: systemTagConfigs,
      });
    }

    const rawInput = String(body.name || "").trim();
    const parsedNames = parseCategories(rawInput);
    if (parsedNames.length === 0) {
      return json({ ok: false, error: "กรุณาระบุชื่อประเภทเหตุการณ์ / Tag" }, { status: 400 });
    }

    for (let idx = 0; idx < parsedNames.length; idx += 1) {
      const name = parsedNames[idx];
      const existingIdx = systemTagConfigs.findIndex((item) => item.name === name);
      const nextConfig = buildTagConfigFromColor(
        name,
        idx === 0 ? body.color : undefined,
        idx === 0 ? body.icon : undefined,
      );
      if (existingIdx >= 0) {
        if (body.color || body.icon) {
          systemTagConfigs[existingIdx] = nextConfig;
        }
      } else {
        systemTagConfigs.push(nextConfig);
      }
    }

    return json({
      ok: true,
      categories: systemTagConfigs.map((item) => item.name),
      tagConfigs: systemTagConfigs,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireApprovedPortalUser(["super_admin", "admin"]);
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim();

    if (!name) {
      return json(
        { ok: false, error: "กรุณาระบุชื่อประเภทเหตุการณ์ / Tag ที่ต้องการลบ" },
        { status: 400 },
      );
    }

    if (systemTagConfigs.length <= 1 && systemTagConfigs[0]?.name === name) {
      return json(
        { ok: false, error: "ต้องมีประเภทเหตุการณ์อย่างน้อย 1 รายการในระบบ" },
        { status: 400 },
      );
    }

    systemTagConfigs = systemTagConfigs.filter((item) => item.name !== name);
    return json({
      ok: true,
      categories: systemTagConfigs.map((item) => item.name),
      tagConfigs: systemTagConfigs,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
