import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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

test("includes responsive media management, Kanit, system skeletons, and existing platform features", async () => {
  const [
    gallery,
    adminConsole,
    adminSkeleton,
    adminLoading,
    siteLoading,
    layout,
    css,
    packageJson,
    appsScript,
    publicAppsScript,
  ] = await Promise.all([
    readFile(new URL("../app/media-gallery.tsx", import.meta.url), "utf8"),
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
  ]);

  assert.match(gallery, /className="mobile-bottom-nav"/);
  assert.match(gallery, /className="fullscreen-viewer"/);
  assert.match(gallery, /if \(loading\) return <MediaGallerySkeleton \/>/);
  assert.match(gallery, /skeleton-visitor-count/);
  assert.match(gallery, /\/api\/analytics\/view/);
  assert.match(adminConsole, /\/api\/admin\/media/);
  assert.match(adminConsole, /\/api\/admin\/history/);
  assert.match(adminConsole, /คลังสื่อทั้งหมด/);
  assert.match(adminConsole, /MEDIA_PAGE_SIZE = 8/);
  assert.match(adminConsole, /อัปโหลดล่าสุดก่อน/);
  assert.match(adminConsole, /เดือนย้อนหลัง/);
  assert.match(adminConsole, /if \(hydrating\) return <AdminDashboardSkeleton \/>/);
  assert.match(adminSkeleton, /aria-busy="true"/);
  assert.match(adminLoading, /<AdminDashboardSkeleton \/>/);
  assert.match(siteLoading, /<MediaGallerySkeleton \/>/);
  assert.match(layout, /@fontsource\/kanit\/400\.css/);
  assert.match(packageJson, /@fontsource\/kanit/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /font-family: "Kanit"/);
  assert.match(css, /\.skeleton-status-banner/);
  assert.match(css, /\.admin-system-skeleton/);
  assert.match(css, /\.media-library-panel/);
  assert.match(css, /@keyframes skeleton/);
  assert.match(css, /\.admin-edit-modal/);
  assert.match(appsScript, /MEDIA_HISTORY_SHEET_NAME = "media_edit_logs"/);
  assert.match(appsScript, /SITE_STATS_SHEET_NAME = "site_stats"/);
  assert.match(appsScript, /function updateMedia_/);
  assert.match(appsScript, /function trackVisitorView_/);
  assert.equal(publicAppsScript, appsScript);

  await Promise.all([
    access(new URL("../app/icon.png", import.meta.url)),
    access(new URL("../app/apple-icon.png", import.meta.url)),
    access(new URL("../app/favicon.ico", import.meta.url)),
    access(new URL("../public/satun-risk-logo.png", import.meta.url)),
  ]);
});
