import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function render(path = "/", method = "GET") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders an accessible gallery loading skeleton", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>คลังสื่อสารความเสี่ยง จังหวัดสตูล<\/title>/);
  assert.match(html, /src="\/satun-risk-logo\.png"/);
  assert.match(html, /class="site-shell site-data-skeleton"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /กำลังดาวน์โหลดข้อมูลจากคลังสื่อ กรุณารอสักครู่/);
  assert.match(html, /class="skeleton-block skeleton-media-visual"/);
  assert.match(html, /class="mobile-bottom-nav"/);
  assert.match(
    html,
    /จัดทำโดย นายอรรฆพร ศรีปานรอด นักวิชาการคอมพิวเตอร์ปฏิบัติการ/,
  );
  assert.match(
    html,
    /กลุ่มงานสุขภาพดิจิทัล สำนักงานสาธารณสุขจังหวัดสตูล/,
  );
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders public API documentation and exposes CORS preflight", async () => {
  const pageResponse = await render("/developers");
  assert.equal(pageResponse.status, 200);
  const html = await pageResponse.text();
  assert.match(html, /Satun Risk Media API/);
  assert.match(html, /GET \/api\/v1\/media/);
  assert.match(html, /Query parameters/);
  assert.match(html, /thumbnailUrl/);

  const optionsResponse = await render("/api/v1/media", "OPTIONS");
  assert.equal(optionsResponse.status, 204);
  assert.equal(optionsResponse.headers.get("access-control-allow-origin"), "*");
  assert.match(
    optionsResponse.headers.get("access-control-allow-methods") ?? "",
    /GET/,
  );
  assert.equal(optionsResponse.headers.get("x-api-version"), "1.0");
});

test("includes responsive media management, Kanit, system skeletons, and existing platform features", async () => {
  const [
    gallery,
    mediaCache,
    adminConsole,
    adminSkeleton,
    adminLoading,
    siteLoading,
    layout,
    css,
    packageJson,
    appsScript,
    publicAppsScript,
    publicMediaApi,
    publicMediaListRoute,
    publicMediaDetailRoute,
    developerPage,
  ] = await Promise.all([
    readFile(new URL("../app/media-gallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-cache.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/admin/admin-console.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/admin/admin-skeleton.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(
      new URL("../integrations/google-apps-script/Code.gs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../public/google-apps-script.gs", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/public-media-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/media/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/developers/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(gallery, /className="mobile-bottom-nav"/);
  assert.match(gallery, /className="fullscreen-viewer"/);
  assert.match(gallery, /if \(loading\) return <MediaGallerySkeleton \/>/);
  assert.match(gallery, /skeleton-visitor-count/);
  assert.match(gallery, /readMediaCache\(\)/);
  assert.match(gallery, /\/api\/media\?refresh=/);
  assert.match(gallery, /ข้อมูลจากแคชในเครื่อง/);
  assert.match(gallery, /\/api\/analytics\/view/);
  assert.match(gallery, /API สำหรับนักพัฒนา/);
  assert.match(mediaCache, /MEDIA_CACHE_MAX_AGE_MS = 10 \* 60 \* 1000/);
  assert.match(mediaCache, /window\.localStorage\.getItem/);
  assert.match(mediaCache, /response\.source === "google"/);
  assert.match(adminConsole, /\/api\/admin\/media/);
  assert.match(adminConsole, /\/api\/admin\/history/);
  assert.match(adminConsole, /คลังสื่อทั้งหมด/);
  assert.match(adminConsole, /MEDIA_PAGE_SIZE = 8/);
  assert.match(adminConsole, /อัปโหลดล่าสุดก่อน/);
  assert.match(adminConsole, /เดือนย้อนหลัง/);
  assert.match(adminConsole, /if \(hydrating\) return <AdminDashboardSkeleton \/>/);
  assert.match(adminConsole, /clearMediaCache\(\)/);
  assert.match(adminSkeleton, /aria-busy="true"/);
  assert.match(adminLoading, /<AdminDashboardSkeleton \/>/);
  assert.match(siteLoading, /<MediaGallerySkeleton \/>/);
  assert.match(layout, /@fontsource\/kanit\/400\.css/);
  assert.match(packageJson, /@fontsource\/kanit/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /font-family: "Kanit"/);
  assert.match(css, /\.site-header[\s\S]*?position: sticky/);
  assert.match(css, /\.gallery-refresh/);
  assert.match(css, /\.skeleton-status-banner/);
  assert.match(css, /\.admin-system-skeleton/);
  assert.match(css, /\.media-library-panel/);
  assert.match(css, /@keyframes skeleton/);
  assert.match(css, /\.admin-edit-modal/);
  assert.match(css, /\.developer-page/);
  assert.match(publicMediaApi, /access-control-allow-origin/);
  assert.match(publicMediaApi, /s-maxage=300/);
  assert.match(publicMediaApi, /revalidate: 300/);
  assert.match(publicMediaApi, /MAX_PAGE_SIZE = 100/);
  assert.match(publicMediaApi, /item\.status === "published"/);
  assert.match(publicMediaListRoute, /parsePublicMediaQuery/);
  assert.match(publicMediaListRoute, /pagination/);
  assert.match(publicMediaDetailRoute, /MEDIA_NOT_FOUND/);
  assert.match(developerPage, /โดยไม่ต้องใช้ API Key/);
  assert.match(appsScript, /MEDIA_HISTORY_SHEET_NAME = "media_edit_logs"/);
  assert.match(appsScript, /SITE_STATS_SHEET_NAME = "site_stats"/);
  assert.match(appsScript, /function updateMedia_/);
  assert.match(appsScript, /function trackVisitorView_/);
  assert.equal(publicAppsScript, appsScript);
  assert.doesNotThrow(() => new vm.Script(appsScript), "Google Apps Script must be valid JavaScript syntax");

  await Promise.all([
    access(new URL("../app/icon.png", import.meta.url)),
    access(new URL("../app/apple-icon.png", import.meta.url)),
    access(new URL("../app/favicon.ico", import.meta.url)),
    access(new URL("../public/satun-risk-logo.png", import.meta.url)),
  ]);
});
