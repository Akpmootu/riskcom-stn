# คลังสื่อสารความเสี่ยง จังหวัดสตูล

เว็บไซต์รวบรวมและเผยแพร่สื่อความเสี่ยงของสำนักงานสาธารณสุขจังหวัดสตูล
รองรับการเผยแพร่บน Vercel ด้วย Next.js และบน OpenAI Sites ด้วย vinext

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
copy .env.example .env.local
npm run dev
npm run build
```

คำสั่งมาตรฐานด้านบนใช้ Next.js และสร้างโฟลเดอร์ `.next` สำหรับ Vercel

สำหรับ OpenAI Sites ใช้คำสั่งต่อไปนี้:

```bash
npm run dev:sites
npm run build:sites
```

## ระบบสมาชิกและการเข้าสู่ระบบ

- ผู้ใช้งานที่ได้รับอนุมัติเข้าสู่ระบบครั้งถัดไปด้วย Google/Gmail
- ผู้สมัครใหม่เริ่มลงทะเบียนผ่าน Google หรือ LINE ได้
- ผู้สมัครต้องระบุชื่อ นามสกุล ตำแหน่ง สถานที่ปฏิบัติงาน เบอร์โทร และ Gmail
- `akaporn1234@gmail.com` ถูกสร้างเป็น `super_admin` และอนุมัติอัตโนมัติ
- Super Admin อนุมัติหรือปฏิเสธสมาชิก และแต่งตั้งผู้ดูแลระบบได้
- ข้อมูลสมาชิกบันทึกในชีต `users` ภายใน Google Spreadsheet เดียวกับคลังสื่อ

ตั้งค่าตัวแปรใน `.env.local` ตาม `.env.example` โดยสร้าง `AUTH_SECRET`
เป็นค่าสุ่มที่คาดเดาได้ยาก และเก็บค่าลับทั้งหมดไว้นอก Git

Callback URL สำหรับ Production:

```text
Google: https://riskcom-stn.vercel.app/api/auth/callback/google
LINE:   https://riskcom-stn.vercel.app/api/auth/callback/line
```

เมื่อติดตั้งหรืออัปเดต Google Apps Script ให้ใช้ไฟล์
`integrations/google-apps-script/Code.gs` จากนั้นเรียก
`setupSatunRiskGallery()` หนึ่งครั้งเพื่อสร้างชีต `users`
และบัญชี Super Admin ก่อนเผยแพร่ Web app เวอร์ชันใหม่

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the Next.js build for Vercel
- `npm run build:sites`: verify the vinext build for OpenAI Sites
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
