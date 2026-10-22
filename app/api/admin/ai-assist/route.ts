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

async function fetchAsDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:image/")) return url;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (res.ok) {
      const cType = res.headers.get("content-type") || "image/jpeg";
      const mime = cType.split(";")[0].trim();
      const arr = await res.arrayBuffer();
      const buf = Buffer.from(arr);
      if (buf.length > 0 && buf.length < 6 * 1024 * 1024) {
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    }
  } catch (err) {
    console.warn("fetchAsDataUrl failed:", err);
  }
  return url;
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

    let extractedText = "";

    // Step 1: Extract text and visual context from image using Typhoon OCR
    let targetImageForOcr = "";
    if (imageDataUrl && imageDataUrl.startsWith("data:image/")) {
      targetImageForOcr = imageDataUrl;
    } else if (imageUrl) {
      targetImageForOcr = await fetchAsDataUrl(imageUrl);
    }

    if (targetImageForOcr) {
      try {
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
                    text: "อ่านข้อความภาษาไทยและภาษาอังกฤษทั้งหมดในภาพอินโฟกราฟิก/โปสเตอร์นี้อย่างละเอียดและครบถ้วน พร้อมสรุปองค์ประกอบภาพและข้อความสำคัญ",
                  },
                  {
                    type: "image_url",
                    image_url: { url: targetImageForOcr },
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
      } catch {
        // Fallback gracefully without throwing
      }
    }

    // Step 2: Content Marketing & Copywriter Specialist Instruction
    const prompt = `คุณคือผู้เชี่ยวชาญด้าน Content Marketing และ Copywriter มืออาชีพที่เชี่ยวชาญการเขียนแคปชั่นบน Social Media (เช่น Facebook, Line OA, Twitter/X, TikTok) ให้กับสำนักงานสาธารณสุขจังหวัดสตูล

Task: ช่วยวิเคราะห์ภาพจริงที่แนบมานี้ และเขียนแคปชั่นสำหรับโพสต์ประชาสัมพันธ์/สื่อสารความเสี่ยงด้านสุขภาพ
⚠️ กฎเหล็กสำคัญ:
1. การคิดของ AI ต้องสอดคล้องกับภาพจริง: ต้องอิงเนื้อหาจากข้อความในภาพ (OCR) และรายละเอียดภาพด้านล่างนี้เป็นหลัก ห้ามสมมุติหรือมโนเรื่องที่ไม่ปรากฏในภาพเด็ดขาด
2. สรุปข้อมูลให้สั้นและเข้าใจได้ง่ายทันที: ผู้อ่านและประชาชนต้องการอ่านแล้วเข้าใจทันที ไม่ต้องบรรยายยาวเป็นพารากราฟ
3. ภาษามืออาชีพแต่ทันสมัย: ใช้ภาษาที่เป็นทางการ น่าเชื่อถือ แต่ผสมผสานคำสมัยใหม่ (Trendy words) หรือคำติดปาก เพื่อไม่ให้ดูน่าเบื่อ เข้าถึงวัยรุ่นและประชาชนได้จริง
4. Formatting & Elements:
   - Emoji: เลือกใช้อิโมจิที่ตรงกับเนื้อหา ตกแต่งให้อ่านง่าย สบายตา
   - Bullet points: สรุปประเด็นสำคัญเป็นข้อๆ โดยใช้ • นำหน้าแต่ละข้อ
   - การไฮไลต์: ใส่เครื่องหมาย **...** ล้อมรอบคำหรือข้อความที่ต้องการย้ำเตือนอย่างชัดเจน เช่น **ห้ามเดินลุยน้ำเท้าเปล่า**, **โทร 1669 ทันที**
   - Hashtags: แฮชแท็กที่ตรงกับเนื้อหา 3-5 คำ (เช่น #สาธารณสุขสตูล #เตือนภัยสุขภาพ #สตูลปลอดภัย)

ข้อมูลภาพและเนื้อหาประกอบ:
- ชื่อสื่อ/หัวข้อเดิม: ${currentTitle || "ไม่ระบุ"}
- เนื้อหาเดิม: ${currentDescription || "ไม่ระบุ"}
- รายละเอียดและข้อความที่ตรวจพบในภาพจริง:
"""
${extractedText || currentTitle || fileName || "ไม่มีข้อความเพิ่มเติม"}
"""
- หมวดหมู่เหตุการณ์ในระบบ: ${availableCategories.join(", ")}

Tone & Style ของแคปชั่น 3 สไตล์:
1. สไตล์ที่ 1: "สั้น กระตุกสายตา (Hook & Punchy)" — เน้นประโยคเปิด Hook กระตุกสายตา สั้น กระชับ ฉับไวใน 3 วินาที
2. สไตล์ที่ 2: "ห่วงใย ใส่ใจ เตือนภัย (Caring & Actionable)" — เน้นความห่วงใย ชี้จุดเสี่ยงและบอกวิธีป้องกันแบบทำตามได้ทันที
3. สไตล์ที่ 3: "ทันสมัย ชวนแชร์ ภาษาคนรุ่นใหม่ (Trendy & Engaging)" — ภาษากระฉับกระเฉง ชวนกดเซฟและแชร์ต่อให้คนที่รัก
2. ภาษามืออาชีพแต่ทันสมัย: ใช้ภาษาที่เป็นทางการ น่าเชื่อถือ แต่ผสมผสานคำสมัยใหม่ (Trendy words) หรือคำติดปาก เพื่อไม่ให้ดูน่าเบื่อ เข้าถึงวัยรุ่นและประชาชนได้จริง
3. Formatting & Elements:
   - Emoji: เลือกใช้อิโมจิที่ตรงกับเนื้อหา ตกแต่งให้สวยงาม สบายตา ช่วยแบ่งสัดส่วนเนื้อหาให้เปิดอ่านง่าย
   - Bullet points: ใช้ • สรุปข้อความสำคัญอย่างเป็นระเบียบ
   - การไฮไลต์: ใส่เครื่องหมาย **...** ล้อมรอบคำสำคัญที่ต้องการย้ำเตือน เช่น **ห้ามเดินลุยน้ำเท้าเปล่า**, **โทร 1669 ทันที**
   - Hashtags: แฮชแท็กที่ตรงกับเนื้อหาโดยตรง ผสมผสานแฮชแท็กที่เป็นกระแส (Trending/High search) เช่น #สาธารณสุขสตูล, #เตือนภัยสุขภาพ, #สตูลปลอดภัย, #เช็กก่อนแชร์

Output: ขอผลลัพธ์ตัวเลือกแคปชั่นทั้งหมด 3 แบบที่สไตล์ต่างกัน เพื่อให้ผู้ใช้เลือกใช้แบบที่ดีที่สุด:
1. สไตล์ที่ 1: "สั้น กระตุกสายตา (Hook & Punchy)" — เน้นเปิดด้วยประโยค Hook กระตุกสายตา สั้น กระชับ ฉับไวใน 3 วินาที
2. สไตล์ที่ 2: "ห่วงใย ใส่ใจ เตือนภัย (Caring & Actionable)" — เน้นความห่วงใย ชี้จุดเสี่ยงและบอกวิธีป้องกันแบบทำตามได้ทันที
3. สไตล์ที่ 3: "ทันสมัย ชวนแชร์ ภาษาคนรุ่นใหม่ (Trendy & Engaging)" — ภาษากระฉับกระเฉง ชวนกดเซฟและแชร์ต่อให้คนที่รัก

ตอบกลับเป็น JSON เท่านั้น ตามโครงสร้างดังนี้:
{
  "title": "ชื่อหัวข้อโพสต์หลักที่แนะนำ มีอิโมจิต้นประโยค (ไม่เกิน 70 ตัวอักษร)",
  "phase": "เลือกค่าเดียวจาก before หรือ during หรือ after",
  "categories": ["หมวดหมู่ที่เกี่ยวข้อง 1-3 รายการจาก [${availableCategories.join(", ")}]"],
  "category": "หมวดหมู่หลัก 1 รายการ",
  "description": "แคปชั่นหลักแบบ Bullet points (\\n• ) พร้อมอิโมจิและ **คำไฮไลต์**",
  "altText": "คำบรรยายภาพสั้นๆ 1 ประโยคเพื่อการเข้าถึง",
  "keywords": ["คำค้นหาและแฮชแท็ก 4-6 คำ"],
  "location": "ชื่อพื้นที่ เช่น จังหวัดสตูล",
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
