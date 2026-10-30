import assert from "node:assert/strict";
import test from "node:test";

test("QR route keeps provider credentials server-side and returns an image", async () => {
  process.env.ME_QR_API_TOKEN = "server-only-test-token";
  process.env.NEXT_PUBLIC_SITE_URL = "https://riskcom-stn.vercel.app";
  const originalFetch = globalThis.fetch;
  let providerRequest;

  globalThis.fetch = async (input, init) => {
    providerRequest = { input: String(input), init };
    return Response.json({ data: { imageUrl: "https://cdn.example/qr.png" } });
  };

  try {
    const { POST } = await import("../app/api/qr/route.ts");
    const response = await POST(
      new Request("https://riskcom-stn.vercel.app/api/qr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaId: "abc", slideIndex: 2, title: "หัวข้อทดสอบ" }),
      }),
    );
    const json = await response.json();

    assert.equal(response.status, 200);
    assert.equal(json.imageUrl, "https://cdn.example/qr.png");
    assert.equal(json.targetUrl, "https://riskcom-stn.vercel.app/?media=abc&slide=2");
    assert.equal(providerRequest.input, "https://me-qr.com/api/v2/qr/link/create");
    assert.equal(providerRequest.init.headers["X-AUTH-TOKEN"], "server-only-test-token");
    assert.doesNotMatch(JSON.stringify(json), /server-only-test-token/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ME_QR_API_TOKEN;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});

test("QR route falls back to an in-process branded QR when no provider is configured", async () => {
  delete process.env.ME_QR_API_TOKEN;
  delete process.env.GENQRCODE_API_KEY;
  const { POST } = await import("../app/api/qr/route.ts");
  const response = await POST(
    new Request("https://riskcom-stn.vercel.app/api/qr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaId: "abc", slideIndex: 0, title: "หัวข้อทดสอบ" }),
    }),
  );

  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.provider, "local");
  assert.match(json.imageUrl, /^data:image\/svg\+xml;base64,/);
  assert.equal(json.targetUrl, "https://riskcom-stn.vercel.app/?media=abc&slide=0");
});
