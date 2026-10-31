import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMediaDeepLink,
  buildMeQrPayload,
  buildQrPoster,
  extractQrImage,
  normalizeSlideIndex,
} from "../app/lib/qr-code.ts";

test("builds a direct media link for the requested image", () => {
  assert.equal(
    buildMediaDeepLink("https://riskcom-stn.vercel.app/", "media 123", 2),
    "https://riskcom-stn.vercel.app/?media=media+123&slide=2",
  );
});

test("normalizes invalid image indexes to the first image", () => {
  assert.equal(normalizeSlideIndex(-1), 0);
  assert.equal(normalizeSlideIndex(Number.NaN), 0);
  assert.equal(normalizeSlideIndex(3.8), 3);
});

test("creates the documented ME-QR link payload with the Satun logo", () => {
  const payload = buildMeQrPayload({
    link: "https://riskcom-stn.vercel.app/?media=abc&slide=1",
    title: "สื่อป้องกันไข้เลือดออก",
    logoUrl: "https://riskcom-stn.vercel.app/ssj-satun-logo.png",
  });

  assert.deepEqual(payload.qrFieldsData, {
    link: "https://riskcom-stn.vercel.app/?media=abc&slide=1",
  });
  assert.equal(payload.format, "png");
  assert.equal(payload.designType, "base");
  assert.equal(payload.qrOptions.errorCorrectionLevel, "H");
  assert.equal(payload.qrOptions.patternColor, "#000000");
  assert.equal(payload.qrOptions.cornetsOuterColor, "#000000");
  assert.equal(payload.qrOptions.cornetsInteriorColor, "#000000");
  assert.equal(payload.qrOptions.logotype, "https://riskcom-stn.vercel.app/ssj-satun-logo.png");
  assert.equal(payload.qrOptions.logotypeSize, 0.22);
});

test("builds a downloadable QR poster with both required organization lines", () => {
  const poster = buildQrPoster("data:image/png;base64,ZmFrZQ==");
  assert.match(poster, /^data:image\/svg\+xml;base64,/);

  const svg = Buffer.from(poster.split(",")[1], "base64").toString("utf8");
  assert.match(svg, /กลุ่มภารกิจสื่อสารความเสี่ยง/);
  assert.match(svg, /สำนักงานสาธารณสุขจังหวัดสตูล/);
  assert.match(svg, /href="data:image\/png;base64,ZmFrZQ=="/);
  assert.match(svg, /viewBox="0 0 1200 1450"/);
});

test("extracts an image URL from common provider response envelopes", () => {
  assert.equal(
    extractQrImage({ data: { qrCode: { imageUrl: "https://cdn.example/qr.png" } } }),
    "https://cdn.example/qr.png",
  );
  assert.equal(
    extractQrImage({ result: { url: "https://cdn.example/second.svg" } }),
    "https://cdn.example/second.svg",
  );
  assert.equal(extractQrImage({ ok: true }), "");
});
