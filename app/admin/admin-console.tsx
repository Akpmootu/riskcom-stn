"use client";

import {
  AlertTriangle,
  Check,
  CloudUpload,
  Copy,
  Eye,
  FileImage,
  FileText,
  FolderCheck,
  HeartPulse,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { isManagerRole, type PortalUser } from "../auth-types";
import type { MediaItem, MediaResponse } from "../types";

type ConnectionStatus = {
  ok: boolean;
  connected: boolean;
  message?: string;
  folderName?: string;
  sheetName?: string;
};

export function AdminConsole({ currentUser }: { currentUser: PortalUser }) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [source, setSource] = useState<MediaResponse["source"]>("demo");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([checkConnection(), loadItems()]);
    // Initial portal data is intentionally loaded once for the authenticated user.
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function loadItems() {
    const response = await fetch("/api/media", { cache: "no-store" });
    const result = (await response.json()) as MediaResponse;
    setItems(result.items);
    setSource(result.source);
  }

  async function checkConnection() {
    setChecking(true);
    try {
      const response = await fetch("/api/admin/status", {
        cache: "no-store",
      });
      const result = (await response.json()) as ConnectionStatus & { error?: string };
      if (!response.ok) throw new Error(result.error || "ตรวจสอบการเชื่อมต่อไม่สำเร็จ");
      setStatus(result);
    } catch (error) {
      setStatus({
        ok: false,
        connected: false,
        message:
          error instanceof Error
            ? error.message
            : "ตรวจสอบการเชื่อมต่อไม่สำเร็จ",
      });
    } finally {
      setChecking(false);
    }
  }

  function chooseFile(nextFile: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(nextFile?.type.startsWith("image/") ? URL.createObjectURL(nextFile) : "");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !status?.connected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("file", file);
    setUploading(true);
    setFormMessage(null);
    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: data,
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "บันทึกสื่อไม่สำเร็จ");
      form.reset();
      chooseFile(null);
      setFormMessage({ type: "success", text: "บันทึกไฟล์ใน Google Drive และเพิ่มข้อมูลใน Google Sheets แล้ว" });
      await loadItems();
    } catch (error) {
      setFormMessage({ type: "error", text: error instanceof Error ? error.message : "บันทึกสื่อไม่สำเร็จ" });
    } finally {
      setUploading(false);
    }
  }

  async function deleteItem(item: MediaItem) {
    if (!status?.connected || !window.confirm(`ย้าย “${item.title}” ไปถังขยะหรือไม่`)) return;
    const response = await fetch("/api/admin/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    const result = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) {
      setFormMessage({ type: "error", text: result.error || "ลบสื่อไม่สำเร็จ" });
      return;
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  async function copySecretHint() {
    await navigator.clipboard.writeText("สร้างข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร แล้วใช้ค่าเดียวกันทั้งสองฝั่ง");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="container admin-nav">
          <Link className="brand" href="/">
            <span className="brand-mark"><HeartPulse size={24} /></span>
            <span><strong>ระบบจัดการสื่อ</strong><small>สำนักงานสาธารณสุขจังหวัดสตูล</small></span>
          </Link>
          <div className="admin-nav-actions">
            <Link href="/admin/profile">โปรไฟล์ของฉัน</Link>
            {isManagerRole(currentUser.role) && (
              <Link href="/admin/users">จัดการสมาชิก</Link>
            )}
            <a href="/" target="_blank"><Eye size={17} /> ดูหน้าเว็บไซต์</a>
            <button type="button" onClick={() => void signOut({ callbackUrl: "/" })}>
              <LogOut size={17} /> ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <div className="container admin-content">
        <section className="admin-title-row">
          <div>
            <span className="section-kicker">CONTENT MANAGEMENT</span>
            <h1>จัดการคลังสื่อ</h1>
            <p>{currentUser.firstName} {currentUser.lastName} • {currentUser.position} • อัปโหลดข้อมูลไปยังบัญชี Google ของหน่วยงาน</p>
          </div>
          <button className="refresh-button" type="button" onClick={() => void checkConnection()} disabled={checking}>
            <RefreshCw className={checking ? "spin" : ""} size={17} /> ตรวจสอบการเชื่อมต่อ
          </button>
        </section>

        <section className={status?.connected ? "connection-banner connected" : "connection-banner pending"}>
          <span className="connection-icon">{status?.connected ? <FolderCheck size={25} /> : <Link2 size={25} />}</span>
          <div>
            <strong>{status?.connected ? "เชื่อมต่อ Google พร้อมใช้งาน" : "กำลังตรวจสอบการเชื่อมต่อ Google"}</strong>
            <p>{status?.message || "โปรดรอสักครู่"}</p>
            {status?.connected && (
              <small>Drive: {status.folderName || "โฟลเดอร์สื่อ"} • Sheets: {status.sheetName || "ฐานข้อมูลสื่อ"}</small>
            )}
          </div>
          <span className="connection-state">{status?.connected ? <><Check size={15} /> พร้อมใช้งาน</> : "กำลังตรวจสอบ"}</span>
        </section>

        {status && !status.connected && (
          <section className="setup-panel">
            <div className="setup-heading">
              <span className="setup-number">3</span>
              <div><h2>ขั้นตอนเชื่อมต่อบัญชี Google ของคุณ</h2><p>ทำครั้งเดียว จากนั้นระบบจะสร้างโฟลเดอร์และชีตให้โดยอัตโนมัติ</p></div>
            </div>
            <div className="setup-steps">
              <article>
                <span>1</span>
                <div><strong>สร้าง Google Apps Script</strong><p>เปิด script.google.com สร้างโปรเจกต์ใหม่ และวางสคริปต์ที่เตรียมไว้</p></div>
                <a href="/google-apps-script.gs" download><FileText size={16} /> ดาวน์โหลดไฟล์ตั้งต้น</a>
              </article>
              <article>
                <span>2</span>
                <div><strong>กำหนดรหัสลับและเผยแพร่</strong><p>เปลี่ยน WEBHOOK_SECRET จากนั้น Deploy เป็น Web app ที่ทำงานด้วยบัญชีของคุณ</p></div>
                <button type="button" onClick={copySecretHint}><Copy size={16} /> {copied ? "คัดลอกแล้ว" : "คัดลอกคำแนะนำ"}</button>
              </article>
              <article>
                <span>3</span>
                <div><strong>นำ URL มาเชื่อมกับเว็บไซต์</strong><p>ส่ง Web app URL และรหัสลับให้ผู้ดูแลระบบเพิ่มในเว็บไซต์ แล้วกดตรวจสอบอีกครั้ง</p></div>
              </article>
            </div>
            <div className="setup-security"><ShieldCheck size={18} /> ไฟล์และข้อมูลทั้งหมดอยู่ใน Google Drive และ Google Sheets ของบัญชีที่เผยแพร่สคริปต์</div>
          </section>
        )}

        <div className="admin-grid">
          <section className="upload-panel">
            <div className="panel-heading">
              <div><span className="panel-icon"><CloudUpload size={21} /></span><span><h2>เพิ่มสื่อใหม่</h2><p>รองรับ JPG, PNG, WebP และ PDF ไม่เกิน 10 MB</p></span></div>
              {!status?.connected && <span className="locked-label"><LockKeyhole size={14} /> รอเชื่อมต่อ</span>}
            </div>
            <form onSubmit={handleUpload}>
              <fieldset disabled={!status?.connected || uploading}>
                <div
                  className={file ? "upload-dropzone has-file" : "upload-dropzone"}
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    chooseFile(event.dataTransfer.files[0] ?? null);
                  }}
                >
                  <input
                    ref={fileInput}
                    type="file"
                    name="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                  />
                  {file ? (
                    <>
                      {previewUrl ? <img src={previewUrl} alt="ตัวอย่างไฟล์ที่จะอัปโหลด" /> : <FileText size={34} />}
                      <div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB • คลิกเพื่อเปลี่ยนไฟล์</small></div>
                      <button type="button" aria-label="นำไฟล์ออก" onClick={(event) => { event.stopPropagation(); chooseFile(null); }}><X size={17} /></button>
                    </>
                  ) : (
                    <>
                      <span><Upload size={27} /></span>
                      <strong>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</strong>
                      <small>ใช้ภาพความละเอียดชัดเจนและไม่มีข้อมูลส่วนบุคคล</small>
                    </>
                  )}
                </div>

                <div className="form-grid">
                  <label className="field-wide">ชื่อสื่อ <em>*</em><input name="title" required placeholder="เช่น วิธีเตรียมตัวรับมือน้ำท่วมฉับพลัน" /></label>
                  <label>ช่วงเหตุการณ์ <em>*</em>
                    <select name="phase" defaultValue="before">
                      <option value="before">ก่อนเกิดเหตุ</option>
                      <option value="during">ระหว่างเกิดเหตุ</option>
                      <option value="after">หลังเกิดเหตุ</option>
                    </select>
                  </label>
                  <label>ประเภทเหตุการณ์ <em>*</em>
                    <select name="category" defaultValue="น้ำท่วม">
                      <option>น้ำท่วม</option><option>โรคติดต่อ</option><option>หมอกควัน</option>
                      <option>อุบัติเหตุ</option><option>ฟื้นฟูหลังเหตุ</option><option>อื่นๆ</option>
                    </select>
                  </label>
                  <label>วันที่เหตุการณ์ <em>*</em><input type="date" name="eventDate" required /></label>
                  <label>พื้นที่ <em>*</em><input name="location" required defaultValue="จังหวัดสตูล" /></label>
                  <label className="field-wide">คำอธิบาย <em>*</em><textarea name="description" rows={4} required placeholder="สรุปสาระสำคัญและกลุ่มเป้าหมายของสื่อ" /></label>
                  <label className="field-wide">คำบรรยายภาพเพื่อการเข้าถึง <em>*</em><input name="altText" required placeholder="อธิบายสิ่งที่อยู่ในภาพอย่างกระชับ" /></label>
                  <label className="field-wide">คำค้นหา <span>(คั่นด้วยเครื่องหมายจุลภาค)</span><input name="keywords" placeholder="น้ำท่วม, เตรียมพร้อม, ควนโดน" /></label>
                  <label>สถานะ
                    <select name="status" defaultValue="published"><option value="published">เผยแพร่ทันที</option><option value="draft">บันทึกเป็นฉบับร่าง</option></select>
                  </label>
                </div>
              </fieldset>
              {formMessage && <div className={`form-alert ${formMessage.type}`}><span>{formMessage.type === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}</span>{formMessage.text}</div>}
              <button className="admin-primary submit-media" type="submit" disabled={!status?.connected || !file || uploading}>
                {uploading ? <LoaderCircle className="spin" size={18} /> : <CloudUpload size={18} />}
                {uploading ? "กำลังบันทึกลง Google..." : "บันทึกและเผยแพร่สื่อ"}
              </button>
            </form>
          </section>

          <aside className="media-manager">
            <div className="panel-heading">
              <div><span className="panel-icon"><FileImage size={21} /></span><span><h2>สื่อล่าสุด</h2><p>{items.length} รายการในระบบ</p></span></div>
              {source === "demo" && <span className="demo-label">ข้อมูลตัวอย่าง</span>}
            </div>
            <div className="manager-list">
              {items.slice(0, 8).map((item) => (
                <article key={item.id}>
                  <span className={`manager-thumb thumb-${item.phase}`}>{item.fileType.includes("pdf") ? <FileText size={20} /> : <FileImage size={20} />}</span>
                  <div><strong>{item.title}</strong><small>{item.category} • {item.location}</small><em>{item.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}</em></div>
                  {isManagerRole(currentUser.role) && (
                    <button type="button" disabled={!status?.connected || source === "demo"} onClick={() => void deleteItem(item)} aria-label={`ลบ ${item.title}`}><Trash2 size={16} /></button>
                  )}
                </article>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
