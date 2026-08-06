import { json } from "@/app/lib/server";
import { portalErrorResponse, requireApprovedPortalUser } from "@/app/lib/users";

export const dynamic = "force-dynamic";

export const DEFAULT_CATEGORIES = [
  "น้ำท่วม",
  "โรคติดต่อ",
  "หมอกควัน",
  "อุบัติเหตุ",
  "ฟื้นฟูหลังเหตุ",
  "อื่นๆ",
];

// In-memory persistent store during runtime
let systemCategories: string[] = [...DEFAULT_CATEGORIES];

export async function GET() {
  try {
    return json({ ok: true, categories: systemCategories });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApprovedPortalUser(["super_admin", "admin"]);
    const body = (await request.json()) as { name?: string; categories?: string[] };

    if (Array.isArray(body.categories)) {
      const cleaned = body.categories
        .map((item) => String(item).trim())
        .filter(Boolean);
      systemCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...cleaned]));
      return json({ ok: true, categories: systemCategories });
    }

    const name = String(body.name || "").trim();
    if (!name) {
      return json({ ok: false, error: "กรุณาระบุชื่อประเภทเหตุการณ์" }, { status: 400 });
    }

    if (systemCategories.includes(name)) {
      return json({ ok: false, error: "ประเภทเหตุการณ์นี้มีอยู่ในระบบแล้ว" }, { status: 400 });
    }

    systemCategories.push(name);
    return json({ ok: true, categories: systemCategories });
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
      return json({ ok: false, error: "กรุณาระบุชื่อประเภทเหตุการณ์ที่ต้องการลบ" }, { status: 400 });
    }

    if (DEFAULT_CATEGORIES.includes(name)) {
      return json({ ok: false, error: "ไม่สามารถลบประเภทเหตุการณ์มาตรฐานของระบบได้" }, { status: 400 });
    }

    systemCategories = systemCategories.filter((item) => item !== name);
    return json({ ok: true, categories: systemCategories });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
