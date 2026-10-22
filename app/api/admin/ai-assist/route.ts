import { json } from "@/app/lib/server";
import type { IncidentPhase } from "@/app/types";

export const dynamic = "force-dynamic";

// Primary OCR Engine: AksonOCR (Thai AI OCR)
const AKSONOCR_API_KEY =
  process.env.AKSONOCR_API_KEY ||
  "ak_93d2296ec7d44c10b3c955c3118deaa8";
const AKSONOCR_UPLOAD_URL = "https://backend.aksonocr.com/api/v2/upload";

// Fallback OCR & Chat LLM: OpenTyphoon AI
const TYPHOON_API_URL = "https://api.opentyphoon.ai/v1/chat/completions";
const TYPHOON_API_KEY =
  process.env.TYPHOON_API_KEY ||
  "sk-bViwADuR4simjjphPzc4n7jpuavwwCzRBngWwBnooLWrLamA";

const DEFAULT_CATEGORIES = [
  "น้ำท่วม",
  "โรคติดต่อ",
  "หมอกควัน",
  "อุบัติเหตุ",
  "ฟื้นฟูหลังเหตุ",
  "อื่นๆ",
];

export type CaptionOption = {
  id: string;
  name: string;
  hook: string;
  title: string;
  caption: string;
  hashtags: string[];
};

export type AiSuggestion = {
  title: string;
  phase: IncidentPhase;
  category: string;
  categories: string[];
  description: string;
  altText: string;
  keywords: string[];
  location: string;
  extractedText?: string;
  captionOptions?: CaptionOption[];
  ocrEngine?: "aksonocr" | "typhoon-ocr" | "none";
};

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizePhase(value: unknown): IncidentPhase {
  const text = String(value || "").toLowerCase().trim();
  if (text === "during" || text.includes("ระหว่าง")) return "during";
  if (text === "after" || text.includes("หลัง") || text.includes("ฟื้นฟู")) return "after";
  return "before";
}

function normalizeCaptionOptions(
  raw: unknown,
  fallbackTitle: string,
  fallbackDesc: string,
  fallbackKeywords: string[],
): CaptionOption[] {
  if (Array.isArray(raw) && raw.length >= 3) {
    return raw.slice(0, 3).map((item, idx) => {
      const rec = (item || {}) as Record<string, unknown>;
      return {
        id: String(rec.id || idx + 1),
        name: String(rec.name || `สไตล์ที่ ${idx + 1}`),
        hook: String(rec.hook || ""),
        title: String(rec.title || fallbackTitle),
        caption: String(rec.caption || fallbackDesc).trim(),
        hashtags: Array.isArray(rec.hashtags)
          ? rec.hashtags.map((h) => String(h).trim()).filter(Boolean)
          : fallbackKeywords,
      };
    });
  }

  return [
    {
      id: "1",
      name: "สไตล์ 1: สั้น กระตุกสายตา (Hook & Punchy)",
      hook: "⚡ ด่วน! เช็กก่อนสาย รู้ทันป้องกันทันที",
      title: fallbackTitle,
      caption: fallbackDesc,
      hashtags: fallbackKeywords,
    },
    {
      id: "2",
      name: "สไตล์ 2: ห่วงใย ใส่ใจ เตือนภัย (Caring & Actionable)",
      hook: "🛡️ ด้วยความห่วงใยจาก สสจ.สตูล ปฏิบัติตามนี้ปลอดภัยแน่นอน",
      title: fallbackTitle,
      caption: fallbackDesc,
      hashtags: fallbackKeywords,
    },
    {
      id: "3",
      name: "สไตล์ 3: ทันสมัย ชวนแชร์ ภาษาคนรุ่นใหม่ (Trendy & Engaging)",
      hook: "💡 ข้อมูลสุขภาพดีๆ เซฟไว้แล้วแชร์ต่อให้คนที่รัก",
      title: fallbackTitle,
      caption: fallbackDesc,
      hashtags: fallbackKeywords,
    },
  ];
}

async function runAksonOcr(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<{ text: string; error?: string; rateLimited?: boolean }> {
  try {
    const form = new FormData();
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const blobName = filename || `document.${ext}`;
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    form.append("file", blob, blobName);
    form.append("model", "aksonocr-1.0");

    const res = await fetch(AKSONOCR_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AKSONOCR_API_KEY}`,
        "X-API-Key": AKSONOCR_API_KEY,
      },
      body: form,
      signal: AbortSignal.timeout(22000),
    });

    if (res.status === 429 || res.status === 402 || res.status === 403) {
      return { text: "", error: `AksonOCR Quota/Rate Limit (${res.status})`, rateLimited: true };
    }

    if (!res.ok) {
      const errText = await res.text();
      return { text: "", error: `AksonOCR error ${res.status}: ${errText.slice(0, 150)}` };
    }

    const data = (await res.json()) as {
      pages?: Array<{ index?: number; markdown?: string; text?: string }>;
    };

    if (Array.isArray(data.pages) && data.pages.length > 0) {
      let combined = data.pages
        .map((p) => p.markdown || p.text || "")
        .filter(Boolean)
        .join("\n\n");
      combined = combined.replace(/<img[^>]*src=["']data:image\/[^"']+["'][^>]*>/gi, "");
      combined = combined.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/gi, "");
      if (combined.trim()) {
        return { text: combined.trim() };
      }
    }

    return { text: "", error: "AksonOCR returned no pages" };
  } catch (err) {
    return {
      text: "",
      error: err instanceof Error ? err.message : "AksonOCR request failed",
    };
  }
}

async function runTyphoonOcrFallback(dataUrl: string): Promise<string> {
  try {
    const res = await fetch(TYPHOON_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TYPHOON_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "typhoon-ocr",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = String(data.choices?.[0]?.message?.content || "").trim();
      if (text.includes("Extract all text from the image")) {
        return "";
      }
      return text;
    }
  } catch {}
  return "";
}

async function extractTextFromImage(
  imageDataUrl: string,
  imageUrl: string,
  fileName: string,
): Promise<{ text: string; engine: "aksonocr" | "typhoon-ocr" | "none" }> {
  let targetBuffer: Buffer | null = null;
  let targetMimeType = "image/jpeg";
  let targetDataUrl = "";

  if (imageDataUrl && imageDataUrl.startsWith("data:image/")) {
    targetDataUrl = imageDataUrl;
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      targetMimeType = match[1] || "image/jpeg";
      targetBuffer = Buffer.from(match[2], "base64");
    }
  } else if (imageUrl) {
    try {
      const res = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "image/*,*/*",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const cType = res.headers.get("content-type") || "image/jpeg";
        targetMimeType = cType.split(";")[0].trim();
        const arr = await res.arrayBuffer();
        targetBuffer = Buffer.from(arr);
        targetDataUrl = `data:${targetMimeType};base64,${targetBuffer.toString("base64")}`;
      }
    } catch (e) {
      console.warn("Failed to fetch imageUrl:", e);
    }
  }

  // 1. Primary OCR: AksonOCR (Thai AI OCR - high precision)
  if (targetBuffer && targetBuffer.length > 0) {
    const aksonResult = await runAksonOcr(targetBuffer, targetMimeType, fileName);
    if (aksonResult.text) {
      return { text: aksonResult.text, engine: "aksonocr" };
    }
    console.warn("AksonOCR fallback:", aksonResult.error || "no text", "-> switching to Typhoon OCR...");
  }

  // 2. Fallback OCR: Typhoon OCR (when AksonOCR is limited or unavailable)
  if (targetDataUrl) {
    const typhoonText = await runTyphoonOcrFallback(targetDataUrl);
    if (typhoonText) {
      return { text: typhoonText, engine: "typhoon-ocr" };
    }
  }

  return { text: "", engine: "none" };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      imageDataUrl?: string;
      imageUrl?: string;
      fileName?: string;
      currentTitle?: string;
      currentDescription?: string;
      categories?: string[];
      mode?: string;
    };

    const imageDataUrl = String(body.imageDataUrl || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const fileName = String(body.fileName || "").trim();
    const currentTitle = String(body.currentTitle || "").trim();
    const currentDescription = String(body.currentDescription || "").trim();

    const availableCategories =
      Array.isArray(body.categories) && body.categories.length > 0
        ? body.categories
        : DEFAULT_CATEGORIES;

    if (!imageDataUrl && !imageUrl && !fileName && !currentTitle) {
      return json(
        { ok: false, error: "กรุณาระบุข้อมูลรูปภาพหรือหัวข้อสื่อเพื่อวิเคราะห์ข้อมูล" },
        { status: 400 },
      );
    }

    // Step 1: Run Primary OCR (AksonOCR) with Fallback (Typhoon OCR)
    const ocrResult = await extractTextFromImage(imageDataUrl, imageUrl, fileName);
    const extractedText = ocrResult.text;

    // Step 2: Content Marketing & Copywriter Specialist Instruction
    const prompt = `คุณคือ Content Marketing และ Copywriter มืออาชีพของสำนักงานสาธารณสุขจังหวัดสตูล
หน้าที่ของคุณ: นำข้อความที่ตรวจพบในภาพจริงด้านล่างนี้ มาคิดและสรุปเป็นข้อมูลสื่อและแคปชั่น 3 สไตล์ ที่ถูกต้องและตรงกับภาพ 100%

ข้อความที่ตรวจพบในภาพจริง (อ่านโดยระบบ OCR ภาษาไทย):
"""
${extractedText || currentTitle || fileName || "ไม่มีข้อความในภาพ"}
"""

⚠️ กฎเหล็กสำคัญที่สุด (เนื้อหาต้องตรงกับภาพที่อัปโหลด 100% ห้ามคิดนอกเรื่อง):
1. ยึดเนื้อหาจาก "ข้อความที่ตรวจพบในภาพจริง" ด้านบนเป็นหลักเท่านั้น:
   - หากภาพเป็นเรื่องโรคไข้เลือดออก ชื่อเรื่อง เนื้อหา และแคปชั่นต้องเป็นเรื่องโรคไข้เลือดออกเท่านั้น
   - หากภาพเป็นเรื่องโรคฉี่หนู/น้ำท่วม/หมอกควัน/ความดันโลหิต/การปฐมพยาบาล ต้องเขียนให้ตรงกับเรื่องนั้นตามภาพจริงเท่านั้น
   - ห้ามเดาหรือเปลี่ยนเรื่องเป็นเรื่องอื่นที่ไม่ปรากฏในภาพเด็ดขาด
2. หมวดหมู่ (categories): ให้เลือก 1-3 รายการที่ตรงกับเนื้อหาในภาพจริงที่สุด จากรายการนี้เท่านั้น: [${availableCategories.join(", ")}]
3. ช่วงเหตุการณ์ (phase): วิเคราะห์จากเนื้อหาภาพ
   - before = การเตรียมตัว, ป้องกันล่วงหน้า, ให้ความรู้
   - during = กำลังเกิดเหตุ, อาการฉุกเฉิน, เตือนภัยเร่งด่วน
   - after = การฟื้นฟูหลังเกิดเหตุ, การดูแลต่อเนื่อง
4. รูปแบบแคปชั่น (Formatting & Elements):
   - สั้น กระชับ อ่านเข้าใจทันทีใน 3-5 วินาที
   - แบ่งเป็น Bullet points (• ) สรุปประเด็นหลัก 3-4 ข้อ
   - ใส่อิโมจิที่ตรงกับเนื้อหา (เช่น 🦟 ไข้เลือดออก, 🌊 น้ำท่วม, 🚨 ด่วน, 💊 ยา, 📞 1669)
   - ไฮไลต์ข้อความสำคัญด้วยเครื่องหมาย **...** เช่น **ห้ามซื้อยาทานเอง**, **โทร 1669 ทันที**
   - แฮชแท็ก 3-5 คำที่ตรงกับเนื้อหาภาพจริง
5. ตัวเลือกแคปชั่น 3 สไตล์ (captionOptions):
   - สไตล์ 1: สั้น กระตุกสายตา (Hook & Punchy) — ประโยคเปิดสั้นกระตุกสายตา
   - สไตล์ 2: ห่วงใย ใส่ใจ เตือนภัย (Caring & Actionable) — ประโยคเปิดแบบห่วงใย ชี้จุดเสี่ยงและวิธีป้องกัน
   - สไตล์ 3: ทันสมัย ชวนแชร์ ภาษาคนรุ่นใหม่ (Trendy & Engaging) — ภาษากระฉับกระเฉง ชวนแชร์ต่อ

ตอบกลับเป็น JSON เท่านั้น ตามโครงสร้างดังนี้:
{
  "title": "ชื่อหัวข้อโพสต์หลัก มีอิโมจิต้นประโยค (ไม่เกิน 70 ตัวอักษร สอดคล้องกับภาพจริง)",
  "phase": "before หรือ during หรือ after",
  "category": "หมวดหมู่หลัก 1 รายการ",
  "categories": ["หมวดหมู่ 1-3 รายการจากรายการที่กำหนด"],
  "description": "แคปชั่นหลักแบบ Bullet points (\\n• ) พร้อมอิโมจิและ **คำไฮไลต์**",
  "altText": "คำบรรยายภาพสั้นๆ 1 ประโยคเพื่อการเข้าถึง",
  "keywords": ["คำค้นหาและแฮชแท็ก 4-6 คำ"],
  "location": "จังหวัดสตูล",
  "captionOptions": [
    {
      "id": "1",
      "name": "สไตล์ 1: สั้น กระตุกสายตา (Hook & Punchy)",
      "hook": "ประโยคเปิดสั้นกระตุกสายตา",
      "title": "ชื่อหัวข้อแบบที่ 1",
      "caption": "แคปชั่นแบบที่ 1 สั้น กระชับ มี bullet points อิโมจิ และ **คำไฮไลต์**",
      "hashtags": ["#แฮชแท็ก1", "#แฮชแท็ก2", "#แฮชแท็ก3"]
    },
    {
      "id": "2",
      "name": "สไตล์ 2: ห่วงใย ใส่ใจ เตือนภัย (Caring & Actionable)",
      "hook": "ประโยคเปิดแบบห่วงใย",
      "title": "ชื่อหัวข้อแบบที่ 2",
      "caption": "แคปชั่นแบบที่ 2 สั้น กระชับ มี bullet points อิโมจิ และ **คำไฮไลต์**",
      "hashtags": ["#แฮชแท็ก1", "#แฮชแท็ก2", "#แฮชแท็ก3"]
    },
    {
      "id": "3",
      "name": "สไตล์ 3: ทันสมัย ชวนแชร์ ภาษาคนรุ่นใหม่ (Trendy & Engaging)",
      "hook": "ประโยคเปิดสไตล์ทันสมัย",
      "title": "ชื่อหัวข้อแบบที่ 3",
      "caption": "แคปชั่นแบบที่ 3 สั้น กระชับ มี bullet points อิโมจิ และ **คำไฮไลต์**",
      "hashtags": ["#แฮชแท็ก1", "#แฮชแท็ก2", "#แฮชแท็ก3"]
    }
  ]
}`;

    const instructResponse = await fetch(TYPHOON_API_URL, {
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
              "คุณคือ Content Marketing และ Copywriter มืออาชีพของสำนักงานสาธารณสุขจังหวัดสตูล เชี่ยวชาญการเขียนแคปชั่นบน Social Media สั้น กระชับ ดึงดูดสายตา มีอิโมจิ Bullet points และตัวเลือกแคปชั่น 3 สไตล์ ตอบกลับเป็น JSON ที่ถูกต้องตามโครงสร้างที่กำหนดเท่านั้น",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.35,
      }),
    });

    if (!instructResponse.ok) {
      const errorText = await instructResponse.text();
      return json(
        {
          ok: false,
          error: `ไม่สามารถเรียกใช้งาน AI ได้ (${instructResponse.status})`,
          details: errorText,
        },
        { status: 502 },
      );
    }

    const instructData = (await instructResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = String(instructData.choices?.[0]?.message?.content || "").trim();
    const parsed = extractJsonObject(rawContent);

    if (!parsed) {
      return json(
        {
          ok: false,
          error: "ไม่สามารถแปลงผลลัพธ์จาก AI ได้ กรุณาลองอีกครั้ง",
        },
        { status: 500 },
      );
    }

    const rawCategoriesInput = Array.isArray(parsed.categories)
      ? parsed.categories.map((item) => String(item).trim()).filter(Boolean)
      : String(parsed.categories || parsed.category || "")
          .split(/[,|/;]+/)
          .map((item) => item.trim())
          .filter(Boolean);

    const matchedCategories: string[] = [];
    for (const rawCat of rawCategoriesInput) {
      const match =
        availableCategories.find((item) => item === rawCat) ||
        availableCategories.find(
          (item) => rawCat.includes(item) || item.includes(rawCat),
        );
      if (match && !matchedCategories.includes(match)) {
        matchedCategories.push(match);
      }
    }

    const rawCategory = String(parsed.category || "").trim();
    const primaryMatch =
      availableCategories.find((item) => item === rawCategory) ||
      availableCategories.find(
        (item) => rawCategory.includes(item) || item.includes(rawCategory),
      );
    if (primaryMatch && !matchedCategories.includes(primaryMatch)) {
      matchedCategories.unshift(primaryMatch);
    }
    if (matchedCategories.length === 0) {
      matchedCategories.push(availableCategories[0] || "อื่นๆ");
    }

    const matchedCategory = matchedCategories.join(", ");

    const rawKeywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((item) => String(item).trim()).filter(Boolean)
      : String(parsed.keywords || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    const rawDescription = Array.isArray(parsed.description)
      ? parsed.description.map((line) => String(line).trim()).filter(Boolean).join("\n")
      : String(parsed.description || "").trim();

    const formattedDescription = rawDescription
      .replace(/\r\n/g, "\n")
      .replace(/(?:^|\n)\s*[-*]\s+/g, "\n• ")
      .replace(/([^\n])\s+(•\s)/g, "$1\n$2")
      .trim();

    const captionOptions = normalizeCaptionOptions(
      parsed.captionOptions,
      String(parsed.title || fileName || "ประกาศแจ้งเตือนสุขภาพ"),
      formattedDescription,
      rawKeywords,
    );

    const suggestion: AiSuggestion = {
      title: String(parsed.title || "").trim() || fileName.replace(/\.[^.]+$/, ""),
      phase: normalizePhase(parsed.phase),
      category: matchedCategory,
      categories: matchedCategories,
      description: formattedDescription,
      altText: String(parsed.altText || "").trim(),
      keywords: rawKeywords,
      location: String(parsed.location || "จังหวัดสตูล").trim() || "จังหวัดสตูล",
      extractedText,
      captionOptions,
      ocrEngine: ocrResult.engine,
    };

    return json({ ok: true, suggestion });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดระหว่างวิเคราะห์ภาพด้วย AI",
      },
      { status: 500 },
    );
  }
}
