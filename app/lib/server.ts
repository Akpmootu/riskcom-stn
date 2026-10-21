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

function isTransientGoogleError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("timed out") ||
    lower.includes("service drive") ||
    lower.includes("service spreadsheets") ||
    lower.includes("server error") ||
    lower.includes("service invoked too many times") ||
    lower.includes("try again")
  );
}

function delayMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postToGoogle(payload: JsonRecord, maxAttempts = 3) {
  const url = getGoogleScriptUrl();
  if (!url) {
    throw new Error("ยังไม่ได้เชื่อมต่อ Google Apps Script");
  }

  const bodyText = JSON.stringify({
    ...payload,
    secret: process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "",
  });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=utf-8" },
        body: bodyText,
        redirect: "follow",
        cache: "no-store",
      });

      const text = await response.text();
      if (!response.ok) {
        const statusErr = new Error(`Google Apps Script ตอบกลับ ${response.status}`);
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < maxAttempts) {
          lastError = statusErr;
          await delayMs(1200 * attempt);
          continue;
        }
        throw statusErr;
      }

      let parsed: JsonRecord;
      try {
        parsed = JSON.parse(text) as JsonRecord;
      } catch {
        const parseErr = new Error("รูปแบบข้อมูลตอบกลับจาก Google Apps Script ไม่ถูกต้อง");
        if (attempt < maxAttempts) {
          lastError = parseErr;
          await delayMs(1200 * attempt);
          continue;
        }
        throw parseErr;
      }

      if (
        parsed.ok === false &&
        typeof parsed.error === "string" &&
        isTransientGoogleError(parsed.error) &&
        attempt < maxAttempts
      ) {
        await delayMs(1400 * attempt);
        continue;
      }

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts && isTransientGoogleError(lastError.message)) {
        await delayMs(1400 * attempt);
        continue;
      }
      if (attempt >= maxAttempts) {
        throw lastError;
      }
      await delayMs(1200 * attempt);
    }
  }

  throw lastError ?? new Error("ไม่สามารถเชื่อมต่อ Google Apps Script ได้");
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
