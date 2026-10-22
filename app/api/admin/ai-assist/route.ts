import { json } from "@/app/lib/server";
import type { IncidentPhase } from "@/app/types";

export const dynamic = "force-dynamic";

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

type AiSuggestion = {
  title: string;
  phase: IncidentPhase;
  category: string;
  categories: string[];
  description: string;
  altText: string;
  keywords: string[];
  location: string;
  extractedText?: string;
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      imageDataUrl?: string;
      fileName?: string;
      categories?: string[];
    };

    const imageDataUrl = String(body.imageDataUrl || "").trim();
    const fileName = String(body.fileName || "").trim();
    const availableCategories =
      Array.isArray(body.categories) && body.categories.length > 0
        ? body.categories
        : DEFAULT_CATEGORIES;

    if (!imageDataUrl && !fileName) {
      return json(
        { ok: false, error: "กรุณาแนบไฟล์รูปภาพเพื่อวิเคราะห์ข้อมูล" },
        { status: 400 },
      );
    }

    let extractedText = "";

    // Step 1: Extract text and visual context from the image using Typhoon OCR
    if (imageDataUrl.startsWith("data:image/")) {
      const ocrResponse = await fetch(TYPHOON_API_URL, {
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
                  type: "text",
                  text: "อ่านข้อความภาษาไทยและภาษาอังกฤษทั้งหมดในภาพอินโฟกราฟิก/โปสเตอร์นี้อย่างละเอียด พร้อมอธิบายองค์ประกอบภาพและใจความสำคัญ",
                },
                {
                  type: "image_url",
                  image_url: { url: imageDataUrl },
                },
              ],
            },
          ],
          max_tokens: 1024,
          temperature: 0.1,
        }),
      });

      if (ocrResponse.ok) {
        const ocrData = (await ocrResponse.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        extractedText = String(ocrData.choices?.[0]?.message?.content || "").trim();
      }
    }

    // Step 2: Structure metadata into Risk Communication fields using Typhoon Instruct
    const prompt = `คุณคือครีเอเตอร์และผู้เชี่ยวชาญด้านการสื่อสารความเสี่ยงทางสุขภาพและสาธารณภัยยุคใหม่ ของสำนักงานสาธารณสุขจังหวัดสตูล
จากข้อมูลที่อ่านได้จากภาพสื่ออินโฟกราฟิก/โปสเตอร์ต่อไปนี้:
ชื่อไฟล์: ${fileName || "ไม่ระบุ"}
ข้อความและรายละเอียดจากภาพ:
"""
${extractedText || fileName}
"""

รายการประเภทเหตุการณ์ที่มีในระบบ: ${availableCategories.join(", ")}

เป้าหมายสำคัญ: ประชาชนและคนรุ่นใหม่ต้องการอ่านแล้วเข้าใจทันทีใน 3 วินาที ไม่ต้องบรรยายยาวเยิ่นเย้อ!
กรุณาวิเคราะห์และสร้างข้อมูลโดยปฏิบัติตามกฎนี้อย่างเคร่งครัด:
1. ภาษา: กระชับ ทันสมัย เข้าใจง่ายทันที ชัดเจน น่าเชื่อถือ
2. description:
   - สรุปเป็น Bullet points (•) สั้นๆ ตรงประเด็น เพียง 2-4 ข้อเท่านั้น (ห้ามเขียนบรรยายยาวเป็นย่อหน้า)
   - แต่ละข้อต้องขึ้นต้นด้วยอิโมจิที่ตรงกับประเด็น เช่น ⚠️ (จุดเสี่ยง/อาการ), 🛡️ (วิธีป้องกัน), 💡 (ข้อควรทำ), 📞 (สายด่วนฉุกเฉิน)
   - **การไฮไลต์ข้อความสำคัญ**: ให้ใส่เครื่องหมาย **...** ล้อมรอบคำสำคัญที่ต้องการย้ำเตือนประชาชน เพื่อให้ระบบนำไปแสดงผลเป็นไฮไลต์สะดุดตา เช่น **ห้ามเดินลุยน้ำเท้าเปล่า**, **โทร 1669 ทันที**, **ล้างมือทันที**

ตัวอย่าง description ที่ต้องการ:
📌 **เรื่องด่วนต้องรู้**: ป้องกันโรคฉี่หนูช่วงน้ำท่วมขัง
• ⚠️ **จุดเสี่ยง**: **ห้ามลุยน้ำเท้าเปล่า** ระวังเชื้อเข้าทางบาดแผล
• 🛡️ **วิธีป้องกัน**: สวมรองเท้าบูท และรีบล้างสบู่ทันที
• 📞 **สายด่วน**: หากมีไข้สูงหนาวสั่น โทร **1669 ฟรี 24 ชม.**

ตอบกลับเป็น JSON เท่านั้น ตามโครงสร้างดังนี้:
{
  "title": "ชื่อสื่อสั้นกระชับ ดึงดูดใจ มีอิโมจิต้นประโยค 1 ตัว (ไม่เกิน 70 ตัวอักษร)",
  "phase": "เลือกค่าเดียวจาก before หรือ during หรือ after",
  "categories": ["เลือกประเภทเหตุการณ์ที่เกี่ยวข้อง 1-3 รายการจาก [${availableCategories.join(", ")}]"],
  "category": "ประเภทเหตุการณ์หลัก 1 รายการจาก [${availableCategories.join(", ")}]",
  "description": "สรุปสั้นกระชับ 2-4 ข้อ มีอิโมจิ เป็น Bullet points (\\n• ) พร้อมใส่ **คำสำคัญที่ต้องการไฮไลต์**",
  "altText": "คำบรรยายภาพสั้นๆ 1 ประโยค",
  "keywords": ["คำค้นหา 4-6 คำ"],
  "location": "ชื่อพื้นที่หากปรากฏในภาพ มิฉะนั้นใช้คำว่า จังหวัดสตูล"
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
              "คุณเป็นผู้ช่วย AI สื่อสารความเสี่ยงยุคใหม่ของสำนักงานสาธารณสุขจังหวัดสตูล เชี่ยวชาญการสรุปข้อมูลสุขภาพให้เข้าใจง่าย ทันสมัย เข้าถึงวัยรุ่นปนทางการ มีอิโมจิ และจัดรูปแบบเป็น Bullet points ตอบกลับเป็น JSON ที่ถูกต้องตามโครงสร้างที่กำหนดเท่านั้น",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1100,
        temperature: 0.3,
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
