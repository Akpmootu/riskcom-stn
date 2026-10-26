import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  Database,
  FileText,
  Home,
  Info,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "API สำหรับนักพัฒนา",
  description:
    "เอกสาร Public API สำหรับดึงภาพและข้อความจากคลังสื่อสารความเสี่ยง จังหวัดสตูล",
};

const queryParameters = [
  ["q", "คำค้นจากชื่อ คำอธิบาย พื้นที่ หมวดหมู่ และคำสำคัญ", "น้ำท่วม"],
  ["phase", "ช่วงเหตุการณ์: before, during หรือ after", "before"],
  ["category", "ชื่อหมวดหมู่แบบตรงตัว", "โรคติดต่อ"],
  ["from / to", "ช่วงวันที่เหตุการณ์ รูปแบบ YYYY-MM-DD", "2026-01-01"],
  ["sort", "newest, oldest, updated หรือ popular", "popular"],
  ["page", "หน้าที่ต้องการ เริ่มจาก 1", "1"],
  ["limit", "จำนวนต่อหน้า ค่าเริ่มต้น 20 สูงสุด 100", "20"],
];

const responseExample = `{
  "apiVersion": "1.1",
  "data": [
    {
      "id": "satun-flood-01",
      "title": "เฝ้าระวังน้ำท่วมฉับพลัน",
      "description": "ข้อความสื่อสารสำหรับประชาชน",
      "phase": "before",
      "categories": ["น้ำท่วม", "โรคติดต่อ"],
      "tags": [{ "name": "น้ำท่วม", "color": "#0284c7", "backgroundColor": "#e0f2fe" }],
      "thumbnailUrl": "https://...",
      "downloadUrl": "https://...",
      "fileType": "image/jpeg",
      "images": [{ "id": "img-1", "downloadUrl": "https://..." }],
      "imageCount": 1,
      "viewCount": 128,
      "isRecommended": true,
      "recommendationRank": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}`;

export default function DevelopersPage() {
  const exampleOrigin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://riskcom-stn.vercel.app";

  return (
    <main className="developer-page site-shell">
      <header className="site-header">
        <div className="container nav-wrap">
          <Link className="brand" href="/">
            <span className="brand-mark">
              <img src="/satun-risk-logo.png" alt="" />
            </span>
            <span>
              <strong>Satun Risk Media API</strong>
              <small>สำนักงานสาธารณสุขจังหวัดสตูล</small>
            </span>
          </Link>
          <nav className="nav-links" aria-label="เมนูหลัก">
            <Link className="nav-item" href="/">
              <Home size={16} /> หน้าแรก
            </Link>
            <Link className="nav-item" href="/#phases">
              <ShieldCheck size={16} /> ข้อมูลสถานการณ์
            </Link>
            <Link className="nav-item" href="/#gallery">
              <FileText size={16} /> คลังสื่อ
            </Link>
            <Link className="nav-item" href="/#about">
              <Info size={16} /> เกี่ยวกับเรา
            </Link>
            <div className="nav-right-group">
              <Link className="admin-link" href="/admin">
                <UserRound size={15} /> สำหรับผู้ดูแลระบบ <ArrowRight size={15} />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <section className="developer-hero">
        <div className="container developer-hero-grid">
          <div>
            <span className="developer-kicker">
              <Braces size={17} /> PROTECTED API · VERSION 1.1
            </span>
            <h1>
              นำภาพและข้อความ
              <br />
              ไปใช้ต่อได้อย่างเป็นระบบ
            </h1>
            <p>
              REST API สำหรับเว็บไซต์ แอปพลิเคชัน และระบบของหน่วยงานที่ต้องการเข้าถึง
              สื่อซึ่งเผยแพร่แล้ว พร้อมสื่อแนะนำตามสถานการณ์และสถิติการรับชม โดยใช้ API Key
            </p>
            <div className="developer-status">
              <CheckCircle2 size={17} /> พร้อมใช้งาน · JSON · UTF-8 · CORS
            </div>
          </div>
          <div className="developer-endpoint-card">
            <span>Base endpoint</span>
            <code>GET /api/v1/media</code>
            <small>ส่งคีย์ผ่าน X-API-Key หรือ Authorization: Bearer</small>
          </div>
        </div>
      </section>

      <div className="container developer-layout">
        <aside className="developer-toc">
          <strong>สารบัญ</strong>
          <a href="#quickstart">เริ่มต้นใช้งาน</a>
          <a href="#endpoints">Endpoints</a>
          <a href="#parameters">Query parameters</a>
          <a href="#response">ตัวอย่างข้อมูล</a>
          <a href="#policy">นโยบายการใช้งาน</a>
        </aside>

        <article className="developer-content">
          <section id="quickstart" className="developer-section">
            <span className="developer-section-icon">
              <Braces size={20} />
            </span>
            <div>
              <h2>เริ่มต้นใช้งาน</h2>
              <p>
                ขอรับ API Key จากผู้ดูแลระบบ แล้วเก็บคีย์ไว้ฝั่งเซิร์ฟเวอร์ของผู้พัฒนา ห้ามฝังคีย์ไว้ใน JavaScript ที่ส่งให้เบราว์เซอร์
              </p>
              <div className="developer-code">
                <code>{`fetch("${exampleOrigin}/api/v1/media?phase=before&limit=10", {\n  headers: { "X-API-Key": process.env.SATUN_RISK_API_KEY }\n})\n  .then(response => response.json())\n  .then(result => console.log(result.data));`}</code>
              </div>
            </div>
          </section>

          <section id="endpoints" className="developer-section">
            <span className="developer-section-icon">
              <Database size={20} />
            </span>
            <div>
              <h2>Endpoints</h2>
              <div className="developer-endpoints">
                <div>
                  <span>GET</span>
                  <code>/api/v1/media</code>
                  <p>ดึงรายการ ค้นหา กรอง และแบ่งหน้า</p>
                </div>
                <div>
                  <span>GET</span>
                  <code>/api/v1/media/{`{id}`}</code>
                  <p>ดึงรายละเอียดสื่อหนึ่งรายการด้วย ID</p>
                </div>
                <div>
                  <span>GET</span>
                  <code>/api/v1/media/recommended</code>
                  <p>ดึงสถานการณ์ปัจจุบันและสื่อแนะนำที่ตรงกับสถานการณ์</p>
                </div>
                <div>
                  <span>POST</span>
                  <code>/api/v1/media/{`{id}`}/view</code>
                  <p>นับยอดดู โดยส่ง JSON ที่มี viewerToken ประจำผู้ชม</p>
                </div>
              </div>
            </div>
          </section>

          <section
            id="parameters"
            className="developer-section developer-section-block"
          >
            <div>
              <h2>Query parameters</h2>
              <div className="developer-table-wrap">
                <table className="developer-table">
                  <thead>
                    <tr>
                      <th>ชื่อ</th>
                      <th>รายละเอียด</th>
                      <th>ตัวอย่าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queryParameters.map(([name, detail, example]) => (
                      <tr key={name}>
                        <td><code>{name}</code></td>
                        <td>{detail}</td>
                        <td><code>{example}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section
            id="response"
            className="developer-section developer-section-block"
          >
            <div>
              <h2>ตัวอย่างข้อมูลตอบกลับ</h2>
              <p>
                สื่อหนึ่งหัวข้ออาจมีภาพเดียวหรือหลายภาพใน <code>images</code> แต่ละภาพมี URL ขนาดย่อและดาวน์โหลด พร้อมป้ายสีใน <code>tags</code> และยอดดูใน <code>viewCount</code>
              </p>
              <div className="developer-code developer-code-large">
                <pre>{responseExample}</pre>
              </div>
            </div>
          </section>

          <section id="policy" className="developer-note">
            <h2>นโยบายการใช้งาน</h2>
            <p>
              ระบบแคชแหล่งข้อมูลฝั่งเซิร์ฟเวอร์เพื่อลดภาระ Google Sheets และไม่แคชผลตอบกลับที่มี API Key แบบสาธารณะ กรุณาเก็บคีย์เป็นความลับ ใช้ URL จาก API โดยตรง ไม่แก้ไขเนื้อหาให้เกิดความเข้าใจผิด และแสดงที่มาว่า
              “สำนักงานสาธารณสุขจังหวัดสตูล”
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
