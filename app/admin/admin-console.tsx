"use client";

import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Copy,
  Eye,
  FileImage,
  FileText,
  FolderCheck,
  History,
  Link2,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { isManagerRole, type PortalUser } from "../auth-types";
import { clearMediaCache } from "../media-cache";
import type { MediaItem, MediaResponse, MediaRevision } from "../types";
import { AdminDashboardSkeleton } from "./admin-skeleton";

type ConnectionStatus = {
  ok: boolean;
  connected: boolean;
  message?: string;
  folderName?: string;
  sheetName?: string;
};

type MediaSort = "created-desc" | "created-asc" | "event-desc" | "event-asc" | "title";
type MediaStatusFilter = "all" | MediaItem["status"];
type MediaPhaseFilter = "all" | MediaItem["phase"];

const MEDIA_PAGE_SIZE = 8;

const phaseLabels: Record<MediaItem["phase"], string> = {
  before: "ก่อนเกิดเหตุ",
  during: "ระหว่างเกิดเหตุ",
  after: "หลังเกิดเหตุ",
};

const changedFieldLabels: Record<string, string> = {
  title: "ชื่อสื่อ",
  description: "คำอธิบาย",
  phase: "ช่วงเหตุการณ์",
  category: "ประเภทเหตุการณ์",
  eventDate: "วันที่เหตุการณ์",
  location: "พื้นที่",
  keywords: "คำค้นหา",
  altText: "คำบรรยายภาพ",
  status: "สถานะ",
};

function formatThaiDateTime(value: string) {
  if (!value) return "ไม่ระบุเวลา";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function formatThaiDate(value: string) {
  if (!value) return "ไม่ระบุวันที่";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00+07:00`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function dateTimestamp(value: string | undefined) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function monthKey(value: string | undefined) {
  if (!value) return "";
  const direct = value.match(/^(\d{4}-\d{2})/);
  if (direct) return direct[1];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

const DEFAULT_CATEGORIES = [
  "น้ำท่วม",
  "โรคติดต่อ",
  "หมอกควัน",
  "อุบัติเหตุ",
  "ฟื้นฟูหลังเหตุ",
  "อื่นๆ",
];

export function AdminConsole({ currentUser }: { currentUser: PortalUser }) {
  const [activeTab, setActiveTab] = useState<"library" | "settings">("library");
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [source, setSource] = useState<MediaResponse["source"]>("demo");
  const [hydrating, setHydrating] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsLoadError, setItemsLoadError] = useState("");
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaStatus, setMediaStatus] = useState<MediaStatusFilter>("all");
  const [mediaPhase, setMediaPhase] = useState<MediaPhaseFilter>("all");
  const [mediaCategory, setMediaCategory] = useState("all");
  const [mediaMonth, setMediaMonth] = useState("all");
  const [mediaSort, setMediaSort] = useState<MediaSort>("created-desc");
  const [mediaPage, setMediaPage] = useState(1);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [historyItem, setHistoryItem] = useState<MediaItem | null>(null);
  const [historyEntries, setHistoryEntries] = useState<MediaRevision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // System Categories state for Basic Settings management
  const [systemCategories, setSystemCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.allSettled([checkConnection(), loadItems(), loadCategories()]).finally(() => {
      setHydrating(false);
    });
    // Initial portal data is intentionally loaded once for the authenticated user.
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function loadCategories() {
    try {
      const response = await fetch("/api/admin/categories");
      if (response.ok) {
        const result = (await response.json()) as { categories?: string[] };
        if (Array.isArray(result.categories)) {
          setSystemCategories(result.categories);
        }
      }
    } catch {
      // Fallback gracefully
    }
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    setAddingCategory(true);
    setCategoryMessage(null);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = (await response.json()) as { ok?: boolean; categories?: string[]; error?: string };
      if (!response.ok || !result.ok || !Array.isArray(result.categories)) {
        throw new Error(result.error || "เพิ่มประเภทเหตุการณ์ไม่สำเร็จ");
      }
      setSystemCategories(result.categories);
      setNewCategoryName("");
      setCategoryMessage({ type: "success", text: `เพิ่มประเภท “${name}” สำเร็จ` });
    } catch (error) {
      setCategoryMessage({
        type: "error",
        text: error instanceof Error ? error.message : "เพิ่มประเภทเหตุการณ์ไม่สำเร็จ",
      });
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleDeleteCategory(categoryName: string) {
    if (DEFAULT_CATEGORIES.includes(categoryName)) {
      alert("ไม่สามารถลบประเภทเหตุการณ์มาตรฐานของระบบได้");
      return;
    }
    if (!window.confirm(`ต้องการลบประเภทเหตุการณ์ “${categoryName}” หรือไม่`)) return;
    try {
      const response = await fetch(
        `/api/admin/categories?name=${encodeURIComponent(categoryName)}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { ok?: boolean; categories?: string[]; error?: string };
      if (!response.ok || !result.ok || !Array.isArray(result.categories)) {
        throw new Error(result.error || "ลบประเภทเหตุการณ์ไม่สำเร็จ");
      }
      setSystemCategories(result.categories);
      setCategoryMessage({ type: "success", text: `ลบประเภท “${categoryName}” สำเร็จ` });
    } catch (error) {
      setCategoryMessage({
        type: "error",
        text: error instanceof Error ? error.message : "ลบประเภทเหตุการณ์ไม่สำเร็จ",
      });
    }
  }

  const categories = useMemo(() => {
    const itemCats = items.map((item) => item.category).filter(Boolean);
    return Array.from(new Set([...systemCategories, ...itemCats])).sort((left, right) =>
      left.localeCompare(right, "th"),
    );
  }, [items, systemCategories]);

  const monthOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .flatMap((item) => [monthKey(item.eventDate), monthKey(item.createdAt)])
            .filter(Boolean),
        ),
      ).sort((left, right) => right.localeCompare(left)),
    [items],
  );

  const filteredItems = useMemo(() => {
    const needle = mediaQuery.trim().toLocaleLowerCase("th");
    const filtered = items.filter((item) => {
      const matchesQuery =
        !needle ||
        [
          item.title,
          item.description,
          item.category,
          item.location,
          item.fileName,
          item.uploadedBy,
          ...item.keywords,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("th")
          .includes(needle);
      const matchesStatus = mediaStatus === "all" || item.status === mediaStatus;
      const matchesPhase = mediaPhase === "all" || item.phase === mediaPhase;
      const matchesCategory = mediaCategory === "all" || item.category === mediaCategory;
      const matchesMonth =
        mediaMonth === "all" ||
        monthKey(item.eventDate) === mediaMonth ||
        monthKey(item.createdAt) === mediaMonth;
      return matchesQuery && matchesStatus && matchesPhase && matchesCategory && matchesMonth;
    });

    return filtered.sort((left, right) => {
      if (mediaSort === "created-asc") {
        return dateTimestamp(left.createdAt) - dateTimestamp(right.createdAt);
      }
      if (mediaSort === "event-desc") {
        return dateTimestamp(right.eventDate) - dateTimestamp(left.eventDate);
      }
      if (mediaSort === "event-asc") {
        return dateTimestamp(left.eventDate) - dateTimestamp(right.eventDate);
      }
      if (mediaSort === "title") {
        return left.title.localeCompare(right.title, "th");
      }
      return dateTimestamp(right.createdAt) - dateTimestamp(left.createdAt);
    });
  }, [items, mediaCategory, mediaMonth, mediaPhase, mediaQuery, mediaSort, mediaStatus]);

  const mediaPageCount = Math.max(1, Math.ceil(filteredItems.length / MEDIA_PAGE_SIZE));
  const activeMediaPage = Math.min(mediaPage, mediaPageCount);
  const visibleMediaItems = filteredItems.slice(
    (activeMediaPage - 1) * MEDIA_PAGE_SIZE,
    activeMediaPage * MEDIA_PAGE_SIZE,
  );
  const hasActiveMediaFilters =
    Boolean(mediaQuery) ||
    mediaStatus !== "all" ||
    mediaPhase !== "all" ||
    mediaCategory !== "all" ||
    mediaMonth !== "all";
  const currentMonth = monthKey(new Date().toISOString());
  const mediaStats = {
    total: items.length,
    published: items.filter((item) => item.status === "published").length,
    drafts: items.filter((item) => item.status === "draft").length,
    thisMonth: items.filter((item) => monthKey(item.createdAt) === currentMonth).length,
  };

  async function loadItems() {
    setItemsLoading(true);
    setItemsLoadError("");
    try {
      const response = await fetch("/api/admin/media", { cache: "no-store" });
      const result = (await response.json()) as MediaResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "โหลดรายการสื่อไม่สำเร็จ");
      }
      setItems(result.items);
      setSource(result.source);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "โหลดรายการสื่อไม่สำเร็จ";
      setItemsLoadError(message);
      throw error;
    } finally {
      setItemsLoading(false);
    }
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
      clearMediaCache();
      setFormMessage({ type: "success", text: "บันทึกไฟล์ใน Google Drive และเพิ่มข้อมูลใน Google Sheets แล้ว" });
      await loadItems();
      setMediaSort("created-desc");
      setMediaPage(1);
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
    clearMediaCache();
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !status?.connected) return;
    const data = new FormData(event.currentTarget);
    setSavingEdit(true);
    setFormMessage(null);
    try {
      const response = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          title: String(data.get("title") || ""),
          description: String(data.get("description") || ""),
          phase: String(data.get("phase") || "before"),
          category: String(data.get("category") || ""),
          eventDate: String(data.get("eventDate") || ""),
          location: String(data.get("location") || ""),
          keywords: String(data.get("keywords") || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          altText: String(data.get("altText") || ""),
          status: String(data.get("status") || "published"),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        item?: MediaItem;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.item) {
        throw new Error(result.error || "แก้ไขข้อมูลสื่อไม่สำเร็จ");
      }
      setItems((current) =>
        current.map((item) =>
          item.id === result.item?.id ? result.item : item,
        ),
      );
      clearMediaCache();
      setEditing(null);
      setFormMessage({
        type: "success",
        text: "บันทึกข้อมูลและประวัติการแก้ไขเรียบร้อยแล้ว",
      });
    } catch (error) {
      setFormMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "แก้ไขข้อมูลสื่อไม่สำเร็จ",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function openHistory(item: MediaItem) {
    setHistoryItem(item);
    setHistoryEntries([]);
    setHistoryLoading(true);
    try {
      const response = await fetch(
        `/api/admin/history?mediaId=${encodeURIComponent(item.id)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        history?: MediaRevision[];
        error?: string;
      };
      if (!response.ok || !Array.isArray(result.history)) {
        throw new Error(result.error || "โหลดประวัติการแก้ไขไม่สำเร็จ");
      }
      setHistoryEntries(result.history);
    } catch (error) {
      setFormMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "โหลดประวัติการแก้ไขไม่สำเร็จ",
      });
      setHistoryItem(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function copySecretHint() {
    await navigator.clipboard.writeText("สร้างข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร แล้วใช้ค่าเดียวกันทั้งสองฝั่ง");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function resetMediaFilters() {
    setMediaQuery("");
    setMediaStatus("all");
    setMediaPhase("all");
    setMediaCategory("all");
    setMediaMonth("all");
    setMediaSort("created-desc");
    setMediaPage(1);
  }

  function toggleUploadForm() {
    setShowUploadForm((current) => {
      const next = !current;
      if (!current) {
        window.setTimeout(() => {
          document.getElementById("upload-media")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 40);
      }
      return next;
    });
  }

  if (hydrating) return <AdminDashboardSkeleton />;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="container admin-nav">
          <Link className="brand" href="/">
            <span className="brand-mark">
              <img src="/satun-risk-logo.png" alt="" aria-hidden="true" />
            </span>
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
          <div className="admin-title-actions">
            <button className="refresh-button" type="button" onClick={() => void checkConnection()} disabled={checking}>
              <RefreshCw className={checking ? "spin" : ""} size={17} /> ตรวจสอบการเชื่อมต่อ
            </button>
            <button
              className="admin-add-media"
              type="button"
              onClick={toggleUploadForm}
              disabled={!status?.connected}
              aria-expanded={showUploadForm}
              aria-controls="upload-media"
            >
              {showUploadForm ? <X size={17} /> : <Plus size={17} />}
              {showUploadForm ? "ปิดฟอร์ม" : "เพิ่มสื่อใหม่"}
            </button>
          </div>
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

        <section className="media-overview" aria-label="สรุปคลังสื่อ">
          <article>
            <span className="overview-icon total"><FileImage size={20} /></span>
            <div><small>สื่อทั้งหมด</small><strong>{mediaStats.total}</strong><em>รายการในระบบ</em></div>
          </article>
          <article>
            <span className="overview-icon published"><Eye size={20} /></span>
            <div><small>เผยแพร่แล้ว</small><strong>{mediaStats.published}</strong><em>ประชาชนมองเห็น</em></div>
          </article>
          <article>
            <span className="overview-icon draft"><FileText size={20} /></span>
            <div><small>ฉบับร่าง</small><strong>{mediaStats.drafts}</strong><em>รอตรวจสอบ</em></div>
          </article>
          <article>
            <span className="overview-icon monthly"><CalendarDays size={20} /></span>
            <div><small>เพิ่มเดือนนี้</small><strong>{mediaStats.thisMonth}</strong><em>{formatMonthLabel(currentMonth)}</em></div>
          </article>
        </section>

        <nav className="admin-tab-nav" aria-label="เมนูระบบบริหารจัดการ">
          <button
            type="button"
            className={activeTab === "library" ? "admin-tab-button is-active" : "admin-tab-button"}
            onClick={() => setActiveTab("library")}
          >
            <FileImage size={18} />
            <span>คลังสื่อทั้งหมด</span>
            <span className="tab-badge">{items.length}</span>
          </button>
          <button
            type="button"
            className={activeTab === "settings" ? "admin-tab-button is-active" : "admin-tab-button"}
            onClick={() => setActiveTab("settings")}
          >
            <ShieldCheck size={18} />
            <span>จัดการข้อมูลพื้นฐาน</span>
            <span className="tab-badge">{categories.length} ประเภท</span>
          </button>
        </nav>

        {activeTab === "library" ? (
          <section className="media-library-panel" aria-labelledby="media-library-title">
            <div className="library-heading">
              <div className="panel-heading-main">
                <span className="panel-icon"><FileImage size={21} /></span>
                <span>
                  <h2 id="media-library-title">คลังสื่อทั้งหมด</h2>
                  <p>ค้นหา ย้อนดู แก้ไข และติดตามประวัติสื่อได้จากที่เดียว</p>
                </span>
              </div>
              <div className="library-heading-actions">
                {source === "demo" && <span className="demo-label">ข้อมูลตัวอย่าง</span>}
                <button type="button" onClick={() => void loadItems()} disabled={itemsLoading}>
                  <RefreshCw className={itemsLoading ? "spin" : ""} size={16} /> โหลดข้อมูลใหม่
                </button>
              </div>
            </div>

            {formMessage && !showUploadForm && (
              <div className={`form-alert ${formMessage.type}`} role="status">
                {formMessage.type === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}
                {formMessage.text}
              </div>
            )}

            <div className="library-toolbar">
              <label className="library-search">
                <Search size={18} />
                <span className="sr-only">ค้นหาสื่อ</span>
                <input
                  value={mediaQuery}
                  onChange={(event) => {
                    setMediaQuery(event.target.value);
                    setMediaPage(1);
                  }}
                  placeholder="ค้นหาชื่อสื่อ พื้นที่ ประเภท คำค้น หรือผู้อัปโหลด"
                />
                {mediaQuery && (
                  <button type="button" onClick={() => { setMediaQuery(""); setMediaPage(1); }} aria-label="ล้างคำค้น">
                    <X size={16} />
                  </button>
                )}
              </label>
              <div className="library-filter-grid">
                <label>
                  <span>สถานะ</span>
                  <select value={mediaStatus} onChange={(event) => { setMediaStatus(event.target.value as MediaStatusFilter); setMediaPage(1); }}>
                    <option value="all">ทุกสถานะ</option>
                    <option value="published">เผยแพร่แล้ว</option>
                    <option value="draft">ฉบับร่าง</option>
                  </select>
                </label>
                <label>
                  <span>ช่วงเหตุการณ์</span>
                  <select value={mediaPhase} onChange={(event) => { setMediaPhase(event.target.value as MediaPhaseFilter); setMediaPage(1); }}>
                    <option value="all">ทุกช่วง</option>
                    <option value="before">ก่อนเกิดเหตุ</option>
                    <option value="during">ระหว่างเกิดเหตุ</option>
                    <option value="after">หลังเกิดเหตุ</option>
                  </select>
                </label>
                <label>
                  <span>ประเภท</span>
                  <select value={mediaCategory} onChange={(event) => { setMediaCategory(event.target.value); setMediaPage(1); }}>
                    <option value="all">ทุกประเภท</option>
                    {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span>เดือนย้อนหลัง</span>
                  <select value={mediaMonth} onChange={(event) => { setMediaMonth(event.target.value); setMediaPage(1); }}>
                    <option value="all">ทุกเดือน</option>
                    {monthOptions.map((item) => <option key={item} value={item}>{formatMonthLabel(item)}</option>)}
                  </select>
                </label>
                <label>
                  <span>เรียงลำดับ</span>
                  <select value={mediaSort} onChange={(event) => { setMediaSort(event.target.value as MediaSort); setMediaPage(1); }}>
                    <option value="created-desc">อัปโหลดล่าสุดก่อน</option>
                    <option value="created-asc">อัปโหลดเก่าสุดก่อน</option>
                    <option value="event-desc">เหตุการณ์ล่าสุดก่อน</option>
                    <option value="event-asc">เหตุการณ์เก่าสุดก่อน</option>
                    <option value="title">ชื่อ ก-ฮ</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="library-result-row">
              <p>
                แสดง <strong>{filteredItems.length}</strong> จาก {items.length} รายการ
                {mediaPageCount > 1 && <> • หน้า {activeMediaPage} จาก {mediaPageCount}</>}
              </p>
              {hasActiveMediaFilters && (
                <button type="button" onClick={resetMediaFilters}><RotateCcw size={15} /> ล้างตัวกรอง</button>
              )}
            </div>

            {itemsLoading ? (
              <div className="media-library-list library-inline-skeleton" aria-label="กำลังโหลดรายการสื่อ">
                {[0, 1, 2, 3].map((item) => (
                  <article className="media-library-item" key={item}>
                    <span className="skeleton-block library-skeleton-thumb" />
                    <div className="library-skeleton-copy"><span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" /></div>
                    <span className="skeleton-block library-skeleton-date" />
                    <div className="library-skeleton-actions"><span className="skeleton-block" /><span className="skeleton-block" /></div>
                  </article>
                ))}
              </div>
            ) : itemsLoadError ? (
              <div className="library-empty error">
                <AlertTriangle size={25} />
                <h3>โหลดคลังสื่อไม่สำเร็จ</h3>
                <p>{itemsLoadError}</p>
                <button type="button" onClick={() => void loadItems()}><RefreshCw size={16} /> ลองอีกครั้ง</button>
              </div>
            ) : visibleMediaItems.length ? (
              <div className="media-library-list">
                {visibleMediaItems.map((item) => (
                  <article className="media-library-item" key={item.id}>
                    <div className={`library-thumbnail thumb-${item.phase}`}>
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" aria-hidden="true" />
                      ) : item.fileType.includes("pdf") ? (
                        <FileText size={24} />
                      ) : (
                        <FileImage size={24} />
                      )}
                      <span>{item.fileType.includes("pdf") ? "PDF" : "ภาพ"}</span>
                    </div>
                    <div className="library-item-main">
                      <div className="library-item-title-row">
                        <h3>{item.title}</h3>
                        <span className={`library-status ${item.status}`}>
                          {item.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                        </span>
                      </div>
                      <p>{item.category} • {phaseLabels[item.phase]} • {item.location}</p>
                      <div className="library-item-meta">
                        <span><CalendarDays size={13} /> เหตุการณ์ {formatThaiDate(item.eventDate)}</span>
                        {item.uploadedBy && <span>โดย {item.uploadedBy}</span>}
                        {item.revisionCount ? <span>แก้ไข {item.revisionCount} ครั้ง</span> : null}
                      </div>
                    </div>
                    <div className="library-created-date">
                      <small>อัปโหลดเมื่อ</small>
                      <strong>{formatThaiDateTime(item.createdAt)}</strong>
                    </div>
                    <div className="manager-actions library-actions">
                      <button type="button" disabled={!status?.connected || source === "demo"} onClick={() => setEditing(item)} aria-label={`แก้ไข ${item.title}`} title="แก้ไขข้อมูล"><Pencil size={15} /><span>แก้ไข</span></button>
                      <button type="button" disabled={!status?.connected || source === "demo"} onClick={() => void openHistory(item)} aria-label={`ดูประวัติ ${item.title}`} title="ประวัติการแก้ไข"><History size={15} /><span>ประวัติ</span></button>
                      {isManagerRole(currentUser.role) && (
                        <button className="delete-action" type="button" disabled={!status?.connected || source === "demo"} onClick={() => void deleteItem(item)} aria-label={`ลบ ${item.title}`} title="ลบรายการ"><Trash2 size={15} /><span>ลบ</span></button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="library-empty">
                <Search size={27} />
                <h3>ไม่พบสื่อที่ตรงกับเงื่อนไข</h3>
                <p>ลองเปลี่ยนคำค้น เดือน หรือประเภทเหตุการณ์</p>
                {hasActiveMediaFilters && <button type="button" onClick={resetMediaFilters}><RotateCcw size={16} /> ดูสื่อทั้งหมด</button>}
              </div>
            )}

            {filteredItems.length > MEDIA_PAGE_SIZE && (
              <nav className="library-pagination" aria-label="หน้ารายการสื่อ">
                <button type="button" onClick={() => setMediaPage((current) => Math.max(1, current - 1))} disabled={activeMediaPage === 1}>
                  <ChevronLeft size={17} /> ก่อนหน้า
                </button>
                <span>หน้า <strong>{activeMediaPage}</strong> / {mediaPageCount}</span>
                <button type="button" onClick={() => setMediaPage((current) => Math.min(mediaPageCount, current + 1))} disabled={activeMediaPage === mediaPageCount}>
                  ถัดไป <ChevronRight size={17} />
                </button>
              </nav>
            )}
          </section>
        ) : (
          <section className="basic-settings-panel" aria-label="จัดการข้อมูลพื้นฐาน">
            <div className="panel-heading">
              <div className="panel-heading-main">
                <span className="panel-icon"><ShieldCheck size={22} /></span>
                <span>
                  <h2>จัดการข้อมูลพื้นฐานและการตั้งค่าระบบ</h2>
                  <p>กำหนดประเภทเหตุการณ์ ข้อมูลระบบ และตรวจสอบสถานะระบบก่อนใช้งาน</p>
                </span>
              </div>
            </div>

            <div className="basic-settings-grid">
              <article className="settings-card">
                <div className="settings-card-head">
                  <span className="card-icon"><Plus size={20} /></span>
                  <div>
                    <h3>จัดการประเภทเหตุการณ์</h3>
                    <p>เพิ่มประเภทเหตุการณ์ใหม่เพื่อนำไปใช้ในฟอร์มสื่อและตัวกรอง</p>
                  </div>
                </div>

                <form onSubmit={handleAddCategory} className="add-category-form">
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="เช่น วาตภัย, ดินโคลนถล่ม, ภัยแล้ง"
                    disabled={addingCategory}
                  />
                  <button type="submit" disabled={addingCategory || !newCategoryName.trim()}>
                    {addingCategory ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
                    เพิ่มประเภท
                  </button>
                </form>

                {categoryMessage && (
                  <div className={`form-alert ${categoryMessage.type}`} style={{ marginTop: 12 }}>
                    {categoryMessage.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
                    {categoryMessage.text}
                  </div>
                )}

                <div className="category-tags-list">
                  {categories.map((cat) => {
                    const isDefault = DEFAULT_CATEGORIES.includes(cat);
                    const count = items.filter((item) => item.category === cat).length;
                    return (
                      <span key={cat} className={isDefault ? "category-tag-chip is-default" : "category-tag-chip"}>
                        <span>{cat}</span>
                        <small style={{ opacity: 0.75, fontSize: "12px" }}>({count})</small>
                        {!isDefault && (
                          <button
                            type="button"
                            className="chip-remove-btn"
                            onClick={() => void handleDeleteCategory(cat)}
                            title={`ลบ ${cat}`}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </article>

              <article className="settings-card">
                <div className="settings-card-head">
                  <span className="card-icon"><FolderCheck size={20} /></span>
                  <div>
                    <h3>สถานะระบบและ Google Integration</h3>
                    <p>พื้นที่เก็บข้อมูลสื่อและฐานข้อมูลของหน่วยงาน</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                  <div><strong>Google Drive Folder:</strong> {status?.folderName || "คลังสื่อสารความเสี่ยง สสจ.สตูล"}</div>
                  <div><strong>Google Sheet:</strong> {status?.sheetName || "ฐานข้อมูลคลังสื่อสารความเสี่ยง สสจ.สตูล"}</div>
                  <div><strong>สถานะการเชื่อมต่อ:</strong> {status?.connected ? "พร้อมใช้งาน ✅" : "กำลังตรวจสอบการเชื่อมต่อ ⚠️"}</div>
                </div>
              </article>
            </div>
          </section>
        )}

        {showUploadForm && (
          <section className="upload-panel admin-upload-panel" id="upload-media">
            <div className="panel-heading">
              <div><span className="panel-icon"><CloudUpload size={21} /></span><span><h2>เพิ่มสื่อใหม่</h2><p>รองรับ JPG, PNG, WebP และ PDF ไม่เกิน 10 MB</p></span></div>
              <button className="close-upload-panel" type="button" onClick={() => setShowUploadForm(false)}><X size={16} /> ปิดฟอร์ม</button>
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
                    <select name="category" defaultValue={categories[0] || "น้ำท่วม"}>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
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
        )}
      </div>

      {editing && (
        <div className="admin-modal-backdrop" onMouseDown={() => !savingEdit && setEditing(null)}>
          <section className="admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-media-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="panel-icon"><Pencil size={19} /></span>
                <span><h2 id="edit-media-title">แก้ไขข้อมูลสื่อ</h2><p>ระบบจะเก็บผู้แก้ไข เวลา และรายการข้อมูลที่เปลี่ยน</p></span>
              </div>
              <button type="button" onClick={() => setEditing(null)} disabled={savingEdit} aria-label="ปิดหน้าต่างแก้ไข"><X size={19} /></button>
            </header>
            <form onSubmit={handleEdit}>
              <div className="form-grid">
                <label className="field-wide">ชื่อสื่อ <em>*</em><input name="title" required defaultValue={editing.title} /></label>
                <label>ช่วงเหตุการณ์ <em>*</em>
                  <select name="phase" defaultValue={editing.phase}>
                    <option value="before">ก่อนเกิดเหตุ</option>
                    <option value="during">ระหว่างเกิดเหตุ</option>
                    <option value="after">หลังเกิดเหตุ</option>
                  </select>
                </label>
                <label>ประเภทเหตุการณ์ <em>*</em>
                  <select name="category" defaultValue={editing.category}>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
                <label>วันที่เหตุการณ์ <em>*</em><input type="date" name="eventDate" required defaultValue={editing.eventDate} /></label>
                <label>พื้นที่ <em>*</em><input name="location" required defaultValue={editing.location} /></label>
                <label className="field-wide">คำอธิบาย <em>*</em><textarea name="description" rows={4} required defaultValue={editing.description} /></label>
                <label className="field-wide">คำบรรยายภาพเพื่อการเข้าถึง <em>*</em><input name="altText" required defaultValue={editing.altText} /></label>
                <label className="field-wide">คำค้นหา <span>(คั่นด้วยเครื่องหมายจุลภาค)</span><input name="keywords" defaultValue={editing.keywords.join(", ")} /></label>
                <label>สถานะ
                  <select name="status" defaultValue={editing.status}>
                    <option value="published">เผยแพร่</option>
                    <option value="draft">ฉบับร่าง</option>
                  </select>
                </label>
              </div>
              <div className="admin-modal-actions">
                <button type="button" onClick={() => setEditing(null)} disabled={savingEdit}>ยกเลิก</button>
                <button className="admin-primary" type="submit" disabled={savingEdit}>
                  {savingEdit ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
                  {savingEdit ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {historyItem && (
        <div className="admin-modal-backdrop" onMouseDown={() => setHistoryItem(null)}>
          <section className="admin-history-modal" role="dialog" aria-modal="true" aria-labelledby="media-history-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="panel-icon"><History size={19} /></span>
                <span><h2 id="media-history-title">ประวัติการแก้ไข</h2><p>{historyItem.title}</p></span>
              </div>
              <button type="button" onClick={() => setHistoryItem(null)} aria-label="ปิดประวัติ"><X size={19} /></button>
            </header>
            <div className="history-list">
              {historyLoading ? (
                <div className="history-skeleton" role="status" aria-label="กำลังโหลดประวัติการแก้ไข">
                  {[0, 1, 2].map((item) => (
                    <article key={item}>
                      <span className="skeleton-block history-skeleton-dot" />
                      <div>
                        <span className="skeleton-block" />
                        <span className="skeleton-block" />
                        <span className="skeleton-block" />
                      </div>
                    </article>
                  ))}
                </div>
              ) : historyEntries.length ? (
                historyEntries.map((entry) => (
                  <article key={entry.id}>
                    <span className="history-dot" />
                    <div>
                      <strong>{formatThaiDateTime(entry.editedAt)}</strong>
                      <small>แก้ไขโดย {entry.editedBy || "ไม่ระบุผู้ใช้"}</small>
                      <div className="history-fields">
                        {entry.changedFields.map((field) => (
                          <span key={field}>{changedFieldLabels[field] || field}</span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="history-empty">ยังไม่มีประวัติการแก้ไขรายการนี้</div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
