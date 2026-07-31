type JsonRecord = Record<string, unknown>;

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function getGoogleScriptUrl() {
  return process.env.GOOGLE_APPS_SCRIPT_URL?.trim() ?? "";
}

export function isAdminRequest(request: Request) {
  const expected = process.env.ADMIN_ACCESS_KEY?.trim() ?? "";
  const supplied = request.headers.get("x-admin-key")?.trim() ?? "";
  if (!expected || expected.length !== supplied.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function postToGoogle(payload: JsonRecord) {
  const url = getGoogleScriptUrl();
  if (!url) {
    throw new Error("ยังไม่ได้เชื่อมต่อ Google Apps Script");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      ...payload,
      secret: process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "",
    }),
    redirect: "follow",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google Apps Script ตอบกลับ ${response.status}`);
  }

  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    throw new Error("รูปแบบข้อมูลตอบกลับจาก Google Apps Script ไม่ถูกต้อง");
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
