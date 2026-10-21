import {
  encodeGalleryKeyword,
  normalizeMediaItem,
  SLIDE_ATTACHMENT_TITLE,
  SLIDE_CHILD_KEYWORD,
} from "@/app/lib/media-gallery-utils";
import {
  arrayBufferToBase64,
  json,
  postToGoogle,
} from "@/app/lib/server";
import {
  portalErrorResponse,
  requireApprovedPortalUser,
} from "@/app/lib/users";
import type { MediaItem, MediaSlide } from "@/app/types";

export const dynamic = "force-dynamic";

const maxUploadBytes = 10 * 1024 * 1024;
const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function validateUploadFile(file: File) {
  if (!acceptedTypes.has(file.type)) {
    return "รองรับเฉพาะ JPG, PNG, WebP และ PDF";
  }
  if (file.size > maxUploadBytes) {
    return `ไฟล์ "${file.name}" มีขนาดเกิน 10 MB`;
  }
  return null;
}

async function uploadAttachmentFile(
  file: File,
  uploadedBy: string,
  meta: { phase: string; category: string; eventDate: string; location: string },
): Promise<MediaSlide> {
  const result = await postToGoogle({
    action: "upload",
    title: SLIDE_ATTACHMENT_TITLE,
    description: "ไฟล์ภาพประกอบในชุดสื่อ",
    phase: meta.phase,
    category: meta.category,
    eventDate: meta.eventDate,
    location: meta.location,
    keywords: [SLIDE_CHILD_KEYWORD],
    altText: "ภาพประกอบในชุดสื่อ",
    status: "draft",
    uploadedBy,
    file: {
      name: file.name,
      type: file.type,
      size: file.size,
      base64: arrayBufferToBase64(await file.arrayBuffer()),
    },
  });

  if (!result.ok || !result.item || typeof result.item !== "object") {
    throw new Error(String(result.error || `อัปโหลดไฟล์ประกอบ ${file.name} ไม่สำเร็จ`));
  }

  const rawItem = result.item as Partial<MediaItem>;
  return {
    id: String(rawItem.id || ""),
    driveFileId: rawItem.driveFileId ? String(rawItem.driveFileId) : undefined,
    thumbnailUrl: rawItem.thumbnailUrl ? String(rawItem.thumbnailUrl) : undefined,
    downloadUrl: rawItem.downloadUrl ? String(rawItem.downloadUrl) : undefined,
    fileName: String(rawItem.fileName || file.name),
    fileType: String(rawItem.fileType || file.type),
  };
}

export async function POST(request: Request) {
  try {
    const { user } = await requireApprovedPortalUser();
    const form = await request.formData();
    const mode = String(form.get("mode") ?? "").trim();

    const phase = String(form.get("phase") ?? "before");
    const category = String(form.get("category") ?? "อื่นๆ").trim();
    const eventDate = String(form.get("eventDate") ?? "");
    const location = String(form.get("location") ?? "จังหวัดสตูล").trim();

    if (mode === "attachment") {
      const attachmentFile = form.get("file");
      if (!(attachmentFile instanceof File)) {
        return json({ ok: false, error: "กรุณาเลือกไฟล์รูปภาพประกอบ" }, { status: 400 });
      }
      const validationError = validateUploadFile(attachmentFile);
      if (validationError) {
        return json({ ok: false, error: validationError }, { status: 400 });
      }

      const slide = await uploadAttachmentFile(attachmentFile, user.email, {
        phase,
        category,
        eventDate,
        location,
      });
      return json({ ok: true, slide });
    }

    const multiFiles = form
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const singleFile = form.get("file");
    const allFiles: File[] =
      multiFiles.length > 0
        ? multiFiles
        : singleFile instanceof File && singleFile.size > 0
          ? [singleFile]
          : [];

    if (allFiles.length === 0) {
      return json({ ok: false, error: "กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์" }, { status: 400 });
    }

    for (const targetFile of allFiles) {
      const validationError = validateUploadFile(targetFile);
      if (validationError) {
        return json({ ok: false, error: validationError }, { status: 400 });
      }
    }

    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const altText = String(form.get("altText") ?? "").trim();

    if (!title || !description || !altText) {
      return json(
        { ok: false, error: "กรุณากรอกชื่อ คำอธิบาย และคำบรรยายภาพให้ครบ" },
        { status: 400 },
      );
    }

    const extraSlides: MediaSlide[] = [];
    const extraSlidesJson = String(form.get("extraSlides") ?? "").trim();
    if (extraSlidesJson) {
      try {
        const parsed = JSON.parse(extraSlidesJson) as unknown;
        if (Array.isArray(parsed)) {
          for (const slide of parsed) {
            if (slide && typeof slide === "object") {
              extraSlides.push(slide as MediaSlide);
            }
          }
        }
      } catch {
        // Ignore malformed extraSlides JSON
      }
    }

    if (allFiles.length > 1) {
      for (const extraFile of allFiles.slice(1)) {
        const uploadedSlide = await uploadAttachmentFile(extraFile, user.email, {
          phase,
          category,
          eventDate,
          location,
        });
        extraSlides.push(uploadedSlide);
      }
    }

    const userKeywords = String(form.get("keywords") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const galleryToken = encodeGalleryKeyword(extraSlides);
    const finalKeywords = galleryToken
      ? [...userKeywords, galleryToken]
      : userKeywords;

    const primaryFile = allFiles[0];
    const payload = {
      action: "upload",
      title,
      description,
      phase,
      category,
      eventDate,
      location,
      keywords: finalKeywords,
      altText,
      status: form.get("status") === "draft" ? "draft" : "published",
      uploadedBy: user.email,
      file: {
        name: primaryFile.name,
        type: primaryFile.type,
        size: primaryFile.size,
        base64: arrayBufferToBase64(await primaryFile.arrayBuffer()),
      },
    };

    const result = await postToGoogle(payload);
    if (!result.ok) {
      throw new Error(String(result.error || "บันทึกสื่อไม่สำเร็จ"));
    }

    const normalizedItem =
      result.item && typeof result.item === "object"
        ? normalizeMediaItem(result.item as Partial<MediaItem> & { status?: string })
        : null;

    return json({
      ...result,
      item: normalizedItem ?? result.item,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
