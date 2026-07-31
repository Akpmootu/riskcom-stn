import {
  arrayBufferToBase64,
  isAdminRequest,
  json,
  postToGoogle,
} from "@/app/lib/server";

export const dynamic = "force-dynamic";

const maxUploadBytes = 10 * 1024 * 1024;
const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return json({ ok: false, error: "รหัสผู้ดูแลไม่ถูกต้อง" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ ok: false, error: "กรุณาเลือกไฟล์" }, { status: 400 });
    }
    if (!acceptedTypes.has(file.type)) {
      return json(
        { ok: false, error: "รองรับเฉพาะ JPG, PNG, WebP และ PDF" },
        { status: 400 },
      );
    }
    if (file.size > maxUploadBytes) {
      return json({ ok: false, error: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }, { status: 400 });
    }

    const payload = {
      action: "upload",
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      phase: String(form.get("phase") ?? "before"),
      category: String(form.get("category") ?? "อื่นๆ").trim(),
      eventDate: String(form.get("eventDate") ?? ""),
      location: String(form.get("location") ?? "จังหวัดสตูล").trim(),
      keywords: String(form.get("keywords") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      altText: String(form.get("altText") ?? "").trim(),
      status: form.get("status") === "draft" ? "draft" : "published",
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        base64: arrayBufferToBase64(await file.arrayBuffer()),
      },
    };

    if (!payload.title || !payload.description || !payload.altText) {
      return json(
        { ok: false, error: "กรุณากรอกชื่อ คำอธิบาย และคำบรรยายภาพให้ครบ" },
        { status: 400 },
      );
    }

    const result = await postToGoogle(payload);
    if (!result.ok) {
      throw new Error(String(result.error || "บันทึกสื่อไม่สำเร็จ"));
    }
    return json(result);
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "บันทึกสื่อไม่สำเร็จ",
      },
      { status: 500 },
    );
  }
}
