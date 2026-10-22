"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Braces,
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
  Gauge,
  Globe,
  HeartPulse,
  History,
  Home,
  Images,
  Info,
  Link2,
  LoaderCircle,
  LogOut,
  MapPin,
  Maximize2,
  Menu,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { isManagerRole, type PortalUser } from "../auth-types";
import { FormattedDescription } from "../lib/text-formatting";
import {
  compressImageForWeb,
  formatFileSize,
  IMAGE_COMPRESSION_PROFILES,
  type ImageCompressionProfile,
  type ImageCompressionResult,
} from "../lib/image-compression";
import {
  buildTagConfigFromColor,
  type CategoryTagConfig,
  DEFAULT_CATEGORY_CONFIGS,
  formatCategoriesField,
  getItemCategories,
  optimizeThumbnailUrl,
  parseCategories,
  readStoredTagConfigs,
  resolveTagConfig,
  TAG_COLOR_PRESETS,
  TAG_ICON_PRESETS,
  writeStoredTagConfigs,
} from "../lib/category-tags";
import {
  getMediaSlides,
  normalizeMediaItems,
} from "../lib/media-gallery-utils";
import {
  clearMediaCache,
  readAdminMediaCache,
  writeAdminMediaCache,
} from "../media-cache";
import {
  DEFAULT_WATCH_SITUATION,
  normalizeWatchSituation,
  readStoredWatchConfig,
  SEVERITY_META,
  selectWatchMediaItems,
  writeStoredWatchConfig,
  type WatchSeverity,
  type WatchSituationConfig,
} from "../lib/watch-situation";
import {
  EocFooterPanel,
  EmergencyHotlines,
  WatchSituationBanner,
} from "../components/public-safety";
import type {
  IncidentPhase,
  MediaItem,
  MediaResponse,
  MediaRevision,
  MediaSlide,
  VisitorStats,
} from "../types";
import { AdminDashboardSkeleton } from "./admin-skeleton";

type CaptionOption = {
  id: string;
  name: string;
  hook: string;
  title: string;
  caption: string;
  hashtags: string[];
};

type QueuedUploadFile = {
  id: string;
  file: File;
  previewUrl: string;
};

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

type AiSuggestionResponse = {
  ok?: boolean;
  error?: string;
  suggestion?: {
    title: string;
    phase: IncidentPhase;
    category: string;
    categories?: string[];
    description: string;
    altText: string;
    keywords: string[];
    location: string;
    extractedText?: string;
    captionOptions?: CaptionOption[];
    ocrEngine?: "aksonocr" | "typhoon-ocr" | "none";
  };
};

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

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function createCompressedImageDataUrl(file: File, maxDimension = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("ไม่พบข้อมูลรูปภาพ"));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

function formatFriendlyUploadError(rawError: unknown): string {
  const message = rawError instanceof Error ? rawError.message : String(rawError || "");
  if (
    message.toLowerCase().includes("service drive timed out") ||
    message.toLowerCase().includes("timed out")
  ) {
    return "ระบบ Google Drive ใช้เวลาตอบสนองนานเกินกำหนดชั่วคราว กรุณากดปุ่ม 'บันทึกและเผยแพร่สื่อ' อีกครั้ง (ระบบได้ปรับขนาดไฟล์ให้เหมาะสมแล้ว)";
  }
  return message || "บันทึกสื่อไม่สำเร็จ";
}

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

function buildPaginationPages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, Math.max(current + 1, 5));
  if (start > 2) pages.push("ellipsis");
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "settings" | "watch">("library");
  const [watchConfig, setWatchConfig] = useState<WatchSituationConfig>(DEFAULT_WATCH_SITUATION);
  const [watchDraft, setWatchDraft] = useState<WatchSituationConfig>(DEFAULT_WATCH_SITUATION);
  const [watchSaving, setWatchSaving] = useState(false);
  const [watchPreviewDevice, setWatchPreviewDevice] = useState<"desktop" | "mobile">("desktop");
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

  // Popup Upload Modal & AI Auto-Fill State (Supports Multiple Images)
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<QueuedUploadFile[]>([]);
  const [activeUploadSlide, setActiveUploadSlide] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<{
    type: "info" | "success" | "error";
    text: string;
  } | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadPhase, setUploadPhase] = useState<IncidentPhase>("before");
  const [uploadCategories, setUploadCategories] = useState<string[]>(["น้ำท่วม"]);
  const [inlineNewTag, setInlineNewTag] = useState("");
  const [inlineNewTagColor, setInlineNewTagColor] = useState(TAG_COLOR_PRESETS[0].color);
  const [uploadEventDate, setUploadEventDate] = useState(todayIsoDate);
  const [uploadLocation, setUploadLocation] = useState("จังหวัดสตูล");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadAltText, setUploadAltText] = useState("");
  const [uploadKeywords, setUploadKeywords] = useState("");
  const [uploadStatus, setUploadStatus] = useState<MediaItem["status"]>("published");

  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAltText, setEditAltText] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editPhase, setEditPhase] = useState<IncidentPhase>("before");
  const [editCaptionOptions, setEditCaptionOptions] = useState<CaptionOption[]>([]);
  const [selectedCaptionIdx, setSelectedCaptionIdx] = useState<number | null>(null);
  const [reanalyzingEdit, setReanalyzingEdit] = useState(false);
  const [editAiMessage, setEditAiMessage] = useState<{
    type: "info" | "success" | "error";
    text: string;
  } | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>(["น้ำท่วม"]);
  const [editExtraSlides, setEditExtraSlides] = useState<MediaSlide[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<QueuedUploadFile[]>([]);
  const [imageCompressionProfile, setImageCompressionProfile] =
    useState<ImageCompressionProfile>("content");
  const [compressionStats, setCompressionStats] = useState<Record<string, ImageCompressionResult>>({});
  const compressionJobs = useRef(new Map<string, Promise<ImageCompressionResult>>());

  // Pre-compress queued images in the background so sizes are shown before saving.
  useEffect(() => {
    for (const entry of [...uploadFiles, ...editNewFiles]) {
      if (entry.file.type.startsWith("image/")) void getCompressedEntry(entry, imageCompressionProfile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadFiles, editNewFiles, imageCompressionProfile]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [historyItem, setHistoryItem] = useState<MediaItem | null>(null);
  const [historyEntries, setHistoryEntries] = useState<MediaRevision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);

  // System Tag Configs state for Basic Settings management (Supports Color & Font Awesome Icon)
  const [tagConfigs, setTagConfigs] = useState<CategoryTagConfig[]>(DEFAULT_CATEGORY_CONFIGS);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(TAG_COLOR_PRESETS[0].color);
  const [newCategoryIcon, setNewCategoryIcon] = useState(TAG_ICON_PRESETS[0].icon);
  const [editingTagTarget, setEditingTagTarget] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [editingTagColor, setEditingTagColor] = useState(TAG_COLOR_PRESETS[0].color);
  const [editingTagIcon, setEditingTagIcon] = useState(TAG_ICON_PRESETS[0].icon);
  const [addingCategory, setAddingCategory] = useState(false);
  const [analyzingTagIcon, setAnalyzingTagIcon] = useState(false);
  const [uploadCaptionOptions, setUploadCaptionOptions] = useState<CaptionOption[]>([]);
  const [selectedUploadCaptionIdx, setSelectedUploadCaptionIdx] = useState<number | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [watchMessage, setWatchMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [recMediaSearch, setRecMediaSearch] = useState("");
  const [recMediaCategory, setRecMediaCategory] = useState("all");
  const [recMediaPhase, setRecMediaPhase] = useState<string>("all");

  const availableRecCategories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((item) => {
      const itemCats = getItemCategories(item);
      itemCats.forEach((cat) => {
        if (cat.trim()) cats.add(cat.trim());
      });
    });
    tagConfigs.forEach((t) => {
      if (t.name.trim()) cats.add(t.name.trim());
    });
    return Array.from(cats);
  }, [items, tagConfigs]);

  const filteredRecMediaItems = useMemo(() => {
    return items.filter((item) => {
      if (recMediaCategory !== "all") {
        const itemCats = getItemCategories(item);
        if (!itemCats.includes(recMediaCategory)) return false;
      }
      if (recMediaPhase !== "all") {
        if (item.phase !== recMediaPhase) return false;
      }
      if (recMediaSearch.trim()) {
        const q = recMediaSearch.trim().toLowerCase();
        const titleMatch = (item.title || "").toLowerCase().includes(q);
        const descMatch = (item.description || "").toLowerCase().includes(q);
        const locMatch = (item.location || "").toLowerCase().includes(q);
        const catMatch = getItemCategories(item).some((cat) => cat.toLowerCase().includes(q));
        if (!titleMatch && !descMatch && !locMatch && !catMatch) return false;
      }
      return true;
    });
  }, [items, recMediaCategory, recMediaPhase, recMediaSearch]);

  const fileInput = useRef<HTMLInputElement>(null);
  const editFileInput = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const uploadDescRef = useRef<HTMLTextAreaElement>(null);
  const editDescRef = useRef<HTMLTextAreaElement>(null);

  const applyHighlightToUploadDesc = () => {
    const el = uploadDescRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = uploadDescription;
    if (start !== end) {
      const selectedText = current.substring(start, end);
      const replaced = current.substring(0, start) + `**${selectedText}**` + current.substring(end);
      setUploadDescription(replaced);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start, end + 4);
      }, 0);
    } else {
      const inserted = current ? current + " **ข้อความสำคัญ**" : "**ข้อความสำคัญ**";
      setUploadDescription(inserted);
    }
  };

  const insertSnippetToUploadDesc = (snippet: string) => {
    const el = uploadDescRef.current;
    if (!el) {
      setUploadDescription((prev) => (prev ? prev + snippet : snippet.trim()));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = uploadDescription;
    const replaced = current.substring(0, start) + snippet + current.substring(end);
    setUploadDescription(replaced);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  const applyHighlightToEditDesc = () => {
    const el = editDescRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = editDescription;
    if (start !== end) {
      const selectedText = current.substring(start, end);
      const replaced = current.substring(0, start) + `**${selectedText}**` + current.substring(end);
      setEditDescription(replaced);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start, end + 4);
      }, 0);
    } else {
      const inserted = current ? current + " **ข้อความสำคัญ**" : "**ข้อความสำคัญ**";
      setEditDescription(inserted);
    }
  };

  const insertSnippetToEditDesc = (snippet: string) => {
    const el = editDescRef.current;
    if (!el) {
      setEditDescription((prev) => (prev ? prev + snippet : snippet.trim()));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = editDescription;
    const replaced = current.substring(0, start) + snippet + current.substring(end);
    setEditDescription(replaced);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  // Load watch situation config
  useEffect(() => {
    const stored = readStoredWatchConfig();
    if (stored) {
      setWatchConfig(stored);
      setWatchDraft(stored);
    }
    fetch("/api/watch-situation")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; config?: Partial<WatchSituationConfig> } | null) => {
        if (data?.config) {
          const normalized = normalizeWatchSituation(data.config);
          setWatchConfig(normalized);
          setWatchDraft(normalized);
          writeStoredWatchConfig(normalized);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleSaveWatchSituation = async () => {
    setWatchSaving(true);
    try {
      const updated: WatchSituationConfig = {
        ...watchDraft,
        updatedAt: new Date().toISOString(),
        updatedBy:
          [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") ||
          currentUser.email ||
          "ผู้ดูแลระบบ",
      };
      const res = await fetch("/api/watch-situation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: updated }),
      });
      const data = await res.json();
      if (data.ok && data.config) {
        const saved = normalizeWatchSituation(data.config);
        setWatchConfig(saved);
        setWatchDraft(saved);
        writeStoredWatchConfig(saved);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("watch-situation-updated", { detail: saved }));
          window.dispatchEvent(new Event("storage"));
        }
        if (data.warning) {
          setWatchMessage({
            type: "warning",
            text: `บันทึกสำเร็จ (มีข้อสังเกต): ${data.warning}`,
          });
        } else {
          setWatchMessage({
            type: "success",
            text: data.persisted
              ? "บันทึกและส่งข้อมูลลงฐานข้อมูล Google Sheets เรียบร้อยแล้ว (หน้าแรกของเว็บไซต์อัปเดตทันที)"
              : "บันทึกการตั้งค่าสถานการณ์เฝ้าระวังเรียบร้อยแล้ว (หน้าแรกของเว็บไซต์อัปเดตทันที)",
          });
        }
      } else {
        setWatchMessage({
          type: "error",
          text: data.message || data.error || "เกิดข้อผิดพลาดในการบันทึก",
        });
      }
    } catch {
      setWatchMessage({
        type: "error",
        text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกสถานการณ์ได้ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setWatchSaving(false);
    }
  };

  useEffect(() => {
    // 0. Filter out browser extension message channel disconnect warnings
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = typeof event?.reason?.message === "string" ? event.reason.message : "";
      if (
        msg.includes("message channel closed before a response was received") ||
        msg.includes("listener indicated an asynchronous response")
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // 1. Instant client-side hydration from indexed localStorage cache
    const cachedTags = readStoredTagConfigs();
    if (cachedTags && cachedTags.length > 0) {
      setTagConfigs(cachedTags);
    }

    const cachedAdminMedia = readAdminMediaCache();
    if (cachedAdminMedia && cachedAdminMedia.items.length > 0) {
      setItems(cachedAdminMedia.items);
      setSource(cachedAdminMedia.source);
      setItemsLoading(false);
      setHydrating(false);
    }

    // 2. Background verification & fresh index sync
    void Promise.allSettled([
      loadItems({ silent: Boolean(cachedAdminMedia && cachedAdminMedia.items.length > 0) }),
      checkConnection(),
      loadCategories(cachedTags),
      loadVisitorStats(),
    ]).finally(() => {
      setHydrating(false);
    });

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
    // Initial portal data is intentionally loaded once for the authenticated user.
  }, []);

  async function loadVisitorStats() {
    try {
      const response = await fetch("/api/analytics/stats", { cache: "no-store" });
      if (response.ok) {
        const result = (await response.json()) as { stats?: VisitorStats } & Partial<VisitorStats>;
        if (result.stats && typeof result.stats.totalViews === "number") {
          setVisitorStats(result.stats);
        } else if (typeof result.totalViews === "number") {
          setVisitorStats(result as VisitorStats);
        }
      }
    } catch {
      // Optional footer stat
    }
  }

  async function loadCategories(localStored?: CategoryTagConfig[] | null) {
    try {
      // Fetch latest tags from Google Sheets database
      const response = await fetch("/api/admin/categories", { cache: "no-store" });
      if (response.ok) {
        const result = (await response.json()) as {
          categories?: string[];
          tagConfigs?: CategoryTagConfig[];
        };
        if (Array.isArray(result.tagConfigs) && result.tagConfigs.length > 0) {
          setTagConfigs(result.tagConfigs);
          writeStoredTagConfigs(result.tagConfigs);
          return;
        } else if (Array.isArray(result.categories) && result.categories.length > 0) {
          const mapped = result.categories.map((name) => buildTagConfigFromColor(name));
          setTagConfigs(mapped);
          writeStoredTagConfigs(mapped);
          return;
        }
      }

      // If server unreachable, fallback to client-side localStorage
      if (localStored && localStored.length > 0) {
        setTagConfigs(localStored);
      }
    } catch {
      if (localStored && localStored.length > 0) {
        setTagConfigs(localStored);
      }
    }
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rawName = newCategoryName.trim();
    if (!rawName) return;
    setAddingCategory(true);
    setCategoryMessage(null);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "add",
          name: rawName,
          color: newCategoryColor,
          icon: newCategoryIcon,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        tagConfigs?: CategoryTagConfig[];
        error?: string;
      };
      if (!response.ok || !result.ok || !Array.isArray(result.tagConfigs)) {
        throw new Error(result.error || "เพิ่มประเภทเหตุการณ์ไม่สำเร็จ");
      }
      setTagConfigs(result.tagConfigs);
      writeStoredTagConfigs(result.tagConfigs);
      setNewCategoryName("");
      const nextPaletteIdx = result.tagConfigs.length % TAG_COLOR_PRESETS.length;
      setNewCategoryColor(TAG_COLOR_PRESETS[nextPaletteIdx].color);
      setCategoryMessage({
        type: "success",
        text: `เพิ่ม Tag “${rawName}” พร้อมกำหนดสีและไอคอนสำเร็จ`,
      });
    } catch (error) {
      setCategoryMessage({
        type: "error",
        text: error instanceof Error ? error.message : "เพิ่มประเภทเหตุการณ์ไม่สำเร็จ",
      });
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleUpdateTagConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTagTarget || !editingTagName.trim()) return;
    setCategoryMessage(null);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          oldName: editingTagTarget,
          name: editingTagName.trim(),
          color: editingTagColor,
          icon: editingTagIcon,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        tagConfigs?: CategoryTagConfig[];
        error?: string;
      };
      if (!response.ok || !result.ok || !Array.isArray(result.tagConfigs)) {
        throw new Error(result.error || "อัปเดต Tag ไม่สำเร็จ");
      }
      setTagConfigs(result.tagConfigs);
      writeStoredTagConfigs(result.tagConfigs);
      setEditingTagTarget(null);
      setCategoryMessage({
        type: "success",
        text: `บันทึกการตั้งค่าสีและไอคอนของ Tag “${editingTagName.trim()}” เรียบร้อยแล้ว`,
      });
    } catch (error) {
      setCategoryMessage({
        type: "error",
        text: error instanceof Error ? error.message : "อัปเดต Tag ไม่สำเร็จ",
      });
    }
  }

  async function handleDeleteCategory(categoryName: string) {
    if (tagConfigs.length <= 1) {
      alert("ต้องมีประเภทเหตุการณ์อย่างน้อย 1 รายการในระบบ");
      return;
    }
    if (!window.confirm(`ต้องการลบ Tag ประเภทเหตุการณ์ “${categoryName}” ออกจากตัวเลือกระบบหรือไม่?`)) return;
    setCategoryMessage(null);
    try {
      const response = await fetch(
        `/api/admin/categories?name=${encodeURIComponent(categoryName)}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        tagConfigs?: CategoryTagConfig[];
        error?: string;
      };
      if (!response.ok || !result.ok || !Array.isArray(result.tagConfigs)) {
        throw new Error(result.error || "ลบประเภทเหตุการณ์ไม่สำเร็จ");
      }
      setTagConfigs(result.tagConfigs);
      writeStoredTagConfigs(result.tagConfigs);
      if (editingTagTarget === categoryName) {
        setEditingTagTarget(null);
      }
      setCategoryMessage({
        type: "success",
        text: `ลบ Tag “${categoryName}” เรียบร้อยแล้ว`,
      });
    } catch (error) {
      setCategoryMessage({
        type: "error",
        text: error instanceof Error ? error.message : "ลบประเภทเหตุการณ์ไม่สำเร็จ",
      });
    }
  }

  async function handleResetDefaultTags() {
    if (!window.confirm("ต้องการคืนค่า Tag มาตรฐานเริ่มต้นของระบบทั้งหมดหรือไม่?")) return;
    setCategoryMessage(null);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        tagConfigs?: CategoryTagConfig[];
      };
      if (response.ok && result.ok && Array.isArray(result.tagConfigs)) {
        setTagConfigs(result.tagConfigs);
        writeStoredTagConfigs(result.tagConfigs);
        setEditingTagTarget(null);
        setCategoryMessage({
          type: "success",
          text: "คืนค่า Tag มาตรฐานเริ่มต้นของระบบเรียบร้อยแล้ว",
        });
      }
    } catch {
      // Ignore error
    }
  }

  async function handleAiSuggestTagIcon(mode: "create" | "edit") {
    const targetName = mode === "create" ? newCategoryName.trim() : editingTagName.trim();
    if (!targetName) {
      setCategoryMessage({
        type: "error",
        text: "กรุณาระบุชื่อ Tag ก่อนเพื่อให้ AI วิเคราะห์ไอคอน Font Awesome",
      });
      return;
    }

    setAnalyzingTagIcon(true);
    setCategoryMessage(null);

    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "suggestIcon", name: targetName }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        icon?: string;
        color?: string;
        reason?: string;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.icon) {
        throw new Error(data.error || "ไม่สามารถวิเคราะห์ไอคอนได้");
      }

      if (mode === "create") {
        setNewCategoryIcon(data.icon);
        if (data.color) setNewCategoryColor(data.color);
      } else {
        setEditingTagIcon(data.icon);
        if (data.color) setEditingTagColor(data.color);
      }

      setCategoryMessage({
        type: "success",
        text: `✨ AI วิเคราะห์ไอคอนสำเร็จ: เลือก ${data.icon} ${data.reason ? `(${data.reason})` : ""}`,
      });
    } catch (err) {
      setCategoryMessage({
        type: "error",
        text: err instanceof Error ? err.message : "ไม่สามารถให้ AI วิเคราะห์ไอคอนได้",
      });
    } finally {
      setAnalyzingTagIcon(false);
    }
  }

  async function handleQuickAddInlineTag(targetMode: "upload" | "edit") {
    const raw = inlineNewTag.trim();
    if (!raw) return;
    const parsedNames = parseCategories(raw);
    if (parsedNames.length === 0) return;

    const updatedConfigs = [...tagConfigs];
    for (let idx = 0; idx < parsedNames.length; idx += 1) {
      const tagName = parsedNames[idx];
      if (!updatedConfigs.some((item) => item.name === tagName)) {
        updatedConfigs.push(
          buildTagConfigFromColor(
            tagName,
            idx === 0 ? inlineNewTagColor : undefined,
          ),
        );
      }
    }

    setTagConfigs(updatedConfigs);
    writeStoredTagConfigs(updatedConfigs);
    setInlineNewTag("");
    const nextColorIdx = updatedConfigs.length % TAG_COLOR_PRESETS.length;
    setInlineNewTagColor(TAG_COLOR_PRESETS[nextColorIdx].color);

    if (targetMode === "upload") {
      setUploadCategories((prev) => Array.from(new Set([...prev, ...parsedNames])));
    } else {
      setEditCategories((prev) => Array.from(new Set([...prev, ...parsedNames])));
    }

    void fetch("/api/admin/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "sync", tagConfigs: updatedConfigs }),
    }).catch(() => undefined);
  }

  function toggleCategoryTag(
    tagName: string,
    selectedList: string[],
    setter: (next: string[]) => void,
  ) {
    if (selectedList.includes(tagName)) {
      if (selectedList.length <= 1) return; // Keep at least 1 selected tag
      setter(selectedList.filter((entry) => entry !== tagName));
    } else {
      setter([...selectedList, tagName]);
    }
  }

  const tagConfigMap = useMemo(() => {
    const map = new Map<string, CategoryTagConfig>();
    for (const cfg of tagConfigs) {
      map.set(cfg.name, cfg);
    }
    return map;
  }, [tagConfigs]);

  function getTagVisual(tagName: string): CategoryTagConfig {
    return tagConfigMap.get(tagName) ?? buildTagConfigFromColor(tagName);
  }

  const categories = useMemo(() => {
    const configuredNames = tagConfigs.map((item) => item.name);
    const itemCats = items.flatMap((item) => getItemCategories(item)).filter(Boolean);
    return Array.from(new Set([...configuredNames, ...itemCats]));
  }, [items, tagConfigs]);

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
      const itemCats = getItemCategories(item);
      const haystack =
        item._searchIndex ||
        [
          item.title,
          item.description,
          item.category,
          item.location,
          item.fileName,
          item.uploadedBy,
          ...itemCats,
          ...item.keywords,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("th");
      const matchesQuery = !needle || haystack.includes(needle);
      const matchesStatus = mediaStatus === "all" || item.status === mediaStatus;
      const matchesPhase = mediaPhase === "all" || item.phase === mediaPhase;
      const matchesCategory =
        mediaCategory === "all" ||
        itemCats.includes(mediaCategory) ||
        item.category === mediaCategory;
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
  const startItemIndex = filteredItems.length ? (activeMediaPage - 1) * MEDIA_PAGE_SIZE + 1 : 0;
  const endItemIndex = Math.min(activeMediaPage * MEDIA_PAGE_SIZE, filteredItems.length);
  const visibleMediaItems = filteredItems.slice(
    (activeMediaPage - 1) * MEDIA_PAGE_SIZE,
    activeMediaPage * MEDIA_PAGE_SIZE,
  );
  const paginationPages = useMemo(
    () => buildPaginationPages(activeMediaPage, mediaPageCount),
    [activeMediaPage, mediaPageCount],
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

  async function loadItems(options?: { silent?: boolean; forceRefresh?: boolean }) {
    if (!options?.silent) {
      setItemsLoading(true);
    }
    setItemsLoadError("");
    try {
      const endpoint = options?.forceRefresh
        ? `/api/admin/media?refresh=${Date.now()}`
        : "/api/admin/media";
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = (await response.json()) as MediaResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "โหลดรายการสื่อไม่สำเร็จ");
      }
      let deletedSet = new Set<string>();
      try {
        const rawDeleted = window.sessionStorage.getItem("satun-deleted-media-ids");
        if (rawDeleted) {
          const parsed = JSON.parse(rawDeleted) as unknown;
          if (Array.isArray(parsed)) {
            deletedSet = new Set(parsed.map(String));
          }
        }
      } catch {
        // Ignore session storage errors
      }
      const activeItems = normalizeMediaItems(result.items || [], ["published", "draft"]).filter(
        (item) => !deletedSet.has(item.id),
      );
      setItems(activeItems);
      setSource(result.source);
      writeAdminMediaCache(activeItems, result.source);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "โหลดรายการสื่อไม่สำเร็จ";
      if (!options?.silent) {
        setItemsLoadError(message);
      }
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

  function compressionKey(entryId: string, profile: ImageCompressionProfile) {
    return `${entryId}:${profile}`;
  }

  /** Compresses a queued image once per profile and caches the result. */
  function getCompressedEntry(
    entry: QueuedUploadFile,
    profile: ImageCompressionProfile = imageCompressionProfile,
  ): Promise<ImageCompressionResult> {
    const key = compressionKey(entry.id, profile);
    const existing = compressionJobs.current.get(key);
    if (existing) return existing;

    const job = compressImageForWeb(entry.file, profile).catch(
      (): ImageCompressionResult => ({
        file: entry.file,
        profile,
        originalBytes: entry.file.size,
        outputBytes: entry.file.size,
        width: 0,
        height: 0,
        quality: null,
        compressed: false,
        withinTarget: entry.file.size <= IMAGE_COMPRESSION_PROFILES[profile].targetBytes,
      }),
    );
    compressionJobs.current.set(key, job);
    void job.then((result) => {
      if (compressionJobs.current.get(key) !== job) return;
      setCompressionStats((current) => ({ ...current, [key]: result }));
    });
    return job;
  }

  function forgetCompressedEntries(entryIds: string[]) {
    if (entryIds.length === 0) return;
    const prefixes = entryIds.map((id) => `${id}:`);
    for (const key of Array.from(compressionJobs.current.keys())) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) compressionJobs.current.delete(key);
    }
    setCompressionStats((current) => {
      const next: Record<string, ImageCompressionResult> = {};
      for (const [key, value] of Object.entries(current)) {
        if (!prefixes.some((prefix) => key.startsWith(prefix))) next[key] = value;
      }
      return next;
    });
  }

  function getCompressionStat(entry: QueuedUploadFile): ImageCompressionResult | undefined {
    return compressionStats[compressionKey(entry.id, imageCompressionProfile)];
  }

  function renderCompressionBadge(entry: QueuedUploadFile) {
    if (!entry.file.type.startsWith("image/")) return null;
    const stat = getCompressionStat(entry);
    if (!stat) {
      return (
        <span className="compress-badge is-working">
          <LoaderCircle className="spin" size={12} /> กำลังบีบอัดรูปภาพให้เหมาะกับเว็บไซต์...
        </span>
      );
    }
    const dims = stat.width && stat.height ? ` • ${stat.width}×${stat.height}px` : "";
    if (!stat.compressed) {
      return (
        <span className={stat.withinTarget ? "compress-badge is-ok" : "compress-badge is-warn"}>
          <Check size={12} /> ขนาดเหมาะสมแล้ว ใช้ไฟล์เดิม {formatFileSize(stat.outputBytes)}
          {dims}
        </span>
      );
    }
    const saved = Math.max(0, Math.round((1 - stat.outputBytes / Math.max(1, stat.originalBytes)) * 100));
    return (
      <span className={stat.withinTarget ? "compress-badge is-ok" : "compress-badge is-warn"}>
        <Gauge size={12} /> บีบอัดแล้ว {formatFileSize(stat.originalBytes)} → {" "}
        <strong>{formatFileSize(stat.outputBytes)}</strong> (ลดลง {saved}%){dims}
      </span>
    );
  }

  function renderCompressionPicker(entries: QueuedUploadFile[] = uploadFiles) {
    const images = entries.filter((entry) => entry.file.type.startsWith("image/"));
    const stats = images.map((entry) => getCompressionStat(entry));
    const ready = stats.filter((stat): stat is ImageCompressionResult => Boolean(stat));
    const originalTotal = images.reduce((sum, entry) => sum + entry.file.size, 0);
    const outputTotal = ready.reduce((sum, stat) => sum + stat.outputBytes, 0);
    const pending = images.length - ready.length;

    return (
      <div className="compress-panel">
        <div className="compress-panel-head">
          <span className="compress-panel-title">
            <Gauge size={15} /> บีบอัดรูปภาพอัตโนมัติสำหรับเว็บไซต์
          </span>
          {images.length > 0 ? (
            <span className="compress-panel-summary">
              {pending > 0 ? (
                <>
                  <LoaderCircle className="spin" size={12} /> กำลังบีบอัด {ready.length}/{images.length} รูป
                </>
              ) : (
                <>
                  <Check size={12} /> รวม {formatFileSize(originalTotal)} → {" "}
                  <strong>{formatFileSize(outputTotal)}</strong>
                </>
              )}
            </span>
          ) : null}
        </div>
        <div className="compress-profile-options" role="radiogroup" aria-label="ระดับการบีบอัดรูปภาพ">
          {(Object.keys(IMAGE_COMPRESSION_PROFILES) as ImageCompressionProfile[]).map((key) => {
            const active = imageCompressionProfile === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                className={active ? "compress-profile-btn is-active" : "compress-profile-btn"}
                onClick={() => setImageCompressionProfile(key)}
              >
                {active ? <Check size={13} /> : <Images size={13} />}
                <span>{IMAGE_COMPRESSION_PROFILES[key].label}</span>
              </button>
            );
          })}
        </div>
        <small className="compress-panel-hint">
          ระบบย่อขนาดและบีบอัดภาพ (JPEG คุณภาพสูง) ก่อนบันทึกลง Google Drive โดยคงความคมชัดของตัวอักษร —
          ภาพทั่วไปไม่เกิน ~200 KB • แบนเนอร์เต็มจอไม่เกิน ~500 KB (สูงสุด 1 MB) • AI ยังอ่านจากภาพต้นฉบับความละเอียดเต็ม
        </small>
      </div>
    );
  }

  function resetUploadFormFields() {
    forgetCompressedEntries(uploadFiles.map((entry) => entry.id));
    for (const entry of uploadFiles) {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    }
    setUploadFiles([]);
    setActiveUploadSlide(0);
    setUploadProgressText("");
    setAiAnalyzing(false);
    setAiStatusMessage(null);
    setUploadTitle("");
    setUploadPhase("before");
    setUploadCategories([categories[0] || "น้ำท่วม"]);
    setInlineNewTag("");
    setUploadEventDate(todayIsoDate());
    setUploadLocation("จังหวัดสตูล");
    setUploadDescription("");
    setUploadAltText("");
    setUploadKeywords("");
    setUploadStatus("published");
    setUploadCaptionOptions([]);
    setSelectedUploadCaptionIdx(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  const applyUploadCaptionOption = (opt: CaptionOption, idx: number) => {
    setSelectedUploadCaptionIdx(idx);
    if (opt.title) setUploadTitle(opt.title);
    if (opt.caption) setUploadDescription(opt.caption);
    if (opt.hashtags && opt.hashtags.length > 0) {
      setUploadKeywords(opt.hashtags.join(", "));
    }
  };

  async function analyzeFileWithAi(targetFile: File) {
    setAiAnalyzing(true);
    setAiStatusMessage({
      type: "info",
      text: "AI กำลังอ่านข้อความและวิเคราะห์รูปภาพเพื่อสร้างข้อมูลและเลือก Tag อัตโนมัติ...",
    });

    try {
      let imageDataUrl = "";
      if (targetFile.type.startsWith("image/")) {
        if (targetFile.size <= 4 * 1024 * 1024) {
          imageDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(targetFile);
          });
        } else {
          imageDataUrl = await createCompressedImageDataUrl(targetFile, 1920);
        }
      }

      const response = await fetch("/api/admin/ai-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageDataUrl,
          fileName: targetFile.name,
          categories,
        }),
      });

      const result = (await response.json()) as AiSuggestionResponse;
      if (!response.ok || !result.ok || !result.suggestion) {
        throw new Error(result.error || "ไม่สามารถวิเคราะห์ภาพด้วย AI ได้");
      }

      const { suggestion } = result;
      if (suggestion.title) setUploadTitle(suggestion.title);
      if (suggestion.phase) setUploadPhase(suggestion.phase);
      if (Array.isArray(suggestion.categories) && suggestion.categories.length > 0) {
        setUploadCategories(suggestion.categories);
      } else if (suggestion.category) {
        const parsedCats = parseCategories(suggestion.category);
        if (parsedCats.length > 0) setUploadCategories(parsedCats);
      }
      if (suggestion.description) setUploadDescription(suggestion.description);
      if (suggestion.altText) setUploadAltText(suggestion.altText);
      if (Array.isArray(suggestion.keywords) && suggestion.keywords.length > 0) {
        setUploadKeywords(suggestion.keywords.join(", "));
      }
      if (suggestion.location) setUploadLocation(suggestion.location);
      if (!uploadEventDate) setUploadEventDate(todayIsoDate());

      if (
        suggestion.captionOptions &&
        Array.isArray(suggestion.captionOptions) &&
        suggestion.captionOptions.length > 0
      ) {
        setUploadCaptionOptions(suggestion.captionOptions);
        setSelectedUploadCaptionIdx(0);
      }

      const engineLabel =
        suggestion.ocrEngine === "aksonocr"
          ? "AksonOCR"
          : suggestion.ocrEngine === "typhoon-ocr"
            ? "Typhoon OCR (ระบบสำรอง)"
            : "AI";

      setAiStatusMessage({
        type: "success",
        text: `AI (${engineLabel}) วิเคราะห์ข้อความในภาพจริงเรียบร้อยแล้ว ได้เนื้อหาตรงกับภาพ (เลือกแคปชั่น 3 สไตล์ได้ด้านล่าง)`,
      });
    } catch (error) {
      setAiStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? `${error.message} — คุณยังสามารถกรอกและแก้ไขข้อมูลด้วยตนเองได้`
            : "วิเคราะห์ภาพไม่สำเร็จ คุณสามารถกรอกข้อมูลด้วยตนเองได้",
      });
    } finally {
      setAiAnalyzing(false);
    }
  }

  function addUploadFiles(incoming: FileList | File[] | null, replaceAll = false) {
    const rawList = incoming ? Array.from(incoming).filter((entry) => entry && entry.size > 0) : [];
    if (rawList.length === 0) return;

    const createdEntries: QueuedUploadFile[] = rawList.map((nextFile, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      file: nextFile,
      previewUrl: nextFile.type.startsWith("image/") ? URL.createObjectURL(nextFile) : "",
    }));

    const wasEmpty = replaceAll || uploadFiles.length === 0;
    if (replaceAll) {
      for (const oldEntry of uploadFiles) {
        if (oldEntry.previewUrl) URL.revokeObjectURL(oldEntry.previewUrl);
      }
      setUploadFiles(createdEntries.slice(0, 15));
      setActiveUploadSlide(0);
    } else {
      const merged = [...uploadFiles, ...createdEntries].slice(0, 15);
      setUploadFiles(merged);
      if (wasEmpty) {
        setActiveUploadSlide(0);
      } else {
        setActiveUploadSlide(uploadFiles.length);
      }
    }

    if (wasEmpty && createdEntries[0]) {
      void analyzeFileWithAi(createdEntries[0].file);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeUploadFileAt(index: number) {
    const target = uploadFiles[index];
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    if (target) forgetCompressedEntries([target.id]);
    const next = uploadFiles.filter((_, idx) => idx !== index);
    setUploadFiles(next);
    if (next.length === 0) {
      setActiveUploadSlide(0);
      setAiStatusMessage(null);
    } else {
      setActiveUploadSlide((prev) => Math.min(prev, next.length - 1));
    }
  }

  function makeCoverUploadFile(index: number) {
    if (index <= 0 || index >= uploadFiles.length) return;
    const picked = uploadFiles[index];
    const remaining = uploadFiles.filter((_, idx) => idx !== index);
    setUploadFiles([picked, ...remaining]);
    setActiveUploadSlide(0);
  }

  async function uploadSingleAttachment(entry: QueuedUploadFile, meta: { phase: string; category: string; eventDate: string; location: string }): Promise<MediaSlide> {
    const targetFile = entry.file;
    const optimizedFile = (await getCompressedEntry(entry)).file;
    const attachmentForm = new FormData();
    attachmentForm.set("mode", "attachment");
    attachmentForm.set("file", optimizedFile);
    attachmentForm.set("phase", meta.phase);
    attachmentForm.set("category", meta.category);
    attachmentForm.set("eventDate", meta.eventDate);
    attachmentForm.set("location", meta.location);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: attachmentForm,
    });
    const result = (await response.json()) as {
      ok?: boolean;
      slide?: MediaSlide;
      error?: string;
    };
    if (!response.ok || !result.ok || !result.slide) {
      throw new Error(result.error || `อัปโหลดไฟล์ "${targetFile.name}" ไม่สำเร็จ`);
    }
    return result.slide;
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadFiles.length === 0 || !status?.connected) return;

    const combinedCategory = formatCategoriesField(uploadCategories);
    setUploading(true);
    setFormMessage(null);
    const totalCount = uploadFiles.length;
    try {
      const extraSlides: MediaSlide[] = [];
      if (totalCount > 1) {
        for (let idx = 1; idx < totalCount; idx += 1) {
          setUploadProgressText(`กำลังบีบอัดและอัปโหลดรูปภาพที่ ${idx + 1} จาก ${totalCount}...`);
          const slide = await uploadSingleAttachment(uploadFiles[idx], {
            phase: uploadPhase,
            category: combinedCategory,
            eventDate: uploadEventDate,
            location: uploadLocation.trim(),
          });
          extraSlides.push(slide);
        }
      }

      setUploadProgressText(
        totalCount > 1
          ? `กำลังบันทึกภาพปกและรวมชุดสื่อ (${totalCount} รูปภาพ)...`
          : "กำลังบีบอัดรูปภาพให้เหมาะกับเว็บไซต์และบันทึกลง Google Drive...",
      );

      const optimizedPrimaryFile = (await getCompressedEntry(uploadFiles[0])).file;
      const data = new FormData();
      data.set("file", optimizedPrimaryFile);
      if (extraSlides.length > 0) {
        data.set("extraSlides", JSON.stringify(extraSlides));
      }
      data.set("title", uploadTitle.trim());
      data.set("phase", uploadPhase);
      data.set("category", combinedCategory);
      data.set("eventDate", uploadEventDate);
      data.set("location", uploadLocation.trim());
      data.set("description", uploadDescription.trim());
      data.set("altText", uploadAltText.trim());
      data.set("keywords", uploadKeywords.trim());
      data.set("status", uploadStatus);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: data,
      });
      const result = (await response.json()) as { ok?: boolean; item?: MediaItem; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "บันทึกสื่อไม่สำเร็จ");
      resetUploadFormFields();
      setShowUploadForm(false);
      clearMediaCache();
      setFormMessage({
        type: "success",
        text:
          totalCount > 1
            ? `บันทึกชุดสื่อจำนวน ${totalCount} รูปภาพใน Google Drive และ Google Sheets เรียบร้อยแล้ว`
            : "บันทึกไฟล์ใน Google Drive และเพิ่มข้อมูลใน Google Sheets เรียบร้อยแล้ว",
      });
      await loadItems({ forceRefresh: false });
      setMediaSort("created-desc");
      setMediaPage(1);
    } catch (error) {
      setFormMessage({
        type: "error",
        text: formatFriendlyUploadError(error),
      });
    } finally {
      setUploading(false);
      setUploadProgressText("");
    }
  }

  async function deleteItem(item: MediaItem) {
    if (!status?.connected || !window.confirm(`ย้าย “${item.title}” ไปถังขยะหรือไม่`)) return;
    setFormMessage(null);
    const slideIds = getMediaSlides(item)
      .map((slide) => slide.id)
      .filter(Boolean);
    try {
      const response = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, slideIds }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setFormMessage({ type: "error", text: result.error || "ลบสื่อไม่สำเร็จ" });
        return;
      }
      try {
        const rawDeleted = window.sessionStorage.getItem("satun-deleted-media-ids");
        const existing = rawDeleted ? (JSON.parse(rawDeleted) as string[]) : [];
        const updated = Array.from(new Set([...(Array.isArray(existing) ? existing : []), item.id, ...slideIds]));
        window.sessionStorage.setItem("satun-deleted-media-ids", JSON.stringify(updated));
      } catch {
        // Ignore session storage errors
      }
      clearMediaCache();
      setItems((current) => {
        const next = current.filter((entry) => entry.id !== item.id);
        writeAdminMediaCache(next, source);
        return next;
      });
      setFormMessage({
        type: "success",
        text: `ลบสื่อ “${item.title}” ออกจากคลังสื่อเรียบร้อยแล้ว`,
      });
    } catch (error) {
      setFormMessage({
        type: "error",
        text: error instanceof Error ? error.message : "ลบสื่อไม่สำเร็จ",
      });
    }
  }

  function openEditModal(item: MediaItem) {
    const slides = getMediaSlides(item);
    setEditExtraSlides(slides.slice(1));
    setEditCategories(getItemCategories(item));
    setInlineNewTag("");
    for (const oldFile of editNewFiles) {
      if (oldFile.previewUrl) URL.revokeObjectURL(oldFile.previewUrl);
    }
    forgetCompressedEntries(editNewFiles.map((entry) => entry.id));
    setEditNewFiles([]);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditAltText(item.altText || "");
    setEditKeywords(item.keywords.join(", "));
    setEditLocation(item.location || "สตูล");
    setEditPhase(item.phase || "before");
    setEditCaptionOptions([]);
    setSelectedCaptionIdx(null);
    setEditAiMessage(null);
    setEditing(item);
  }

  function closeEditModal() {
    for (const oldFile of editNewFiles) {
      if (oldFile.previewUrl) URL.revokeObjectURL(oldFile.previewUrl);
    }
    forgetCompressedEntries(editNewFiles.map((entry) => entry.id));
    setEditNewFiles([]);
    setEditExtraSlides([]);
    setEditCaptionOptions([]);
    setSelectedCaptionIdx(null);
    setEditAiMessage(null);
    setEditing(null);
  }

  const handleReanalyzeEditMedia = async () => {
    if (!editing) return;
    setReanalyzingEdit(true);
    setEditAiMessage({
      type: "info",
      text: "AI Content Marketing กำลังวิเคราะห์รูปภาพและคิดแคปชั่น 3 สไตล์ กรุณารอสักครู่...",
    });

    try {
      let imageDataUrl = "";
      if (editNewFiles.length > 0 && editNewFiles[0].file.type.startsWith("image/")) {
        imageDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.readAsDataURL(editNewFiles[0].file);
        });
      }

      const resolvedImageUrl =
        !imageDataUrl
          ? editing.thumbnailUrl ||
            editing.downloadUrl ||
            editExtraSlides[0]?.thumbnailUrl ||
            editExtraSlides[0]?.downloadUrl ||
            undefined
          : undefined;

      const res = await fetch("/api/admin/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: imageDataUrl || undefined,
          imageUrl: resolvedImageUrl,
          fileName: editing.fileName,
          currentTitle: editTitle || editing.title,
          currentDescription: editDescription || editing.description,
          categories: editCategories,
          mode: "caption3styles",
        }),
      });

      const data = await res.json();
      if (data.ok && data.suggestion) {
        const s = data.suggestion;
        if (s.captionOptions && Array.isArray(s.captionOptions) && s.captionOptions.length > 0) {
          setEditCaptionOptions(s.captionOptions);
          applyCaptionOption(s.captionOptions[0], 0);
          const engineLabel =
            s.ocrEngine === "aksonocr"
              ? "AksonOCR"
              : s.ocrEngine === "typhoon-ocr"
                ? "Typhoon OCR (ระบบสำรอง)"
                : "AI";
          setEditAiMessage({
            type: "success",
            text: `AI (${engineLabel}) วิเคราะห์ภาพจริงและสร้างแคปชั่น 3 สไตล์ตรงกับภาพเรียบร้อยแล้ว! เลือกสไตล์ที่ต้องการด้านล่างได้ทันที`,
          });
        } else {
          if (s.title) setEditTitle(s.title);
          if (s.description) setEditDescription(s.description);
          if (s.keywords && s.keywords.length > 0) setEditKeywords(s.keywords.join(", "));
          if (s.altText) setEditAltText(s.altText);
          setEditAiMessage({
            type: "success",
            text: "AI ทบทวนข้อมูลและปรับปรุงแคปชั่นเรียบร้อยแล้ว",
          });
        }
      } else {
        setEditAiMessage({
          type: "error",
          text: data.error || "ไม่สามารถวิเคราะห์รูปภาพด้วย AI ได้",
        });
      }
    } catch {
      setEditAiMessage({
        type: "error",
        text: "ไม่สามารถเชื่อมต่อระบบ AI ได้ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setReanalyzingEdit(false);
    }
  };

  const applyCaptionOption = (opt: CaptionOption, idx: number) => {
    setSelectedCaptionIdx(idx);
    if (opt.title) setEditTitle(opt.title);
    if (opt.caption) setEditDescription(opt.caption);
    if (opt.hashtags && opt.hashtags.length > 0) {
      setEditKeywords(opt.hashtags.join(", "));
    }
  };

  function addEditFiles(incoming: FileList | File[] | null) {
    const rawList = incoming ? Array.from(incoming).filter((entry) => entry && entry.size > 0) : [];
    if (rawList.length === 0) return;
    const created: QueuedUploadFile[] = rawList.map((nextFile, idx) => ({
      id: `edit-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      file: nextFile,
      previewUrl: nextFile.type.startsWith("image/") ? URL.createObjectURL(nextFile) : "",
    }));
    setEditNewFiles((current) => [...current, ...created].slice(0, 14));
    if (editFileInput.current) editFileInput.current.value = "";
  }

  function removeEditNewFileAt(index: number) {
    const target = editNewFiles[index];
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    if (target) forgetCompressedEntries([target.id]);
    setEditNewFiles((current) => current.filter((_, idx) => idx !== index));
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !status?.connected) return;
    const data = new FormData(event.currentTarget);
    setSavingEdit(true);
    setFormMessage(null);
    try {
      const phaseValue = String(data.get("phase") || "before");
      const categoryValue = formatCategoriesField(editCategories);
      const eventDateValue = String(data.get("eventDate") || "");
      const locationValue = String(data.get("location") || "");

      const uploadedNewSlides: MediaSlide[] = [];
      for (const entry of editNewFiles) {
        const slide = await uploadSingleAttachment(entry, {
          phase: phaseValue,
          category: categoryValue,
          eventDate: eventDateValue,
          location: locationValue,
        });
        uploadedNewSlides.push(slide);
      }

      const finalExtraSlides = [...editExtraSlides, ...uploadedNewSlides];

      const response = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          title: String(data.get("title") || ""),
          description: String(data.get("description") || ""),
          phase: phaseValue,
          category: categoryValue,
          categories: editCategories,
          eventDate: eventDateValue,
          location: locationValue,
          keywords: String(data.get("keywords") || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          altText: String(data.get("altText") || ""),
          status: String(data.get("status") || "published"),
          extraSlides: finalExtraSlides,
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
      setItems((current) => {
        const next = current.map((item) =>
          item.id === result.item?.id ? result.item : item,
        );
        writeAdminMediaCache(next, source);
        return next;
      });
      clearMediaCache();
      closeEditModal();
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

  function openUploadModal() {
    if (uploadCategories.length === 0 && categories[0]) {
      setUploadCategories([categories[0]]);
    }
    if (!uploadEventDate) {
      setUploadEventDate(todayIsoDate());
    }
    setInlineNewTag("");
    setFormMessage(null);
    setShowUploadForm(true);
  }

  function openMediaPreview(item: MediaItem) {
    setPreviewItem(item);
    setPreviewSlideIndex(0);
  }

  if (hydrating) return <AdminDashboardSkeleton />;

  return (
    <main className="admin-page site-shell" id="top">
      <header className="site-header">
        <div className="container nav-wrap">
          <Link className="brand" href="/" aria-label="กลับไปหน้าแรก">
            <span className="brand-mark">
              <img src="/satun-risk-logo.png" alt="" aria-hidden="true" />
            </span>
            <span>
              <strong>คลังสื่อสารความเสี่ยง</strong>
              <small>สำนักงานสาธารณสุขจังหวัดสตูล</small>
            </span>
          </Link>
          <button
            className="mobile-menu"
            type="button"
            aria-label="เปิดเมนู"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <nav className={menuOpen ? "nav-links is-open" : "nav-links"} aria-label="เมนูหลัก">
            <Link className="nav-item" href="/" onClick={() => setMenuOpen(false)}>
              <Home size={16} /> หน้าแรก
            </Link>
            <Link className="nav-item" href="/#phases" onClick={() => setMenuOpen(false)}>
              <ShieldCheck size={16} /> ข้อมูลสถานการณ์
            </Link>
            <Link className="nav-item is-active" href="/admin" onClick={() => setMenuOpen(false)}>
              <FileText size={16} /> จัดการคลังสื่อ
            </Link>
            <Link className="nav-item" href="/admin/profile" onClick={() => setMenuOpen(false)}>
              <UserRound size={16} /> โปรไฟล์ของฉัน
            </Link>
            {isManagerRole(currentUser.role) && (
              <Link className="nav-item" href="/admin/users" onClick={() => setMenuOpen(false)}>
                <Info size={16} /> จัดการสมาชิก
              </Link>
            )}
            <div className="nav-right-group">
              <button
                type="button"
                className="nav-search-trigger"
                aria-label="ค้นหาในคลังสื่อ"
                onClick={() => {
                  setMenuOpen(false);
                  setActiveTab("library");
                  searchInputRef.current?.focus();
                  searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                <Search size={18} />
              </button>
              <button
                type="button"
                className="admin-link"
                onClick={() => void signOut({ callbackUrl: "/" })}
              >
                <LogOut size={15} /> ออกจากระบบ <ArrowRight size={15} />
              </button>
            </div>
          </nav>
        </div>
      </header>

      <section className="admin-hero-banner">
        <div className="hero-pattern" />
        <div className="container admin-hero-inner">
          <div className="admin-hero-grid">
            <div className="admin-title-copy">
              <span className="eyebrow">
                <Sparkles size={15} /> CONTENT MANAGEMENT
              </span>
              <h1>จัดการคลังสื่อ</h1>
              <p>
                {currentUser.firstName} {currentUser.lastName} • {currentUser.position} • อัปโหลดข้อมูลไปยังบัญชี Google ของหน่วยงาน พร้อมระบบ AI อ่านข้อมูลจากภาพอัตโนมัติ
              </p>

              <section className={status?.connected ? "connection-banner connected" : "connection-banner pending"}>
                <span className="connection-icon">
                  {status?.connected ? <FolderCheck size={24} /> : <Link2 size={24} />}
                </span>
                <div>
                  <strong>{status?.connected ? "เชื่อมต่อ Google พร้อมใช้งาน" : "กำลังตรวจสอบการเชื่อมต่อ Google"}</strong>
                  <p>{status?.message || (status?.connected ? "เชื่อมต่อ Google สำเร็จ" : "โปรดรอสักครู่")}</p>
                  {status?.connected && (
                    <small>
                      Drive: {status.folderName || "คลังสื่อสารความเสี่ยง สสจ.สตูล"} • Sheets: {status.sheetName || "ฐานข้อมูลคลังสื่อสารความเสี่ยง สสจ.สตูล"}
                    </small>
                  )}
                </div>
                <button
                  type="button"
                  className="connection-state"
                  onClick={() => void checkConnection()}
                  disabled={checking}
                  title="คลิกเพื่อตรวจสอบสถานะการเชื่อมต่ออีกครั้ง"
                >
                  {checking ? (
                    <><RefreshCw className="spin" size={14} /> กำลังตรวจสอบ</>
                  ) : status?.connected ? (
                    <><Check size={15} /> พร้อมใช้งาน</>
                  ) : (
                    <><RefreshCw size={14} /> ตรวจสอบอีกครั้ง</>
                  )}
                </button>
              </section>
            </div>

            <div className="admin-hero-card">
              <div className="alert-card-head">
                <span className="alert-badge-pill">
                  <span className="live-dot" />
                  <span>AI VISION ASSISTANT</span>
                </span>
                <small>{items.length} รายการในคลัง</small>
              </div>
              <div className="admin-hero-card-body">
                <span className="admin-hero-cloud-badge">
                  <CloudUpload size={28} />
                </span>
                <div>
                  <strong>อัปโหลดสื่อพร้อมวิเคราะห์ภาพด้วย AI</strong>
                  <p>
                    เพียงแนบไฟล์ภาพอินโฟกราฟิกหรือโปสเตอร์ ระบบ AI จะอ่านข้อมูลในภาพ พร้อมสรุปเนื้อหาเป็น Bullet point ใส่อิโมจิ ด้วยภาษาที่เข้าถึงวัยรุ่นปนทางการให้อ่านง่ายอัตโนมัติ
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="alert-action-btn"
                onClick={openUploadModal}
                disabled={!status?.connected}
              >
                <WandSparkles size={16} /> เพิ่มสื่อใหม่ด้วย AI <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container admin-content">
        {status && !status.connected && (
          <section className="setup-panel">
            <div className="setup-heading">
              <span className="setup-number">3</span>
              <div><h2>ขั้นตอนเชื่อมต่อบัญชี Google ของคุณ</h2><p>ทำครั้งเดียว จากนั้นระบบจะสร้างโฟลเดอร์และชีตให้โดยอัปโนมัติ</p></div>
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

        <div className="admin-tab-row">
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
            <button
              type="button"
              className={activeTab === "watch" ? "admin-tab-button is-active" : "admin-tab-button"}
              onClick={() => setActiveTab("watch")}
            >
              <i className="fa-solid fa-tower-broadcast" style={{ fontSize: 16 }} />
              <span>สถานการณ์เฝ้าระวัง</span>
              <span className={`tab-badge ${watchConfig.enabled ? "badge-live" : ""}`}>
                {watchConfig.enabled ? "เปิดใช้งาน" : "ปิด"}
              </span>
            </button>
          </nav>

          <div className="admin-title-actions">
            <button
              className="admin-add-media"
              type="button"
              onClick={openUploadModal}
              disabled={!status?.connected}
              aria-expanded={showUploadForm}
              aria-controls="upload-media-modal"
            >
              <Plus size={17} />
              เพิ่มสื่อใหม่
            </button>
          </div>
        </div>

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
                <button type="button" onClick={() => void loadItems({ forceRefresh: true })} disabled={itemsLoading}>
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
                  ref={searchInputRef}
                  value={mediaQuery}
                  onChange={(event) => {
                    setMediaQuery(event.target.value);
                    setMediaPage(1);
                  }}
                  placeholder="ค้นหาชื่อสื่อ พื้นที่ ประเภท คำค้น หรือผู้อัปโหลด..."
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
                แสดง <strong>{startItemIndex} - {endItemIndex}</strong> จาก <strong>{filteredItems.length}</strong> รายการ
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
                {visibleMediaItems.map((item) => {
                  const itemSlides = getMediaSlides(item);
                  const itemCategories = getItemCategories(item);
                  return (
                    <article className="media-library-item" key={item.id}>
                      <div
                        className={`library-thumbnail thumb-${item.phase}`}
                        onClick={() => openMediaPreview(item)}
                        role="button"
                        tabIndex={0}
                        title={
                          itemSlides.length > 1
                            ? `คลิกเพื่อเปิดดูชุดภาพ (${itemSlides.length} รูป)`
                            : "คลิกเพื่อดูภาพขนาดใหญ่"
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openMediaPreview(item);
                          }
                        }}
                      >
                        {item.thumbnailUrl ? (
                          <img
                            src={optimizeThumbnailUrl(item.thumbnailUrl, 480)}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : item.fileType.includes("pdf") ? (
                          <FileText size={24} />
                        ) : (
                          <FileImage size={24} />
                        )}
                        {item.fileType.includes("pdf") && <span>PDF</span>}
                        {itemSlides.length > 1 && (
                          <span className="library-slide-count">
                            <Images size={11} /> {itemSlides.length} ภาพ
                          </span>
                        )}
                      </div>
                      <div className="library-item-main">
                        <div className="library-item-title-row">
                          <h3 onClick={() => openMediaPreview(item)} style={{ cursor: "pointer" }}>
                            {item.title}
                          </h3>
                          <span className={`library-status ${item.status}`}>
                            {item.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                          </span>
                          {itemSlides.length > 1 && (
                            <span className="library-multi-tag">
                              <Images size={12} /> ชุดสื่อ {itemSlides.length} ภาพ
                            </span>
                          )}
                        </div>
                        <div className="library-item-tags-row">
                          {itemCategories.map((cat) => {
                            const cfg = getTagVisual(cat);
                            return (
                              <span
                                key={`${item.id}-${cat}`}
                                className="event-tag-badge"
                                style={{
                                  backgroundColor: cfg.bgColor,
                                  color: cfg.textColor,
                                  borderColor: cfg.borderColor,
                                }}
                              >
                                <span
                                  className="event-tag-dot"
                                  style={{ backgroundColor: cfg.color }}
                                />
                                <i className={cfg.icon} aria-hidden="true" />
                                <span>{cat}</span>
                              </span>
                            );
                          })}
                          <span className="library-phase-location">
                            • {phaseLabels[item.phase]} • {item.location}
                          </span>
                        </div>
                        <div className="library-item-meta">
                          <span><CalendarDays size={13} /> เหตุการณ์ {formatThaiDate(item.eventDate)}</span>
                          {item.uploadedBy && <span><UserRound size={13} /> โดย {item.uploadedBy}</span>}
                          {item.revisionCount ? <span>แก้ไข {item.revisionCount} ครั้ง</span> : null}
                        </div>
                      </div>
                      <div className="library-created-date">
                        <small>อัปโหลดเมื่อ</small>
                        <strong>{formatThaiDateTime(item.createdAt)}</strong>
                      </div>
                      <div className="manager-actions library-actions">
                        <button
                          type="button"
                          disabled={!status?.connected || source === "demo"}
                          onClick={() => openEditModal(item)}
                          aria-label={`แก้ไข ${item.title}`}
                          title="แก้ไขข้อมูลและจัดการรูปภาพ"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={!status?.connected || source === "demo"}
                          onClick={() => void openHistory(item)}
                          aria-label={`ดูประวัติ ${item.title}`}
                          title="ประวัติการแก้ไข"
                        >
                          <BarChart2 size={15} />
                        </button>
                        {isManagerRole(currentUser.role) && (
                          <button
                            className="delete-action"
                            type="button"
                            disabled={!status?.connected || source === "demo"}
                            onClick={() => void deleteItem(item)}
                            aria-label={`ลบ ${item.title}`}
                            title="ลบรายการ"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openMediaPreview(item)}
                          aria-label={`ดูรายละเอียด ${item.title}`}
                          title="เปิดสไลด์ดูรูปภาพในชุดสื่อ"
                        >
                          <MoreVertical size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="library-empty">
                <Search size={27} />
                <h3>ไม่พบสื่อที่ตรงกับเงื่อนไข</h3>
                <p>ลองเปลี่ยนคำค้น เดือน หรือประเภทเหตุการณ์</p>
                {hasActiveMediaFilters && <button type="button" onClick={resetMediaFilters}><RotateCcw size={16} /> ดูสื่อทั้งหมด</button>}
              </div>
            )}

            {filteredItems.length > 0 && (
              <nav className="library-pagination" aria-label="หน้ารายการสื่อ">
                <button
                  type="button"
                  className="page-arrow"
                  onClick={() => setMediaPage((current) => Math.max(1, current - 1))}
                  disabled={activeMediaPage === 1}
                  aria-label="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>
                {paginationPages.map((entry, idx) =>
                  entry === "ellipsis" ? (
                    <span className="page-ellipsis" key={`ellipsis-${idx}`}>
                      ...
                    </span>
                  ) : (
                    <button
                      type="button"
                      key={entry}
                      className={entry === activeMediaPage ? "page-number is-active" : "page-number"}
                      onClick={() => setMediaPage(entry)}
                      aria-current={entry === activeMediaPage ? "page" : undefined}
                    >
                      {entry}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="page-arrow"
                  onClick={() => setMediaPage((current) => Math.min(mediaPageCount, current + 1))}
                  disabled={activeMediaPage === mediaPageCount}
                  aria-label="หน้าถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </section>
        ) : activeTab === "settings" ? (
          <section className="basic-settings-panel" aria-label="จัดการข้อมูลพื้นฐาน">
            <div className="panel-heading">
              <div className="panel-heading-main">
                <span className="panel-icon"><ShieldCheck size={22} /></span>
                <span>
                  <h2>
                    <i className="fa-solid fa-sliders" style={{ marginRight: 8, color: "#0284c7" }} aria-hidden="true" />
                    จัดการข้อมูลพื้นฐานและการตั้งค่าระบบ
                  </h2>
                  <p>กำหนดประเภทเหตุการณ์ (Tag) สีประจำหมวดหมู่ ไอคอน และตรวจสอบระบบ Index ฐานข้อมูล</p>
                </span>
              </div>
            </div>

            <div className="basic-settings-grid">
              <article className="settings-card">
                <div className="settings-card-head">
                  <span className="card-icon">
                    <i className="fa-solid fa-tags" aria-hidden="true" />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <h3>จัดการประเภทเหตุการณ์และสี Tag</h3>
                      <button
                        type="button"
                        className="tag-reset-default-btn"
                        onClick={() => void handleResetDefaultTags()}
                        title="คืนค่า Tag มาตรฐานเริ่มต้น"
                      >
                        <i className="fa-solid fa-rotate-left" aria-hidden="true" /> คืนค่ามาตรฐาน
                      </button>
                    </div>
                    <p>เพิ่ม ลบ เปลี่ยนสี และตั้งค่าไอคอน Tag สำหรับเลือกหลายเหตุการณ์ในฟอร์มสื่อ</p>
                  </div>
                </div>

                <form onSubmit={handleAddCategory} className="tag-creator-box">
                  <div className="add-category-form">
                    <input
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="เช่น วาตภัย, ดินโคลนถล่ม, ภัยแล้ง (คั่นด้วย , เพื่อแยกหลาย Tag ได้)"
                      disabled={addingCategory}
                    />
                    <button type="submit" disabled={addingCategory || !newCategoryName.trim()}>
                      {addingCategory ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
                      เพิ่ม Tag
                    </button>
                  </div>

                  <div className="add-category-ai-bar">
                    <button
                      type="button"
                      className="tag-ai-suggest-btn"
                      disabled={addingCategory || analyzingTagIcon || !newCategoryName.trim()}
                      onClick={() => void handleAiSuggestTagIcon("create")}
                      title="ให้ AI วิเคราะห์ชื่อ Tag และเลือกไอคอน Font Awesome 6 พร้อมสีที่เหมาะสมโดยอัตโนมัติ"
                    >
                      {analyzingTagIcon ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}
                      <span>{analyzingTagIcon ? "AI กำลังวิเคราะห์ไอคอน..." : "🪄 ให้ AI วิเคราะห์ไอคอน Font Awesome"}</span>
                    </button>
                    {newCategoryIcon && (
                      <div className="tag-current-icon-pill">
                        <i className={newCategoryIcon} aria-hidden="true" style={{ color: newCategoryColor }} />
                        <span>{newCategoryIcon}</span>
                      </div>
                    )}
                  </div>

                  <div className="tag-customizer-row">
                    <div className="tag-color-picker-group">
                      <span className="tag-customizer-label">
                        <i className="fa-solid fa-palette" aria-hidden="true" /> เลือกสี Tag:
                      </span>
                      <div className="tag-color-swatches">
                        {TAG_COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            className={
                              newCategoryColor.toLowerCase() === preset.color.toLowerCase()
                                ? "color-swatch-btn is-selected"
                                : "color-swatch-btn"
                            }
                            style={{ backgroundColor: preset.color }}
                            title={preset.label}
                            onClick={() => setNewCategoryColor(preset.color)}
                          />
                        ))}
                        <label className="custom-color-wheel" title="เลือกสีแบบกำหนดเอง">
                          <input
                            type="color"
                            value={newCategoryColor}
                            onChange={(event) => setNewCategoryColor(event.target.value)}
                          />
                          <i className="fa-solid fa-eye-dropper" aria-hidden="true" />
                        </label>
                      </div>
                    </div>

                    <div className="tag-icon-picker-group">
                      <span className="tag-customizer-label">
                        <i className="fa-solid fa-icons" aria-hidden="true" /> ไอคอน:
                      </span>
                      <div className="tag-icon-swatches">
                        {TAG_ICON_PRESETS.map((preset) => (
                          <button
                            key={preset.icon}
                            type="button"
                            className={
                              newCategoryIcon === preset.icon
                                ? "icon-swatch-btn is-selected"
                                : "icon-swatch-btn"
                            }
                            title={preset.label}
                            onClick={() => setNewCategoryIcon(preset.icon)}
                          >
                            <i className={preset.icon} aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {newCategoryName.trim() && (
                      <div className="tag-live-preview-row">
                        <small>ตัวอย่าง Tag ที่จะได้:</small>
                        {parseCategories(newCategoryName).map((previewName, idx) => {
                          const cfg = buildTagConfigFromColor(
                            previewName,
                            idx === 0 ? newCategoryColor : undefined,
                            idx === 0 ? newCategoryIcon : undefined,
                          );
                          return (
                            <span
                              key={previewName}
                              className="event-tag-badge"
                              style={{
                                backgroundColor: cfg.bgColor,
                                color: cfg.textColor,
                                borderColor: cfg.borderColor,
                              }}
                            >
                              <span className="event-tag-dot" style={{ backgroundColor: cfg.color }} />
                              <i className={cfg.icon} aria-hidden="true" />
                              <span>{previewName}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </form>

                {categoryMessage && (
                  <div className={`form-alert ${categoryMessage.type}`} style={{ marginTop: 12 }}>
                    {categoryMessage.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
                    {categoryMessage.text}
                  </div>
                )}

                {editingTagTarget && (
                  <form onSubmit={handleUpdateTagConfig} className="tag-edit-inline-card">
                    <div className="tag-edit-inline-head">
                      <strong>
                        <i className="fa-solid fa-pen-to-square" aria-hidden="true" /> แก้ไข Tag “{editingTagTarget}”
                      </strong>
                      <button
                        type="button"
                        className="tag-edit-cancel"
                        onClick={() => setEditingTagTarget(null)}
                      >
                        <X size={14} /> ปิด
                      </button>
                    </div>

                    <div className="add-category-ai-bar" style={{ marginBottom: 12 }}>
                      <button
                        type="button"
                        className="tag-ai-suggest-btn"
                        disabled={analyzingTagIcon || !editingTagName.trim()}
                        onClick={() => void handleAiSuggestTagIcon("edit")}
                        title="ให้ AI วิเคราะห์ชื่อ Tag และเลือกไอคอน Font Awesome 6 พร้อมสีที่เหมาะสมโดยอัตโนมัติ"
                      >
                        {analyzingTagIcon ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}
                        <span>{analyzingTagIcon ? "AI กำลังวิเคราะห์ไอคอน..." : "🪄 ให้ AI วิเคราะห์ไอคอน Font Awesome"}</span>
                      </button>
                      {editingTagIcon && (
                        <div className="tag-current-icon-pill">
                          <i className={editingTagIcon} aria-hidden="true" style={{ color: editingTagColor }} />
                          <span>{editingTagIcon}</span>
                        </div>
                      )}
                    </div>
                    <div className="tag-edit-inline-controls">
                      <input
                        value={editingTagName}
                        onChange={(event) => setEditingTagName(event.target.value)}
                        placeholder="ชื่อ Tag"
                        required
                      />
                      <div className="tag-color-swatches">
                        {TAG_COLOR_PRESETS.map((preset) => (
                          <button
                            key={`edit-${preset.id}`}
                            type="button"
                            className={
                              editingTagColor.toLowerCase() === preset.color.toLowerCase()
                                ? "color-swatch-btn is-selected"
                                : "color-swatch-btn"
                            }
                            style={{ backgroundColor: preset.color }}
                            title={preset.label}
                            onClick={() => setEditingTagColor(preset.color)}
                          />
                        ))}
                        <label className="custom-color-wheel" title="กำหนดสีเอง">
                          <input
                            type="color"
                            value={editingTagColor}
                            onChange={(event) => setEditingTagColor(event.target.value)}
                          />
                          <i className="fa-solid fa-eye-dropper" aria-hidden="true" />
                        </label>
                      </div>
                      <div className="tag-icon-swatches">
                        {TAG_ICON_PRESETS.map((preset) => (
                          <button
                            key={`edit-icon-${preset.icon}`}
                            type="button"
                            className={
                              editingTagIcon === preset.icon
                                ? "icon-swatch-btn is-selected"
                                : "icon-swatch-btn"
                            }
                            title={preset.label}
                            onClick={() => setEditingTagIcon(preset.icon)}
                          >
                            <i className={preset.icon} aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                      <button type="submit" className="tag-edit-save-btn">
                        <Check size={15} /> บันทึกการตั้งค่า Tag
                      </button>
                    </div>
                  </form>
                )}

                <div className="category-tags-list">
                  {categories.map((cat) => {
                    const cfg = getTagVisual(cat);
                    const count = items.filter((item) =>
                      getItemCategories(item).includes(cat),
                    ).length;
                    return (
                      <span
                        key={cat}
                        className="category-tag-chip is-colored"
                        style={{
                          backgroundColor: cfg.bgColor,
                          color: cfg.textColor,
                          borderColor: cfg.borderColor,
                        }}
                      >
                        <span
                          className="event-tag-dot"
                          style={{ backgroundColor: cfg.color }}
                        />
                        <i className={cfg.icon} aria-hidden="true" />
                        <span>{cat}</span>
                        <small style={{ opacity: 0.82, fontSize: "12px" }}>({count})</small>
                        <button
                          type="button"
                          className="chip-edit-btn"
                          onClick={() => {
                            setEditingTagTarget(cat);
                            setEditingTagName(cat);
                            setEditingTagColor(cfg.color);
                            setEditingTagIcon(cfg.icon);
                          }}
                          title={`เปลี่ยนสี / แก้ไข ${cat}`}
                        >
                          <i className="fa-solid fa-palette" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="chip-remove-btn"
                          onClick={() => void handleDeleteCategory(cat)}
                          title={`ลบ Tag ${cat}`}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </article>

              <article className="settings-card">
                <div className="settings-card-head">
                  <span className="card-icon"><FolderCheck size={20} /></span>
                  <div>
                    <h3>สถานะระบบ, Google Integration & Database Index</h3>
                    <p>พื้นที่เก็บข้อมูลสื่อและระบบดัชนีแคชความเร็วสูง (Fast Memory & Edge Index)</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                  <div><strong><i className="fa-brands fa-google-drive" style={{ color: "#0284c7", marginRight: 6 }} />Google Drive Folder:</strong> {status?.folderName || "คลังสื่อสารความเสี่ยง สสจ.สตูล"}</div>
                  <div><strong><i className="fa-solid fa-table" style={{ color: "#059669", marginRight: 6 }} />Google Sheet:</strong> {status?.sheetName || "ฐานข้อมูลคลังสื่อสารความเสี่ยง สสจ.สตูล"}</div>
                  <div><strong><i className="fa-solid fa-plug-circle-check" style={{ color: "#0d9488", marginRight: 6 }} />สถานะการเชื่อมต่อ:</strong> {status?.connected ? "พร้อมใช้งาน ✅" : "กำลังตรวจสอบการเชื่อมต่อ ⚠️"}</div>
                  <div className="db-index-status-box">
                    <div className="db-index-status-head">
                      <strong>
                        <i className="fa-solid fa-bolt" style={{ color: "#d97706", marginRight: 6 }} />
                        ระบบ Index ฐานข้อมูลความเร็วสูง (SWR + Memory Index)
                      </strong>
                      <span className="index-active-pill">ทำงานอัตโนมัติ</span>
                    </div>
                    <p>
                      จัดทำดัชนีค้นหา (Inverted Search & Multi-Tag Index) แล้วจำนวน{" "}
                      <strong>{items.length} รายการ</strong> และ <strong>{categories.length} Tag</strong>{" "}
                      ช่วยให้หน้าเว็บโหลดข้อมูลทันทีโดยไม่ต้องรอดึง Google Sheets ใหม่ทุกครั้ง
                    </p>
                    <button
                      type="button"
                      className="rebuild-index-btn"
                      onClick={() => void loadItems({ forceRefresh: true })}
                      disabled={itemsLoading}
                    >
                      <RefreshCw className={itemsLoading ? "spin" : ""} size={14} />
                      ซิงก์และอัปเดต Index จากฐานข้อมูลล่าสุด
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>
        ) : (
          <section className="watch-admin-panel" aria-label="จัดการสถานการณ์เฝ้าระวัง">
            {/* Panel Heading */}
            <div className="panel-heading watch-panel-heading">
              <div className="panel-heading-main">
                <span className="panel-badge-pill">
                  <i className="fa-solid fa-tower-broadcast" aria-hidden="true" style={{ color: "#0284c7" }} />
                  ศูนย์ข้อมูลสถานการณ์เฝ้าระวัง (Citizen Surveillance Control)
                </span>
                <h2>กำหนดและจัดการสถานการณ์ที่ต้องเฝ้าระวัง</h2>
                <p>
                  กำหนดเหตุการณ์สำคัญที่ต้องเฝ้าระวังในสตูล เช่น น้ำท่วม โรคติดต่อ หรือภัยสุขภาพ เพื่อให้ประชาชนตระหนักรู้และรับมือได้ทันท่วงที
                </p>
              </div>
              <div className="panel-heading-actions">
                <button
                  type="button"
                  className="watch-action-btn watch-btn-reset"
                  onClick={() => {
                    setWatchDraft(watchConfig);
                    setWatchMessage({ type: "success", text: "คืนค่าตามที่บันทึกไว้ล่าสุดเรียบร้อยแล้ว" });
                  }}
                  disabled={watchSaving}
                  title="คืนค่าเดิมก่อนแก้ไข"
                >
                  <RotateCcw size={16} /> คืนค่าเดิม
                </button>
                <button
                  type="button"
                  className="watch-action-btn watch-btn-save-prominent"
                  onClick={handleSaveWatchSituation}
                  disabled={watchSaving}
                >
                  <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                  <span>{watchSaving ? "กำลังบันทึกข้อมูล..." : "บันทึกการตั้งค่าเฝ้าระวัง"}</span>
                </button>
              </div>
            </div>

            {watchMessage && (
              <div className={`admin-feedback-banner ${watchMessage.type}`}>
                {watchMessage.type === "success" ? (
                  <Check size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                <span>{watchMessage.text}</span>
              </div>
            )}

            <div className="watch-admin-layout">
              {/* Section 1: สถานะและการแจ้งเตือน (Status & Level) */}
              <div className="watch-card-container">
                <div className="watch-card-header">
                  <div className="watch-header-left">
                    <span className="watch-header-icon-box bg-rose">
                      <i className="fa-solid fa-power-off" aria-hidden="true" />
                    </span>
                    <div>
                      <h3>สถานะการแสดงผล และ ระดับการแจ้งเตือน (Status & Level)</h3>
                      <p>ควบคุมการเปิด/ปิด แบนเนอร์เฝ้าระวังบนหน้าแรก และเลือกระดับความรุนแรงของสถานการณ์</p>
                    </div>
                  </div>
                </div>

                <div className="watch-card-body">
                  {/* Toggle switch */}
                  <div className="watch-toggle-box">
                    <label className="watch-switch-control">
                      <input
                        type="checkbox"
                        checked={watchDraft.enabled}
                        onChange={(e) => setWatchDraft({ ...watchDraft, enabled: e.target.checked })}
                      />
                      <span className="watch-switch-slider" />
                    </label>
                    <div className="watch-switch-info">
                      <div className="watch-switch-status">
                        <strong>สถานะการแสดงผล : </strong>
                        <span className={watchDraft.enabled ? "badge-status-on" : "badge-status-off"}>
                          <i className={watchDraft.enabled ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"} />
                          {watchDraft.enabled ? "เปิดแสดงผลบนหน้าแรก (ACTIVE)" : "ปิดการแสดงผล (HIDDEN)"}
                        </span>
                      </div>
                      <p>
                        {watchDraft.enabled
                          ? "ประชาชนทุกคนที่เข้าสู่หน้าแรกของเว็บไซต์จะเห็นแบนเนอร์แจ้งเตือนสถานการณ์นี้อย่างเด่นชัดทันที"
                          : "ซ่อนกล่องสถานการณ์เฝ้าระวัง ประชาชนจะไม่เห็นแบนเนอร์นี้บนหน้าแรก"}
                      </p>
                    </div>
                  </div>

                  {/* Severity selection */}
                  <div className="watch-field-box">
                    <div className="watch-field-title-row">
                      <label className="watch-field-label">
                        <i className="fa-solid fa-triangle-exclamation" style={{ color: "#d97706", marginRight: 6 }} />
                        ระดับความรุนแรงของสถานการณ์ (Severity Level) :
                      </label>
                      <span className="watch-field-hint">คลิกเลือกปุ่มระดับที่ต้องการ</span>
                    </div>

                    <div className="watch-severity-btn-grid">
                      {(["watch", "warning", "critical"] as WatchSeverity[]).map((sev) => {
                        const meta = SEVERITY_META[sev];
                        const isSelected = watchDraft.severity === sev;
                        return (
                          <button
                            key={sev}
                            type="button"
                            className={`watch-severity-card-btn sev-${sev}${isSelected ? " is-selected" : ""}`}
                            onClick={() => setWatchDraft({ ...watchDraft, severity: sev })}
                          >
                            <div className="sev-btn-top">
                              <span className="sev-radio-circle">
                                {isSelected && <span className="sev-radio-dot" />}
                              </span>
                              <i className={`${meta.icon} sev-icon`} aria-hidden="true" />
                            </div>
                            <strong className="sev-btn-title">{meta.badgeText}</strong>
                            <span className="sev-btn-desc">
                              {sev === "watch"
                                ? "เฝ้าระวังปกติ / แจ้งเตือนทั่วไป"
                                : sev === "warning"
                                ? "เฝ้าระวังใกล้ชิด / เตรียมพร้อมรับมือ"
                                : "สถานการณ์ฉุกเฉิน / วิกฤตสูงสุด"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: ข้อมูลสถานการณ์ (Situation Content) */}
              <div className="watch-card-container">
                <div className="watch-card-header">
                  <div className="watch-header-left">
                    <span className="watch-header-icon-box bg-sky">
                      <i className="fa-solid fa-bullhorn" aria-hidden="true" />
                    </span>
                    <div>
                      <h3>ข้อมูลสถานการณ์ (Situation Content)</h3>
                      <p>กำหนดข้อความหัวข้อ สรุปสถานการณ์ พื้นที่ ช่วงเหตุการณ์ และหมวดหมู่ที่เกี่ยวข้อง</p>
                    </div>
                  </div>
                </div>

                <div className="watch-card-body">
                  {/* Field 1: หัวข้อสถานการณ์ */}
                  <div className="watch-modular-field">
                    <div className="modular-field-head">
                      <span className="field-icon-tag bg-blue">
                        <i className="fa-solid fa-heading" aria-hidden="true" />
                      </span>
                      <div className="modular-field-meta">
                        <label htmlFor="watch-title-input" className="modular-field-title">
                          หัวข้อสถานการณ์เฝ้าระวัง (Headline Title) <span className="req-star">*</span>
                        </label>
                        <span className="modular-field-sub">ข้อความพาดหัวหลักที่จะปรากฏขนาดใหญ่ที่สุดบนแบนเนอร์หน้าแรก</span>
                      </div>
                    </div>
                    <div className="modular-input-container">
                      <div className="input-with-icon">
                        <i className="fa-solid fa-pen-nib input-prefix-icon" aria-hidden="true" />
                        <input
                          id="watch-title-input"
                          className="modular-text-input"
                          value={watchDraft.title}
                          onChange={(e) => setWatchDraft({ ...watchDraft, title: e.target.value })}
                          placeholder="เช่น เฝ้าระวังสถานการณ์ฝนตกหนัก น้ำท่วมฉับพลัน และโรคที่มากับน้ำ"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Field 2: สรุปสาระสำคัญ */}
                  <div className="watch-modular-field">
                    <div className="modular-field-head">
                      <span className="field-icon-tag bg-amber">
                        <i className="fa-solid fa-align-left" aria-hidden="true" />
                      </span>
                      <div className="modular-field-meta">
                        <label htmlFor="watch-subtitle-input" className="modular-field-title">
                          สรุปสาระสำคัญของสถานการณ์ (Situation Summary)
                        </label>
                        <span className="modular-field-sub">สรุปสถานการณ์โดยย่อ 1-2 ประโยค เพื่อให้ประชาชนเข้าใจความเสี่ยงได้อย่างรวดเร็ว</span>
                      </div>
                    </div>
                    <div className="modular-input-container">
                      <textarea
                        id="watch-subtitle-input"
                        className="modular-textarea"
                        rows={2}
                        value={watchDraft.subtitle}
                        onChange={(e) => setWatchDraft({ ...watchDraft, subtitle: e.target.value })}
                        placeholder="สรุปสาระสำคัญ เช่น ขอให้ประชาชนในพื้นที่ลุ่มต่ำริมคลองสายหลักระมัดระวังน้ำท่วมฉับพลัน และเตรียมยกของขึ้นที่สูง"
                      />
                    </div>
                  </div>

                  {/* Field 3: พื้นที่ และ ช่วงเหตุการณ์ (2 Columns) */}
                  <div className="watch-split-fields-grid">
                    {/* 3A: พื้นที่เฝ้าระวัง */}
                    <div className="watch-modular-field">
                      <div className="modular-field-head">
                        <span className="field-icon-tag bg-emerald">
                          <i className="fa-solid fa-map-location-dot" aria-hidden="true" />
                        </span>
                        <div className="modular-field-meta">
                          <label htmlFor="watch-loc-input" className="modular-field-title">
                            พื้นที่เฝ้าระวัง (Target Area)
                          </label>
                          <span className="modular-field-sub">ระบุอำเภอ ตำบล หรือพื้นที่เสี่ยง</span>
                        </div>
                      </div>
                      <div className="modular-input-container">
                        <div className="input-with-icon">
                          <i className="fa-solid fa-location-dot input-prefix-icon" aria-hidden="true" />
                          <input
                            id="watch-loc-input"
                            className="modular-text-input"
                            value={watchDraft.location}
                            onChange={(e) => setWatchDraft({ ...watchDraft, location: e.target.value })}
                            placeholder="เช่น ทุกอำเภอในจังหวัดสตูล หรือ อ.ละงู, อ.ควนโดน"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3B: ช่วงเหตุการณ์ */}
                    <div className="watch-modular-field">
                      <div className="modular-field-head">
                        <span className="field-icon-tag bg-indigo">
                          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
                        </span>
                        <div className="modular-field-meta">
                          <label htmlFor="watch-phase-select" className="modular-field-title">
                            ช่วงเหตุการณ์ (Incident Phase)
                          </label>
                          <span className="modular-field-sub">เลือกช่วงเวลาเพื่อคัดกรองสื่อที่ตรงกัน</span>
                        </div>
                      </div>
                      <div className="modular-input-container">
                        <div className="input-with-icon">
                          <i className="fa-solid fa-layer-group input-prefix-icon" aria-hidden="true" />
                          <select
                            id="watch-phase-select"
                            className="modular-select-input"
                            value={watchDraft.phase}
                            onChange={(e) => setWatchDraft({ ...watchDraft, phase: e.target.value as any })}
                          >
                            <option value="all">🌟 ทุกช่วงเหตุการณ์ (ทั้งหมด)</option>
                            <option value="before">🛡️ 01 ก่อนเกิดเหตุ (การเตรียมความพร้อม/ป้องกัน)</option>
                            <option value="during">⚠️ 02 ระหว่างเกิดเหตุ (การรับมือ/ปฏิบัติตัว)</option>
                            <option value="after">📋 03 หลังเกิดเหตุ (การฟื้นฟู/ดูแลสุขภาพ)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Field 4: ประเภทเหตุการณ์ / Multi-tags */}
                  <div className="watch-modular-field">
                    <div className="modular-field-head">
                      <span className="field-icon-tag bg-purple">
                        <i className="fa-solid fa-tags" aria-hidden="true" />
                      </span>
                      <div className="modular-field-meta">
                        <label className="modular-field-title">
                          ประเภทเหตุการณ์ / Tag ที่เกี่ยวข้อง (Incident Categories)
                        </label>
                        <span className="modular-field-sub">
                          คลิกเพื่อเลือกหรือยกเลิก Tag ที่เกี่ยวข้อง (เลือกได้มากกว่า 1 ประเภท เพื่อเชื่อมโยงสื่อที่ตรงกัน)
                        </span>
                      </div>
                      <span className="tag-count-indicator">
                        เลือกแล้ว <strong>{watchDraft.categories.length}</strong> ประเภท
                      </span>
                    </div>

                    <div className="modular-input-container tag-chips-container">
                      <div className="watch-interactive-tags-grid">
                        {categories.map((catName) => {
                          const isSelected = watchDraft.categories.includes(catName);
                          const cfg = resolveTagConfig(catName, tagConfigs);
                          return (
                            <button
                              key={catName}
                              type="button"
                              className={`watch-tag-interactive-btn${isSelected ? " is-active" : ""}`}
                              style={{
                                borderColor: isSelected ? cfg.borderColor : "#cbd5e1",
                                backgroundColor: isSelected ? cfg.bgColor : "#ffffff",
                                color: isSelected ? cfg.textColor : "#475569",
                                boxShadow: isSelected ? `0 2px 8px ${cfg.borderColor}55` : "0 1px 3px rgba(0,0,0,0.06)",
                              }}
                              onClick={() => {
                                const next = isSelected
                                  ? watchDraft.categories.filter((c) => c !== catName)
                                  : [...watchDraft.categories, catName];
                                setWatchDraft({ ...watchDraft, categories: next });
                              }}
                            >
                              <span className="tag-check-indicator">
                                {isSelected ? <Check size={13} /> : <Plus size={13} />}
                              </span>
                              <i className={cfg.icon} aria-hidden="true" />
                              <span className="tag-btn-name">{catName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Field 5: ข้อความคำแนะนำสำหรับประชาชน */}
                  <div className="watch-modular-field">
                    <div className="modular-field-head">
                      <span className="field-icon-tag bg-teal">
                        <i className="fa-solid fa-list-check" aria-hidden="true" />
                      </span>
                      <div className="modular-field-meta">
                        <label htmlFor="watch-advisory-input" className="modular-field-title">
                          คำแนะนำการปฏิบัติตัวสำหรับประชาชน (Citizen Advisory)
                        </label>
                        <span className="modular-field-sub">
                          พิมพ์คำแนะนำทีละบรรทัด ระบบจะแปลงเป็นรายการข้อปฏิบัติพร้อม Bullet Point และอิโมจิให้โดยอัตโนมัติ
                        </span>
                      </div>
                    </div>

                    <div className="advisory-quick-toolbar">
                      <span className="quick-toolbar-label">
                        <i className="fa-solid fa-wand-magic-sparkles" style={{ color: "#0284c7" }} /> ปุ่มลัดแทรกคำแนะนำด่วน :
                      </span>
                      <div className="quick-buttons-row">
                        <button
                          type="button"
                          className="advisory-snippet-btn"
                          onClick={() => {
                            const line = "• 🌧️ ติดตามพยากรณ์อากาศและระดับน้ำในคลองสายหลักอย่างต่อเนื่อง";
                            if (!watchDraft.advisoryText.includes(line)) {
                              setWatchDraft({
                                ...watchDraft,
                                advisoryText: watchDraft.advisoryText ? `${watchDraft.advisoryText}\n${line}` : line,
                              });
                            }
                          }}
                        >
                          + 🌧️ พยากรณ์อากาศ
                        </button>
                        <button
                          type="button"
                          className="advisory-snippet-btn"
                          onClick={() => {
                            const line = "• 🛡️ หลีกเลี่ยงการเดินลุยน้ำขังด้วยเท้าเปล่า ป้องกันโรคฉี่หนูและน้ำกัดเท้า";
                            if (!watchDraft.advisoryText.includes(line)) {
                              setWatchDraft({
                                ...watchDraft,
                                advisoryText: watchDraft.advisoryText ? `${watchDraft.advisoryText}\n${line}` : line,
                              });
                            }
                          }}
                        >
                          + 🛡️ ป้องกันโรคจากน้ำ
                        </button>
                        <button
                          type="button"
                          className="advisory-snippet-btn"
                          onClick={() => {
                            const line = "• 🦟 กำจัดแหล่งเพาะพันธุ์ลูกน้ำยุงลายหลังฝนตก นอนกางมุ้งหรือทายากันยุง";
                            if (!watchDraft.advisoryText.includes(line)) {
                              setWatchDraft({
                                ...watchDraft,
                                advisoryText: watchDraft.advisoryText ? `${watchDraft.advisoryText}\n${line}` : line,
                              });
                            }
                          }}
                        >
                          + 🦟 ไข้เลือดออก/ยุงลาย
                        </button>
                        <button
                          type="button"
                          className="advisory-snippet-btn"
                          onClick={() => {
                            const line = "• 🆘 หากพบเหตุฉุกเฉินหรือเจ็บป่วยเร่งด่วน กดปุ่มขอความช่วยเหลือ หรือโทรสายด่วน 1669 ฟรี 24 ชม.";
                            if (!watchDraft.advisoryText.includes(line)) {
                              setWatchDraft({
                                ...watchDraft,
                                advisoryText: watchDraft.advisoryText ? `${watchDraft.advisoryText}\n${line}` : line,
                              });
                            }
                          }}
                        >
                          + 🆘 สายด่วน 1669
                        </button>
                      </div>
                    </div>

                    <div className="modular-input-container">
                      <textarea
                        id="watch-advisory-input"
                        className="modular-textarea"
                        rows={5}
                        value={watchDraft.advisoryText}
                        onChange={(e) => setWatchDraft({ ...watchDraft, advisoryText: e.target.value })}
                        placeholder="• 🌧️ ติดตามพยากรณ์อากาศและระดับน้ำต่อเนื่อง&#10;• 🛡️ หลีกเลี่ยงการเดินลุยน้ำขังด้วยเท้าเปล่า&#10;• 🦟 กำจัดแหล่งเพาะพันธุ์ยุงลาย&#10;• 🆘 เจ็บป่วยฉุกเฉินโทร 1669"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: สื่อแนะนำในสถานการณ์นี้ (Recommended Media) */}
              <div className="watch-card-container">
                <div className="watch-card-header">
                  <div className="watch-header-left">
                    <span className="watch-header-icon-box bg-cyan">
                      <i className="fa-solid fa-photo-film" aria-hidden="true" />
                    </span>
                    <div>
                      <h3>สื่อแนะนำในสถานการณ์นี้ (Recommended Media)</h3>
                      <p>ค้นหาและกรองตามประเภทเหตุการณ์ เพื่อเลือกสื่อจากคลังสื่อ (สูงสุด 4 รายการ) สำหรับปักหมุดบนหน้าแรก</p>
                    </div>
                  </div>
                  <div className="pinned-count-badge-wrapper">
                    <span className={`pinned-count-pill ${watchDraft.pinnedMediaIds.length >= 4 ? "is-full" : ""}`}>
                      <i className="fa-solid fa-thumbtack" /> ปักหมุดแล้ว {watchDraft.pinnedMediaIds.length} / 4 รายการ
                    </span>
                    {watchDraft.pinnedMediaIds.length > 0 && (
                      <button
                        type="button"
                        className="pinned-clear-btn"
                        onClick={() => setWatchDraft({ ...watchDraft, pinnedMediaIds: [] })}
                        title="ยกเลิกการปักหมุดทั้งหมด"
                      >
                        <RotateCcw size={13} /> ล้างทั้งหมด
                      </button>
                    )}
                  </div>
                </div>

                <div className="watch-card-body">
                  {/* Pinned Media List (Cards currently selected) */}
                  <div className="pinned-selected-section">
                    <div className="pinned-section-title">
                      <i className="fa-solid fa-thumbtack text-cyan" />
                      <span>รายการสื่อที่ปักหมุดแสดงผล ({watchDraft.pinnedMediaIds.length}/4)</span>
                    </div>

                    {watchDraft.pinnedMediaIds.length === 0 ? (
                      <div className="empty-pinned-banner">
                        <i className="fa-solid fa-circle-info" />
                        <div>
                          <strong>ยังไม่ได้เลือกสื่อเจาะจง</strong>
                          <span>ระบบจะสุ่มและเลือกสื่อที่ตรงกับประเภทเหตุการณ์และช่วงเวลาของสถานการณ์มาแสดงให้อัตโนมัติ</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pinned-media-items-grid">
                        {watchDraft.pinnedMediaIds.map((id) => {
                          const item = items.find((i) => i.id === id);
                          const itemCats = item ? getItemCategories(item) : [];
                          return (
                            <div key={id} className="pinned-media-card-item">
                              <div className="pinned-card-thumb">
                                {(item?.thumbnailUrl || item?.downloadUrl) ? (
                                  <img
                                    src={optimizeThumbnailUrl(item?.thumbnailUrl || item?.downloadUrl || "", 120)}
                                    alt={item.title || "สื่อ"}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="pinned-thumb-fallback">
                                    <FileImage size={24} />
                                  </div>
                                )}
                              </div>
                              <div className="pinned-card-info">
                                <strong>{item ? item.title : `รหัสสื่อ: ${id}`}</strong>
                                <div className="pinned-card-tags">
                                  {itemCats.map((cat) => {
                                    const conf = resolveTagConfig(cat, tagConfigs);
                                    return (
                                      <span
                                        key={cat}
                                        className="pinned-cat-tag"
                                        style={{ backgroundColor: `${conf.color}18`, color: conf.color, borderColor: `${conf.color}40` }}
                                      >
                                        <i className={`${conf.icon} tag-fa-icon`} /> {cat}
                                      </span>
                                    );
                                  })}
                                  {item?.location && <span className="pinned-loc-tag"><i className="fa-solid fa-location-dot" /> {item.location}</span>}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="pinned-card-del-btn"
                                onClick={() =>
                                  setWatchDraft({
                                    ...watchDraft,
                                    pinnedMediaIds: watchDraft.pinnedMediaIds.filter((pId) => pId !== id),
                                  })
                                }
                                title="ลบออกจากสื่อแนะนำ"
                              >
                                <Trash2 size={14} /> <span>ลบ</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Filter & Search Bar for Fast Media Selection */}
                  <div className="rec-media-filter-container">
                    <div className="rec-filter-header">
                      <div className="rec-filter-title">
                        <i className="fa-solid fa-filter text-blue" />
                        <span>กรองประเภทเหตุการณ์ และ ค้นหาสื่อที่ต้องการปักหมุด</span>
                      </div>
                      <span className="rec-filter-results-count">
                        พบ <strong>{filteredRecMediaItems.length}</strong> สื่อ
                      </span>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="rec-category-pills-row">
                      <button
                        type="button"
                        className={`rec-cat-pill ${recMediaCategory === "all" ? "is-active" : ""}`}
                        onClick={() => setRecMediaCategory("all")}
                      >
                        <i className="fa-solid fa-layer-group" /> ทั้งหมด ({items.length})
                      </button>
                      {availableRecCategories.map((cat) => {
                        const conf = resolveTagConfig(cat, tagConfigs);
                        const isSelected = recMediaCategory === cat;
                        const count = items.filter((item) => getItemCategories(item).includes(cat)).length;
                        return (
                          <button
                            key={cat}
                            type="button"
                            className={`rec-cat-pill ${isSelected ? "is-active" : ""}`}
                            style={
                              isSelected
                                ? { backgroundColor: conf.color, color: "#ffffff", borderColor: conf.color }
                                : { color: conf.color, borderColor: `${conf.color}40` }
                            }
                            onClick={() => setRecMediaCategory(cat)}
                          >
                            <i className={`${conf.icon} tag-fa-icon`} /> {cat} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {/* Search and Phase Filters */}
                    <div className="rec-search-phase-row">
                      <div className="rec-search-box input-with-icon">
                        <i className="fa-solid fa-magnifying-glass input-prefix-icon" aria-hidden="true" />
                        <input
                          type="text"
                          className="modular-text-input"
                          placeholder="ค้นหาชื่อสื่อ, รายละเอียด, อำเภอ..."
                          value={recMediaSearch}
                          onChange={(e) => setRecMediaSearch(e.target.value)}
                        />
                        {recMediaSearch && (
                          <button
                            type="button"
                            className="rec-search-clear-btn"
                            onClick={() => setRecMediaSearch("")}
                            title="ล้างข้อความค้นหา"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <div className="rec-phase-filter-box">
                        <span className="rec-phase-label">ช่วงเวลา:</span>
                        <div className="rec-phase-btn-group">
                          {[
                            { value: "all", label: "ทั้งหมด" },
                            { value: "before", label: "ก่อนเกิดเหตุ" },
                            { value: "during", label: "ระหว่างเกิดเหตุ" },
                            { value: "after", label: "หลังเกิดเหตุ" },
                          ].map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              className={`rec-phase-pill ${recMediaPhase === p.value ? "is-active" : ""}`}
                              onClick={() => setRecMediaPhase(p.value)}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Visual Media Picker Cards Grid */}
                    <div className="rec-media-cards-grid">
                      {filteredRecMediaItems.length === 0 ? (
                        <div className="rec-empty-filter-state">
                          <i className="fa-solid fa-folder-open" />
                          <p>ไม่พบสื่อที่ตรงกับเงื่อนไขการค้นหา/หมวดหมู่ที่เลือก</p>
                          <button
                            type="button"
                            className="rec-reset-filter-btn"
                            onClick={() => {
                              setRecMediaCategory("all");
                              setRecMediaPhase("all");
                              setRecMediaSearch("");
                            }}
                          >
                            <RotateCcw size={13} /> ล้างตัวกรองทั้งหมด
                          </button>
                        </div>
                      ) : (
                        filteredRecMediaItems.slice(0, 12).map((item) => {
                          const isPinned = watchDraft.pinnedMediaIds.includes(item.id);
                          const isFull = watchDraft.pinnedMediaIds.length >= 4;
                          const itemCats = getItemCategories(item);
                          const primaryCat = itemCats[0] || item.category || "ทั่วไป";
                          const conf = resolveTagConfig(primaryCat, tagConfigs);

                          return (
                            <div key={item.id} className={`rec-media-picker-card ${isPinned ? "is-pinned" : ""}`}>
                              <div className="rec-card-image-wrap">
                                {(item.thumbnailUrl || item.downloadUrl) ? (
                                  <img
                                    src={optimizeThumbnailUrl(item.thumbnailUrl || item.downloadUrl || "", 240)}
                                    alt={item.title}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="rec-card-thumb-fallback">
                                    <FileImage size={32} />
                                  </div>
                                )}
                                <span
                                  className="rec-card-cat-badge"
                                  style={{ backgroundColor: conf.color }}
                                >
                                  <i className={`${conf.icon} tag-fa-icon`} /> {primaryCat}
                                </span>
                              </div>
                              <div className="rec-card-content">
                                <h4 className="rec-card-title" title={item.title}>
                                  {item.title}
                                </h4>
                                <div className="rec-card-meta">
                                  <span><i className="fa-solid fa-location-dot" /> {item.location || "สตูล"}</span>
                                  <span className="rec-card-phase-dot">
                                    {item.phase === "before" ? "ก่อนเกิดเหตุ" : item.phase === "during" ? "ระหว่างเกิดเหตุ" : "หลังเกิดเหตุ"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className={`rec-card-action-btn ${
                                    isPinned ? "is-pinned" : isFull ? "is-disabled" : "is-select"
                                  }`}
                                  disabled={!isPinned && isFull}
                                  onClick={() => {
                                    if (isPinned) {
                                      setWatchDraft({
                                        ...watchDraft,
                                        pinnedMediaIds: watchDraft.pinnedMediaIds.filter((id) => id !== item.id),
                                      });
                                    } else if (!isFull) {
                                      setWatchDraft({
                                        ...watchDraft,
                                        pinnedMediaIds: [...watchDraft.pinnedMediaIds, item.id],
                                      });
                                    }
                                  }}
                                >
                                  {isPinned ? (
                                    <>
                                      <i className="fa-solid fa-check" /> <span>ปักหมุดแล้ว</span>
                                    </>
                                  ) : isFull ? (
                                    <>
                                      <i className="fa-solid fa-ban" /> <span>ครบ 4 รายการแล้ว</span>
                                    </>
                                  ) : (
                                    <>
                                      <i className="fa-solid fa-plus" /> <span>+ ปักหมุดสื่อนี้</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {filteredRecMediaItems.length > 12 && (
                      <div className="rec-media-more-hint">
                        <span>แสดง 12 จากทั้งหมด {filteredRecMediaItems.length} รายการ (ใช้ช่องค้นหาด้านบนเพื่อค้นหาสื่ออื่น ๆ เพิ่มเติม)</span>
                      </div>
                    )}

                    {/* Quick Dropdown Fallback */}
                    <div className="rec-quick-dropdown-row">
                      <label htmlFor="pinned-media-select" className="rec-dropdown-label">
                        <i className="fa-solid fa-list-check" /> หรือเลือกจากรายการย่อ ({filteredRecMediaItems.length} รายการ):
                      </label>
                      <select
                        id="pinned-media-select"
                        className="modular-select-input"
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) return;
                          if (!watchDraft.pinnedMediaIds.includes(id)) {
                            if (watchDraft.pinnedMediaIds.length >= 4) {
                              alert("สามารถปักหมุดสื่อได้สูงสุด 4 รายการ กรุณาลบสื่อที่ไม่ต้องการออกก่อน");
                              e.target.value = "";
                              return;
                            }
                            setWatchDraft({
                              ...watchDraft,
                              pinnedMediaIds: [...watchDraft.pinnedMediaIds, id],
                            });
                          }
                          e.target.value = "";
                        }}
                        defaultValue=""
                      >
                        <option value="">-- เลือกสื่อจากรายการที่กรองไว้เพื่อปักหมุด --</option>
                        {filteredRecMediaItems.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                            disabled={watchDraft.pinnedMediaIds.includes(item.id)}
                          >
                            {watchDraft.pinnedMediaIds.includes(item.id) ? "✓ [ปักหมุดแล้ว] " : "+ "}
                            {item.title} ({item.location || "สตูล"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Full-width Live Preview Section */}
              <div className="watch-card-container preview-section-container">
                <div className="watch-card-header preview-header-row">
                  <div className="watch-header-left">
                    <span className="watch-header-icon-box bg-purple">
                      <Eye size={20} />
                    </span>
                    <div>
                      <h3>ตัวอย่างการแสดงผลจริงบนหน้าแรก (Live Preview)</h3>
                      <p>หน้าตาของกล่องแจ้งเตือนสถานการณ์เฝ้าระวังที่ประชาชนจะมองเห็นบนหน้าแรกของเว็บไซต์</p>
                    </div>
                  </div>
                  <div className="preview-device-switcher">
                    <button
                      type="button"
                      className={`device-btn${watchPreviewDevice === "desktop" ? " is-active" : ""}`}
                      onClick={() => setWatchPreviewDevice("desktop")}
                    >
                      <i className="fa-solid fa-desktop" /> หน้าจอคอม (Desktop)
                    </button>
                    <button
                      type="button"
                      className={`device-btn${watchPreviewDevice === "mobile" ? " is-active" : ""}`}
                      onClick={() => setWatchPreviewDevice("mobile")}
                    >
                      <i className="fa-solid fa-mobile-screen" /> มือถือ (Mobile 390px)
                    </button>
                  </div>
                </div>

                <div className="watch-card-body preview-stage-wrapper">
                  <div className={`preview-viewport-frame viewport-${watchPreviewDevice}`}>
                    <WatchSituationBanner
                      config={watchDraft}
                      mediaItems={selectWatchMediaItems(items, watchDraft, 4)}
                      tagConfigs={tagConfigs}
                      onOpenMedia={() => {}}
                      onOpenService={() => {}}
                      onViewAll={() => {}}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className="watch-sticky-footer-bar">
                <div className="sticky-bar-info">
                  <span className="sticky-status-indicator">
                    <span className={watchDraft.enabled ? "live-dot on" : "live-dot off"} />
                    สถานะ: <strong>{watchDraft.enabled ? "เปิดแสดงผลหน้าแรก (ACTIVE)" : "ปิดการแสดงผล (HIDDEN)"}</strong>
                  </span>
                  <span className="sticky-divider">|</span>
                  <span>
                    ความรุนแรง: <strong>{SEVERITY_META[watchDraft.severity].badgeText}</strong>
                  </span>
                </div>

                <div className="sticky-bar-actions">
                  <button
                    type="button"
                    className="watch-action-btn watch-btn-reset"
                    onClick={() => {
                      setWatchDraft(watchConfig);
                      setWatchMessage({ type: "success", text: "คืนค่าตามที่บันทึกไว้ล่าสุดเรียบร้อยแล้ว" });
                    }}
                    disabled={watchSaving}
                  >
                    <RotateCcw size={16} /> คืนค่าเดิม
                  </button>
                {watchMessage && (
                  <div className={`admin-feedback-banner ${watchMessage.type}`} style={{ width: "100%", marginBottom: 12 }}>
                    {watchMessage.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
                    <span>{watchMessage.text}</span>
                  </div>
                )}
                  <button
                    type="button"
                    className="watch-action-btn watch-btn-save-prominent large"
                    onClick={handleSaveWatchSituation}
                    disabled={watchSaving}
                  >
                    <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                    <span>{watchSaving ? "กำลังบันทึกข้อมูล..." : "บันทึกการตั้งค่าเฝ้าระวัง"}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <section className="trust-section">
        <div className="container trust-grid">
          <div className="trust-copy">
            <span className="section-kicker">OUR VALUE</span>
            <h2>ข้อมูลที่ชัดเจน<br />ช่วยให้ชุมชนตัดสินใจได้ดีขึ้น</h2>
            <p>
              ร่วมสร้างสังคมสุขภาพดี ด้วยสื่อสารความเสี่ยงที่ถูกต้อง เชื่อถือได้
              เพื่อคนสตูลและอนาคตที่ปลอดภัยกว่าเดิม
            </p>
          </div>
          <div className="trust-points">
            <div className="trust-point-card">
              <span className="trust-icon-ring"><ShieldCheck size={24} /></span>
              <strong>ถูกต้องและเชื่อถือได้</strong>
              <small>ผ่านการตรวจสอบจากสำนักงานสาธารณสุขจังหวัดสตูล</small>
            </div>
            <div className="trust-point-card">
              <span className="trust-icon-ring"><Share2 size={24} /></span>
              <strong>นำไปใช้และแชร์ได้ง่าย</strong>
              <small>หลากหลายรูปแบบสื่อ พร้อมดาวน์โหลดทันที</small>
            </div>
            <div className="trust-point-card">
              <span className="trust-icon-ring"><MapPin size={24} /></span>
              <strong>ตอบโจทย์พื้นที่</strong>
              <small>เนื้อหาที่เหมาะสมกับบริบทของจังหวัดสตูล</small>
            </div>
          </div>
        </div>
      </section>

      <EocFooterPanel />

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <span className="brand-mark">
              <img src="/satun-risk-logo.png" alt="" aria-hidden="true" />
            </span>
            <div><strong>คลังสื่อสารความเสี่ยง</strong><small>สำนักงานสาธารณสุขจังหวัดสตูล</small></div>
          </div>
          <div className="footer-center">
            <nav className="footer-nav footer-nav-links" aria-label="ลิงก์ส่วนท้าย">
              <Link href="/">หน้าแรก</Link>
              <Link href="/#phases">ข้อมูลสถานการณ์</Link>
              <Link href="/#gallery">คลังสื่อ</Link>
              <Link href="/#about">เกี่ยวกับเรา</Link>
              <Link href="/developers">API สำหรับนักพัฒนา <Braces size={14} /></Link>
              <Link href="/admin">เข้าสู่ระบบผู้ดูแล <ArrowRight size={14} /></Link>
            </nav>
            <div className="footer-credit">
              <p>จัดทำโดย นายอรรฆพร ศรีปานรอด นักวิชาการคอมพิวเตอร์ปฏิบัติการ • กลุ่มงานสุขภาพดิจิทัล สำนักงานสาธารณสุขจังหวัดสตูล</p>
            </div>
          </div>
          <div className="footer-actions">
            <span className="visitor-counter" title="นับหนึ่งครั้งต่อการเข้าใช้งานในแต่ละรอบ">
              <Eye size={15} />
              {visitorStats ? (
                <>ผู้เข้าชม {visitorStats.totalViews.toLocaleString("th-TH")} ครั้ง</>
              ) : (
                <>
                  <span className="sr-only">กำลังโหลดยอดผู้เข้าชม</span>
                  <span className="skeleton-block skeleton-visitor-count" aria-hidden="true" />
                </>
              )}
            </span>
            <div className="footer-social" aria-hidden="true">
              <span><Globe size={16} /></span>
              <span><HeartPulse size={16} /></span>
            </div>
          </div>
        </div>
      </footer>

      {showUploadForm && (() => {
        const currentSlideIdx = Math.min(activeUploadSlide, Math.max(0, uploadFiles.length - 1));
        const currentEntry = uploadFiles[currentSlideIdx] ?? null;
        return (
          <div
            className="admin-modal-backdrop"
            onMouseDown={() => !uploading && setShowUploadForm(false)}
          >
            <section
              className="admin-upload-modal"
              id="upload-media-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="upload-media-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="cinematic-modal-header">
                <div className="cinematic-modal-title">
                  <span className="cinematic-modal-icon">
                    <CloudUpload size={22} />
                  </span>
                  <div>
                    <span className="cinematic-modal-kicker">
                      <Sparkles size={13} /> AI-ASSISTED MULTI-IMAGE RISK MEDIA
                    </span>
                    <h2 id="upload-media-title">เพิ่มสื่อใหม่ (รองรับอัปโหลดหลายรูปในหัวข้อเดียว)</h2>
                    <p>เลือกได้หลายรูปภาพพร้อมกันเพื่อให้ผู้ชมสไลด์ดูได้ • วิเคราะห์ข้อมูลจากภาพด้วย AI อัตโนมัติ</p>
                  </div>
                </div>
                <button
                  className="cinematic-modal-close"
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  disabled={uploading}
                  aria-label="ปิดหน้าต่างเพิ่มสื่อใหม่"
                >
                  <X size={18} /> ปิดฟอร์ม
                </button>
              </header>

              <form onSubmit={handleUpload} className="upload-modal-form">
                <fieldset disabled={!status?.connected || uploading}>
                  <input
                    ref={fileInput}
                    type="file"
                    name="files"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    style={{ display: "none" }}
                    onChange={(event) => addUploadFiles(event.target.files, false)}
                  />

                  {uploadFiles.length > 0 && currentEntry ? (
                    <div
                      className="upload-multi-showcase"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        addUploadFiles(event.dataTransfer.files, false);
                      }}
                    >
                      <div className="upload-slide-stage">
                        <div className="upload-slide-badges">
                          <span className="upload-slide-counter">
                            <Images size={13} /> รูปที่ {currentSlideIdx + 1} / {uploadFiles.length}
                          </span>
                          {currentSlideIdx === 0 ? (
                            <span className="upload-cover-badge">
                              <Star size={12} /> ภาพปกหลัก
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="upload-make-cover-btn"
                              onClick={() => makeCoverUploadFile(currentSlideIdx)}
                            >
                              <Star size={12} /> ตั้งเป็นภาพปก
                            </button>
                          )}
                        </div>

                        {uploadFiles.length > 1 && (
                          <>
                            <button
                              type="button"
                              className="upload-slide-nav prev"
                              aria-label="ดูรูปก่อนหน้า"
                              onClick={() =>
                                setActiveUploadSlide(
                                  (currentSlideIdx - 1 + uploadFiles.length) % uploadFiles.length,
                                )
                              }
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <button
                              type="button"
                              className="upload-slide-nav next"
                              aria-label="ดูรูปถัดไป"
                              onClick={() =>
                                setActiveUploadSlide((currentSlideIdx + 1) % uploadFiles.length)
                              }
                            >
                              <ChevronRight size={18} />
                            </button>
                          </>
                        )}

                        <div className="upload-slide-preview-box">
                          {currentEntry.previewUrl ? (
                            <img
                              src={currentEntry.previewUrl}
                              alt={`ตัวอย่างรูปที่ ${currentSlideIdx + 1}`}
                            />
                          ) : (
                            <span className="file-type-badge">
                              <FileText size={36} />
                            </span>
                          )}
                        </div>

                        <div className="upload-slide-bar">
                          <div className="upload-slide-fileinfo">
                            <strong>{currentEntry.file.name}</strong>
                            <small>
                              ต้นฉบับ {formatFileSize(currentEntry.file.size)} • เลือกแล้วทั้งหมด{" "}
                              {uploadFiles.length} ไฟล์
                            </small>
                            {renderCompressionBadge(currentEntry)}
                          </div>
                          <div className="dropzone-file-actions">
                            <button
                              type="button"
                              className="ai-reanalyze-btn"
                              disabled={aiAnalyzing}
                              onClick={() => void analyzeFileWithAi(currentEntry.file)}
                            >
                              {aiAnalyzing ? (
                                <LoaderCircle className="spin" size={15} />
                              ) : (
                                <WandSparkles size={15} />
                              )}
                              <span>
                                {aiAnalyzing ? "กำลังอ่านภาพ..." : "ให้ AI อ่านภาพนี้"}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="upload-add-more-btn"
                              onClick={() => fileInput.current?.click()}
                            >
                              <Plus size={15} /> เพิ่มรูปภาพอีก
                            </button>
                            <button
                              type="button"
                              className="remove-file-btn"
                              aria-label="นำรูปนี้ออก"
                              title="นำรูปนี้ออก"
                              onClick={() => removeUploadFileAt(currentSlideIdx)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {renderCompressionPicker()}

                      <div className="upload-thumbs-strip" aria-label="รายการรูปภาพในสื่อนี้">
                        {uploadFiles.map((entry, idx) => (
                          <div
                            key={entry.id}
                            className={
                              idx === currentSlideIdx
                                ? "upload-thumb-item is-active"
                                : "upload-thumb-item"
                            }
                            onClick={() => setActiveUploadSlide(idx)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setActiveUploadSlide(idx);
                              }
                            }}
                          >
                            {entry.previewUrl ? (
                              <img src={entry.previewUrl} alt={`รูปที่ ${idx + 1}`} />
                            ) : (
                              <FileText size={18} />
                            )}
                            <span className="upload-thumb-index">
                              {idx === 0 ? "ปก" : idx + 1}
                            </span>
                            <button
                              type="button"
                              className="upload-thumb-remove"
                              aria-label={`ลบรูปที่ ${idx + 1}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeUploadFileAt(idx);
                              }}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="upload-thumb-add"
                          onClick={() => fileInput.current?.click()}
                          title="เพิ่มรูปภาพในหัวข้อนี้"
                        >
                          <Plus size={18} />
                          <span>เพิ่มรูป</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="upload-dropzone"
                      onClick={() => fileInput.current?.click()}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        addUploadFiles(event.dataTransfer.files, false);
                      }}
                    >
                      <span><Upload size={27} /></span>
                      <strong>ลากไฟล์รูปภาพมาวาง (เลือกได้หลายรูปพร้อมกัน) หรือคลิกเพื่อเลือกไฟล์</strong>
                      <small>รองรับการอัปโหลดหลายรูปในสื่อเดียวเพื่อให้ผู้ชมสไลด์ดูภาพต่อเนื่อง • ระบบ AI จะอ่านภาพแรกเพื่อเติมข้อมูลให้อัตโนมัติ</small>
                    </div>
                  )}

                  {aiStatusMessage && (
                    <div className={`ai-assist-banner ${aiStatusMessage.type}`} role="status">
                      {aiAnalyzing ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : aiStatusMessage.type === "error" ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <Sparkles size={18} />
                      )}
                      <span>{aiStatusMessage.text}</span>
                    </div>
                  )}

                  {uploadCaptionOptions.length > 0 && (
                    <div className="ai-caption-picker-container">
                      <div className="ai-caption-picker-header">
                        <div className="caption-picker-title">
                          <Sparkles size={16} style={{ color: "#d97706" }} />
                          <strong>ตัวเลือกแคปชั่น 3 แบบจาก AI Copywriter (คลิกเพื่อเลือกใช้):</strong>
                        </div>
                        <span className="caption-picker-badge">3 สไตล์ให้เลือก</span>
                      </div>

                      <div className="ai-caption-cards-grid">
                        {uploadCaptionOptions.map((opt, idx) => (
                          <div
                            key={opt.id || idx}
                            className={`ai-caption-card ${selectedUploadCaptionIdx === idx ? "is-selected" : ""}`}
                            onClick={() => applyUploadCaptionOption(opt, idx)}
                          >
                            <div className="caption-card-top">
                              <span className="caption-card-badge">{opt.name}</span>
                              {selectedUploadCaptionIdx === idx ? (
                                <span className="caption-applied-tag">
                                  <Check size={13} /> ใช้งานอยู่
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="caption-apply-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    applyUploadCaptionOption(opt, idx);
                                  }}
                                >
                                  เลือกใช้แบบนี้
                                </button>
                              )}
                            </div>

                            {opt.hook && <div className="caption-hook-text">"{opt.hook}"</div>}

                            <div className="caption-body-preview">
                              <FormattedDescription text={opt.caption} />
                            </div>

                            {opt.hashtags && opt.hashtags.length > 0 && (
                              <div className="caption-hashtags-row">
                                {opt.hashtags.map((h, i) => (
                                  <span key={i} className="caption-tag-pill">
                                    {h.startsWith("#") ? h : `#${h}`}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

              <div className="form-grid">
                    <label className="field-wide">
                      <span className="fa-form-heading">
                        <span className="fa-field-badge"><i className="fa-solid fa-heading" aria-hidden="true" /></span>
                        <span>ชื่อสื่อ <em>*</em></span>
                      </span>
                      <input
                        name="title"
                        required
                        value={uploadTitle}
                        onChange={(event) => setUploadTitle(event.target.value)}
                        placeholder="เช่น วิธีการป้องกันโรคจากน้ำท่วม"
                      />
                    </label>
                    <label>
                      <span className="fa-form-heading">
                        <span className="fa-field-badge"><i className="fa-solid fa-timeline" aria-hidden="true" /></span>
                        <span>ช่วงเหตุการณ์ <em>*</em></span>
                      </span>
                      <select
                        name="phase"
                        value={uploadPhase}
                        onChange={(event) => setUploadPhase(event.target.value as IncidentPhase)}
                      >
                        <option value="before">ก่อนเกิดเหตุ (เตรียมพร้อม/ป้องกัน)</option>
                        <option value="during">ระหว่างเกิดเหตุ (รับมือฉุกเฉิน)</option>
                        <option value="after">หลังเกิดเหตุ (ฟื้นฟูเยียวยา)</option>
                      </select>
                    </label>
                    <label>
                      <span className="fa-form-heading">
                        <span className="fa-field-badge"><i className="fa-solid fa-calendar-day" aria-hidden="true" /></span>
                        <span>วันที่เหตุการณ์ <em>*</em></span>
                      </span>
                      <input
                        type="date"
                        name="eventDate"
                        required
                        value={uploadEventDate}
                        onChange={(event) => setUploadEventDate(event.target.value)}
                      />
                    </label>

                    <div className="field-wide multi-tag-field-box">
                      <div className="multi-tag-field-header">
                        <span className="fa-form-heading">
                          <span className="fa-field-badge"><i className="fa-solid fa-tags" aria-hidden="true" /></span>
                          <span>ประเภทเหตุการณ์ (Tag) <em>*</em></span>
                        </span>
                        <span className="multi-tag-hint">
                          <i className="fa-solid fa-circle-check" aria-hidden="true" /> เลือกได้มากกว่า 1 เหตุการณ์ (เลือกแล้ว {uploadCategories.length} รายการ)
                        </span>
                      </div>

                      <div className="selected-tags-bar" aria-label="ประเภทเหตุการณ์ที่เลือก">
                        <span className="selected-tags-label">ที่เลือก:</span>
                        {uploadCategories.map((cat) => {
                          const cfg = getTagVisual(cat);
                          return (
                            <span
                              key={`selected-upload-${cat}`}
                              className="event-tag-badge is-selected-pill"
                              style={{
                                backgroundColor: cfg.color,
                                color: "#ffffff",
                                borderColor: cfg.color,
                              }}
                            >
                              <i className={cfg.icon} aria-hidden="true" />
                              <span>{cat}</span>
                              {uploadCategories.length > 1 && (
                                <button
                                  type="button"
                                  className="selected-pill-remove"
                                  onClick={() =>
                                    toggleCategoryTag(cat, uploadCategories, setUploadCategories)
                                  }
                                  title={`นำ ${cat} ออก`}
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>

                      <div className="multi-tag-selector-grid" role="group" aria-label="คลิกเพื่อเลือกประเภทเหตุการณ์">
                        {categories.map((cat) => {
                          const cfg = getTagVisual(cat);
                          const isSelected = uploadCategories.includes(cat);
                          return (
                            <button
                              key={`pick-upload-${cat}`}
                              type="button"
                              className={
                                isSelected
                                  ? "selectable-tag-chip is-selected"
                                  : "selectable-tag-chip"
                              }
                              style={
                                isSelected
                                  ? {
                                      backgroundColor: cfg.bgColor,
                                      color: cfg.textColor,
                                      borderColor: cfg.color,
                                      boxShadow: `0 0 0 2px ${cfg.borderColor}`,
                                    }
                                  : {
                                      backgroundColor: "#ffffff",
                                      color: cfg.textColor,
                                      borderColor: cfg.borderColor,
                                    }
                              }
                              onClick={() =>
                                toggleCategoryTag(cat, uploadCategories, setUploadCategories)
                              }
                              aria-pressed={isSelected}
                            >
                              <span
                                className="event-tag-dot"
                                style={{ backgroundColor: cfg.color }}
                              />
                              <i className={cfg.icon} aria-hidden="true" />
                              <span>{cat}</span>
                              {isSelected && (
                                <span
                                  className="tag-check-mark"
                                  style={{ backgroundColor: cfg.color }}
                                >
                                  <Check size={11} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="inline-add-tag-bar">
                        <i className="fa-solid fa-plus-circle" style={{ color: "#0284c7" }} aria-hidden="true" />
                        <input
                          value={inlineNewTag}
                          onChange={(event) => setInlineNewTag(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleQuickAddInlineTag("upload");
                            }
                          }}
                          placeholder="พิมพ์แยก Tag ใหม่เพิ่มเองได้ทันที (เช่น โรคฉี่หนู, น้ำป่าไหลหลาก)"
                        />
                        <div className="inline-color-dots">
                          {TAG_COLOR_PRESETS.slice(0, 6).map((preset) => (
                            <button
                              key={`inline-up-${preset.id}`}
                              type="button"
                              className={
                                inlineNewTagColor === preset.color
                                  ? "inline-color-dot is-selected"
                                  : "inline-color-dot"
                              }
                              style={{ backgroundColor: preset.color }}
                              title={preset.label}
                              onClick={() => setInlineNewTagColor(preset.color)}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          className="inline-add-tag-btn"
                          disabled={!inlineNewTag.trim()}
                          onClick={() => void handleQuickAddInlineTag("upload")}
                        >
                          <Plus size={14} /> แยกเพิ่ม Tag
                        </button>
                      </div>
                    </div>

                    <label>
                      <span className="fa-form-heading">
                        <span className="fa-field-badge"><i className="fa-solid fa-map-location-dot" aria-hidden="true" /></span>
                        <span>พื้นที่ <em>*</em></span>
                      </span>
                      <input
                        name="location"
                        required
                        value={uploadLocation}
                        onChange={(event) => setUploadLocation(event.target.value)}
                      />
                    </label>
                    <label>
                      <span className="fa-form-heading">
                        <span className="fa-field-badge"><i className="fa-solid fa-bullhorn" aria-hidden="true" /></span>
                        <span>สถานะการเผยแพร่</span>
                      </span>
                      <select
                        name="status"
                        value={uploadStatus}
                        onChange={(event) => setUploadStatus(event.target.value as MediaItem["status"])}
                      >
                        <option value="published">เผยแพร่ทันที</option>
                        <option value="draft">บันทึกเป็นฉบับร่าง</option>
                      </select>
                    </label>
                    <label className="field-wide">
                      <span className="fa-form-heading">
                        <span className="fa-field-badge"><i className="fa-solid fa-align-left" aria-hidden="true" /></span>
                        <span>คำอธิบาย <em>*</em> (สรุปสั้น กระชับ มีอิโมจิ พร้อมไฮไลต์ข้อความ)</span>
                      </span>
                      <div className="desc-quick-toolbar">
                        <span className="desc-toolbar-title">
                          <i className="fa-solid fa-highlighter" /> ไฮไลต์ & หัวข้อ:
                        </span>
                        <button
                          type="button"
                          className="desc-toolbar-pill highlight"
                          onClick={applyHighlightToUploadDesc}
                          title="คลุมข้อความแล้วคลิกเพื่อไฮไลต์เน้นคำสำคัญ"
                        >
                          <i className="fa-solid fa-highlighter" /> ไฮไลต์คำสำคัญ
                        </button>
                        <button
                          type="button"
                          className="desc-toolbar-pill"
                          onClick={() => insertSnippetToUploadDesc("\n• ")}
                        >
                          • Bullet
                        </button>
                        <button
                          type="button"
                          className="desc-toolbar-pill danger"
                          onClick={() => insertSnippetToUploadDesc("\n• ⚠️ **จุดเสี่ยง**: ")}
                        >
                          ⚠️ จุดเสี่ยง
                        </button>
                        <button
                          type="button"
                          className="desc-toolbar-pill safe"
                          onClick={() => insertSnippetToUploadDesc("\n• 🛡️ **วิธีป้องกัน**: ")}
                        >
                          🛡️ วิธีป้องกัน
                        </button>
                        <button
                          type="button"
                          className="desc-toolbar-pill emergency"
                          onClick={() => insertSnippetToUploadDesc("\n• 📞 **สายด่วน**: 1669 ฟรี 24 ชม.")}
                        >
                          📞 สายด่วน 1669
                        </button>
                      </div>
                      <textarea
                        ref={uploadDescRef}
                        name="description"
                        rows={4}
                        required
                        value={uploadDescription}
                        onChange={(event) => setUploadDescription(event.target.value)}
                        placeholder="สรุปสาระสำคัญ เช่น:\n📌 เรื่องด่วนต้องรู้: ป้องกันโรคฉี่หนูช่วงน้ำท่วมขัง\n• ⚠️ **จุดเสี่ยง**: **ห้ามลุยน้ำเท้าเปล่า** เสี่ยงเชื้อโรคเข้าบาดแผล\n• 🛡️ **วิธีป้องกัน**: สวมรองเท้าบูททุกครั้ง และรีบล้างสบู่ทันที\n• 📞 **สายด่วน**: หากมีไข้สูงหนาวสั่น โทร **1669 ฟรี 24 ชม.**"
                      />
                    </label>
                    <label className="field-wide">
                      <span className="fa-form-heading">
                        <span className="fa-field-badge"><i className="fa-solid fa-universal-access" aria-hidden="true" /></span>
                        <span>คำบรรยายภาพเพื่อการเข้าถึง <em>*</em></span>
                      </span>
                      <input
                        name="altText"
                        required
                        value={uploadAltText}
                        onChange={(event) => setUploadAltText(event.target.value)}
                        placeholder="อธิบายสิ่งที่อยู่ในชุดภาพอย่างกระชับ"
                      />
                    </label>
                    <label className="field-wide">
                      <span className="fa-form-heading">
                        <span className="fa-field-badge"><i className="fa-solid fa-hashtag" aria-hidden="true" /></span>
                        <span>คำค้นหา <span>(คั่นด้วยเครื่องหมายจุลภาค)</span></span>
                      </span>
                      <input
                        name="keywords"
                        value={uploadKeywords}
                        onChange={(event) => setUploadKeywords(event.target.value)}
                        placeholder="น้ำท่วม, ป้องกันโรค, โรคฉี่หนู"
                      />
                    </label>
                  </div>
                </fieldset>

                {formMessage && (
                  <div className={`form-alert ${formMessage.type}`}>
                    <span>{formMessage.type === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}</span>
                    {formMessage.text}
                  </div>
                )}

                <div className="admin-modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowUploadForm(false)}
                    disabled={uploading}
                  >
                    ยกเลิก
                  </button>
                  <button
                    className="admin-primary submit-media"
                    type="submit"
                    disabled={!status?.connected || uploadFiles.length === 0 || uploading}
                  >
                    {uploading ? <LoaderCircle className="spin" size={18} /> : <CloudUpload size={18} />}
                    {uploading
                      ? uploadProgressText || "กำลังบันทึกลง Google..."
                      : uploadFiles.length > 1
                        ? `บันทึกและเผยแพร่ชุดสื่อ (${uploadFiles.length} รูปภาพ)`
                        : "บันทึกและเผยแพร่สื่อ"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        );
      })()}

      {editing && (
        <div className="admin-modal-backdrop" onMouseDown={() => !savingEdit && closeEditModal()}>
          <section className="admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-media-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="cinematic-modal-header">
              <div className="cinematic-modal-title">
                <span className="cinematic-modal-icon"><Pencil size={19} /></span>
                <div>
                  <span className="cinematic-modal-kicker"><Sparkles size={13} /> EDIT MEDIA & SLIDES</span>
                  <h2 id="edit-media-title">แก้ไขข้อมูลสื่อและรูปภาพในชุดสื่อ</h2>
                  <p>สามารถแก้ไขรายละเอียด หรือเพิ่ม/ลบรูปภาพประกอบในหัวข้อนี้ได้</p>
                </div>
              </div>
              <button className="cinematic-modal-close" type="button" onClick={closeEditModal} disabled={savingEdit} aria-label="ปิดหน้าต่างแก้ไข"><X size={18} /> ปิด</button>
            </header>
            <form onSubmit={handleEdit}>
              <input
                ref={editFileInput}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                style={{ display: "none" }}
                onChange={(event) => addEditFiles(event.target.files)}
              />

              <div className="edit-slides-manager">
                <div className="edit-slides-header">
                  <strong>
                    <Images size={15} /> รูปภาพในหัวข้อนี้ ({1 + editExtraSlides.length + editNewFiles.length} ภาพ)
                  </strong>
                  <button
                    type="button"
                    className="upload-add-more-btn"
                    disabled={savingEdit}
                    onClick={() => editFileInput.current?.click()}
                  >
                    <Plus size={14} /> เพิ่มรูปภาพในชุดสื่อนี้
                  </button>
                </div>
                <div className="upload-thumbs-strip">
                  <div className="upload-thumb-item is-active" title="ภาพปกหลัก">
                    {editing.thumbnailUrl ? (
                      <img src={editing.thumbnailUrl} alt={editing.title} />
                    ) : (
                      <FileImage size={18} />
                    )}
                    <span className="upload-thumb-index">ปก</span>
                  </div>
                  {editExtraSlides.map((slide, idx) => (
                    <div key={`${slide.id}-${idx}`} className="upload-thumb-item" title={slide.fileName}>
                      {slide.thumbnailUrl ? (
                        <img src={slide.thumbnailUrl} alt={slide.fileName} />
                      ) : (
                        <FileImage size={18} />
                      )}
                      <span className="upload-thumb-index">{idx + 2}</span>
                      <button
                        type="button"
                        className="upload-thumb-remove"
                        aria-label={`ลบรูปที่ ${idx + 2}`}
                        onClick={() =>
                          setEditExtraSlides((current) => current.filter((_, i) => i !== idx))
                        }
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  {editNewFiles.map((entry, idx) => (
                    <div key={entry.id} className="upload-thumb-item is-new" title={`ใหม่: ${entry.file.name}${getCompressionStat(entry) ? ` • ${formatFileSize(getCompressionStat(entry)!.originalBytes)} → ${formatFileSize(getCompressionStat(entry)!.outputBytes)}` : ""}`}>
                      {entry.previewUrl ? (
                        <img src={entry.previewUrl} alt={entry.file.name} />
                      ) : (
                        <FileText size={18} />
                      )}
                      <span className="upload-thumb-index">ใหม่</span>
                      <button
                        type="button"
                        className="upload-thumb-remove"
                        aria-label="นำรูปใหม่ออก"
                        onClick={() => removeEditNewFileAt(idx)}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="upload-thumb-add"
                    onClick={() => editFileInput.current?.click()}
                    title="เพิ่มรูปภาพประกอบ"
                  >
                    <Plus size={18} />
                    <span>เพิ่มรูป</span>
                  </button>
                </div>
                {editNewFiles.length > 0 && renderCompressionPicker(editNewFiles)}
              </div>

              {/* AI Review & 3-Style Social Media Caption Generator */}
              <div className="ai-reanalyze-box">
                <div className="ai-reanalyze-copy">
                  <span className="ai-reanalyze-badge">
                    <Sparkles size={14} /> AI Content Marketing & Social Media Copywriter
                  </span>
                  <strong>ทบทวนรูปภาพ & สร้างแคปชั่นใหม่ด้วย AI</strong>
                  <p>
                    ให้ AI ผู้เชี่ยวชาญด้าน Content Marketing ช่วยวิเคราะห์ภาพจริงอย่างละเอียด และเสนอแคปชั่น 3 สไตล์ สั้น กระชับ มี Hook กระตุกสายตา พร้อมอิโมจิ Bullet points และไฮไลต์คำสำคัญ
                  </p>
                </div>
                <button
                  type="button"
                  className="ai-reanalyze-btn"
                  disabled={reanalyzingEdit}
                  onClick={handleReanalyzeEditMedia}
                >
                  {reanalyzingEdit ? <LoaderCircle className="spin" size={16} /> : <WandSparkles size={16} />}
                  <span>{reanalyzingEdit ? "กำลังวิเคราะห์และคิดแคปชั่น..." : "✨ ทบทวนรูปภาพ & คิดแคปชั่นใหม่ด้วย AI"}</span>
                </button>
              </div>

              {editAiMessage && (
                <div className={`ai-assist-banner ${editAiMessage.type}`} role="status">
                  {editAiMessage.type === "info" && <LoaderCircle className="spin" size={16} />}
                  {editAiMessage.type === "success" && <Check size={16} />}
                  {editAiMessage.type === "error" && <AlertTriangle size={16} />}
                  <span>{editAiMessage.text}</span>
                </div>
              )}

              {editCaptionOptions.length > 0 && (
                <div className="ai-caption-picker-container">
                  <div className="ai-caption-picker-header">
                    <div className="caption-picker-title">
                      <Sparkles size={16} style={{ color: "#d97706" }} />
                      <strong>ตัวเลือกแคปชั่น 3 แบบจาก AI Copywriter (คลิกเพื่อเลือกใช้):</strong>
                    </div>
                    <span className="caption-picker-badge">3 สไตล์ให้เลือก</span>
                  </div>

                  <div className="ai-caption-cards-grid">
                    {editCaptionOptions.map((opt, idx) => (
                      <div
                        key={opt.id || idx}
                        className={`ai-caption-card ${selectedCaptionIdx === idx ? "is-selected" : ""}`}
                        onClick={() => applyCaptionOption(opt, idx)}
                      >
                        <div className="caption-card-top">
                          <span className="caption-card-badge">{opt.name}</span>
                          {selectedCaptionIdx === idx ? (
                            <span className="caption-applied-tag">
                              <Check size={13} /> ใช้งานอยู่
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="caption-apply-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                applyCaptionOption(opt, idx);
                              }}
                            >
                              เลือกใช้แบบนี้
                            </button>
                          )}
                        </div>

                        {opt.hook && <div className="caption-hook-text">"{opt.hook}"</div>}

                        <div className="caption-body-preview">
                          <FormattedDescription text={opt.caption} />
                        </div>

                        {opt.hashtags && opt.hashtags.length > 0 && (
                          <div className="caption-hashtags-row">
                            {opt.hashtags.map((h, i) => (
                              <span key={i} className="caption-tag-pill">
                                {h.startsWith("#") ? h : `#${h}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-grid">
                <label className="field-wide">
                  <span className="fa-form-heading">
                    <span className="fa-field-badge"><i className="fa-solid fa-heading" aria-hidden="true" /></span>
                    <span>ชื่อสื่อ <em>*</em></span>
                  </span>
                  <input name="title" required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </label>
                <label>
                  <span className="fa-form-heading">
                    <span className="fa-field-badge"><i className="fa-solid fa-timeline" aria-hidden="true" /></span>
                    <span>ช่วงเหตุการณ์ <em>*</em></span>
                  </span>
                  <select name="phase" value={editPhase} onChange={(e) => setEditPhase(e.target.value as IncidentPhase)}>
                    <option value="before">ก่อนเกิดเหตุ</option>
                    <option value="during">ระหว่างเกิดเหตุ</option>
                    <option value="after">หลังเกิดเหตุ</option>
                  </select>
                </label>
                <label>
                  <span className="fa-form-heading">
                    <span className="fa-field-badge"><i className="fa-solid fa-calendar-day" aria-hidden="true" /></span>
                    <span>วันที่เหตุการณ์ <em>*</em></span>
                  </span>
                  <input type="date" name="eventDate" required defaultValue={editing.eventDate} />
                </label>

                <div className="field-wide multi-tag-field-box">
                  <div className="multi-tag-field-header">
                    <span className="fa-form-heading">
                      <span className="fa-field-badge"><i className="fa-solid fa-tags" aria-hidden="true" /></span>
                      <span>ประเภทเหตุการณ์ (Tag) <em>*</em></span>
                    </span>
                    <span className="multi-tag-hint">
                      <i className="fa-solid fa-circle-check" aria-hidden="true" /> เลือกได้มากกว่า 1 เหตุการณ์ (เลือกแล้ว {editCategories.length} รายการ)
                    </span>
                  </div>

                  <div className="selected-tags-bar" aria-label="ประเภทเหตุการณ์ที่เลือก">
                    <span className="selected-tags-label">ที่เลือก:</span>
                    {editCategories.map((cat) => {
                      const cfg = getTagVisual(cat);
                      return (
                        <span
                          key={`selected-edit-${cat}`}
                          className="event-tag-badge is-selected-pill"
                          style={{
                            backgroundColor: cfg.color,
                            color: "#ffffff",
                            borderColor: cfg.color,
                          }}
                        >
                          <i className={cfg.icon} aria-hidden="true" />
                          <span>{cat}</span>
                          {editCategories.length > 1 && (
                            <button
                              type="button"
                              className="selected-pill-remove"
                              onClick={() =>
                                toggleCategoryTag(cat, editCategories, setEditCategories)
                              }
                              title={`นำ ${cat} ออก`}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  <div className="multi-tag-selector-grid" role="group" aria-label="คลิกเพื่อเลือกประเภทเหตุการณ์">
                    {categories.map((cat) => {
                      const cfg = getTagVisual(cat);
                      const isSelected = editCategories.includes(cat);
                      return (
                        <button
                          key={`pick-edit-${cat}`}
                          type="button"
                          className={
                            isSelected
                              ? "selectable-tag-chip is-selected"
                              : "selectable-tag-chip"
                          }
                          style={
                            isSelected
                              ? {
                                  backgroundColor: cfg.bgColor,
                                  color: cfg.textColor,
                                  borderColor: cfg.color,
                                  boxShadow: `0 0 0 2px ${cfg.borderColor}`,
                                }
                              : {
                                  backgroundColor: "#ffffff",
                                  color: cfg.textColor,
                                  borderColor: cfg.borderColor,
                                }
                          }
                          onClick={() =>
                            toggleCategoryTag(cat, editCategories, setEditCategories)
                          }
                          aria-pressed={isSelected}
                        >
                          <span
                            className="event-tag-dot"
                            style={{ backgroundColor: cfg.color }}
                          />
                          <i className={cfg.icon} aria-hidden="true" />
                          <span>{cat}</span>
                          {isSelected && (
                            <span
                              className="tag-check-mark"
                              style={{ backgroundColor: cfg.color }}
                            >
                              <Check size={11} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="inline-add-tag-bar">
                    <i className="fa-solid fa-plus-circle" style={{ color: "#0284c7" }} aria-hidden="true" />
                    <input
                      value={inlineNewTag}
                      onChange={(event) => setInlineNewTag(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleQuickAddInlineTag("edit");
                        }
                      }}
                      placeholder="พิมพ์แยก Tag ใหม่เพิ่มเองได้ทันที (เช่น โรคฉี่หนู, น้ำป่าไหลหลาก)"
                    />
                    <div className="inline-color-dots">
                      {TAG_COLOR_PRESETS.slice(0, 6).map((preset) => (
                        <button
                          key={`inline-ed-${preset.id}`}
                          type="button"
                          className={
                            inlineNewTagColor === preset.color
                              ? "inline-color-dot is-selected"
                              : "inline-color-dot"
                          }
                          style={{ backgroundColor: preset.color }}
                          title={preset.label}
                          onClick={() => setInlineNewTagColor(preset.color)}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="inline-add-tag-btn"
                      disabled={!inlineNewTag.trim()}
                      onClick={() => void handleQuickAddInlineTag("edit")}
                    >
                      <Plus size={14} /> แยกเพิ่ม Tag
                    </button>
                  </div>
                </div>

                <label>
                  <span className="fa-form-heading">
                    <span className="fa-field-badge"><i className="fa-solid fa-map-location-dot" aria-hidden="true" /></span>
                    <span>พื้นที่ <em>*</em></span>
                  </span>
                  <input name="location" required value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
                </label>
                <label>
                  <span className="fa-form-heading">
                    <span className="fa-field-badge"><i className="fa-solid fa-bullhorn" aria-hidden="true" /></span>
                    <span>สถานะการเผยแพร่</span>
                  </span>
                  <select name="status" defaultValue={editing.status}>
                    <option value="published">เผยแพร่</option>
                    <option value="draft">ฉบับร่าง</option>
                  </select>
                </label>
                <label className="field-wide">
                  <span className="fa-form-heading">
                    <span className="fa-field-badge"><i className="fa-solid fa-align-left" aria-hidden="true" /></span>
                    <span>คำอธิบาย <em>*</em></span>
                  </span>
                  <div className="desc-quick-toolbar">
                    <span className="desc-toolbar-title">
                      <i className="fa-solid fa-highlighter" /> ไฮไลต์ & หัวข้อ:
                    </span>
                    <button
                      type="button"
                      className="desc-toolbar-pill highlight"
                      onClick={applyHighlightToEditDesc}
                      title="คลุมข้อความแล้วคลิกเพื่อไฮไลต์เน้นคำสำคัญ"
                    >
                      <i className="fa-solid fa-highlighter" /> ไฮไลต์คำสำคัญ
                    </button>
                    <button
                      type="button"
                      className="desc-toolbar-pill"
                      onClick={() => insertSnippetToEditDesc("\n• ")}
                    >
                      • Bullet
                    </button>
                    <button
                      type="button"
                      className="desc-toolbar-pill danger"
                      onClick={() => insertSnippetToEditDesc("\n• ⚠️ **จุดเสี่ยง**: ")}
                    >
                      ⚠️ จุดเสี่ยง
                    </button>
                    <button
                      type="button"
                      className="desc-toolbar-pill safe"
                      onClick={() => insertSnippetToEditDesc("\n• 🛡️ **วิธีป้องกัน**: ")}
                    >
                      🛡️ วิธีป้องกัน
                    </button>
                    <button
                      type="button"
                      className="desc-toolbar-pill emergency"
                      onClick={() => insertSnippetToEditDesc("\n• 📞 **สายด่วน**: 1669 ฟรี 24 ชม.")}
                    >
                      📞 สายด่วน 1669
                    </button>
                  </div>
                  <textarea ref={editDescRef} name="description" rows={4} required value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                </label>
                <label className="field-wide">
                  <span className="fa-form-heading">
                    <span className="fa-field-badge"><i className="fa-solid fa-universal-access" aria-hidden="true" /></span>
                    <span>คำบรรยายภาพเพื่อการเข้าถึง <em>*</em></span>
                  </span>
                  <input name="altText" required value={editAltText} onChange={(e) => setEditAltText(e.target.value)} />
                </label>
                <label className="field-wide">
                  <span className="fa-form-heading">
                    <span className="fa-field-badge"><i className="fa-solid fa-hashtag" aria-hidden="true" /></span>
                    <span>คำค้นหา <span>(คั่นด้วยเครื่องหมายจุลภาค)</span></span>
                  </span>
                  <input name="keywords" value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} />
                </label>
              </div>
              <div className="admin-modal-actions">
                <button type="button" onClick={closeEditModal} disabled={savingEdit}>ยกเลิก</button>
                <button className="admin-primary" type="submit" disabled={savingEdit}>
                  {savingEdit ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
                  {savingEdit ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {previewItem && (() => {
        const slides = getMediaSlides(previewItem);
        const safeIdx = Math.min(previewSlideIndex, Math.max(0, slides.length - 1));
        const activeSlide = slides[safeIdx] ?? slides[0];
        return (
          <div className="admin-modal-backdrop" onMouseDown={() => setPreviewItem(null)}>
            <section
              className="admin-upload-modal admin-preview-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-preview-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="cinematic-modal-header">
                <div className="cinematic-modal-title">
                  <span className="cinematic-modal-icon"><Images size={20} /></span>
                  <div>
                    <span className="cinematic-modal-kicker">
                      <Sparkles size={13} /> MEDIA SLIDE PREVIEW ({safeIdx + 1} / {slides.length})
                    </span>
                    <h2 id="admin-preview-title">{previewItem.title}</h2>
                    <p>{previewItem.category} • {phaseLabels[previewItem.phase]} • {previewItem.location}</p>
                  </div>
                </div>
                <button
                  className="cinematic-modal-close"
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  aria-label="ปิดหน้าต่างดูภาพ"
                >
                  <X size={18} /> ปิด
                </button>
              </header>

              <div className="upload-modal-form">
                <div className="upload-multi-showcase">
                  <div className="upload-slide-stage">
                    <div className="upload-slide-badges">
                      <span className="upload-slide-counter">
                        <Images size={13} /> ภาพที่ {safeIdx + 1} จาก {slides.length}
                      </span>
                    </div>

                    {slides.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="upload-slide-nav prev"
                          aria-label="ภาพก่อนหน้า"
                          onClick={() =>
                            setPreviewSlideIndex((safeIdx - 1 + slides.length) % slides.length)
                          }
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          type="button"
                          className="upload-slide-nav next"
                          aria-label="ภาพถัดไป"
                          onClick={() =>
                            setPreviewSlideIndex((safeIdx + 1) % slides.length)
                          }
                        >
                          <ChevronRight size={20} />
                        </button>
                      </>
                    )}

                    <div className="upload-slide-preview-box preview-large">
                      {activeSlide?.thumbnailUrl ? (
                        <img src={activeSlide.thumbnailUrl} alt={previewItem.altText || previewItem.title} />
                      ) : (
                        <span className="file-type-badge"><FileImage size={42} /></span>
                      )}
                    </div>

                    <div className="upload-slide-bar">
                      <div className="upload-slide-fileinfo">
                        <strong>{activeSlide?.fileName || previewItem.fileName}</strong>
                        <small><FormattedDescription text={previewItem.description} /></small>
                      </div>
                      <div className="dropzone-file-actions">
                        {(activeSlide?.downloadUrl || activeSlide?.thumbnailUrl) && (
                          <a
                            className="ai-reanalyze-btn"
                            href={activeSlide.downloadUrl || activeSlide.thumbnailUrl}
                            download
                          >
                            <Maximize2 size={14} /> เปิดไฟล์เต็ม / ดาวน์โหลด
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {slides.length > 1 && (
                    <div className="upload-thumbs-strip">
                      {slides.map((slide, idx) => (
                        <div
                          key={`${slide.id}-${idx}`}
                          className={
                            idx === safeIdx ? "upload-thumb-item is-active" : "upload-thumb-item"
                          }
                          onClick={() => setPreviewSlideIndex(idx)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setPreviewSlideIndex(idx);
                            }
                          }}
                        >
                          {slide.thumbnailUrl ? (
                            <img src={slide.thumbnailUrl} alt={`ภาพที่ ${idx + 1}`} />
                          ) : (
                            <FileImage size={18} />
                          )}
                          <span className="upload-thumb-index">{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        );
      })()}

      {historyItem && (
        <div className="admin-modal-backdrop" onMouseDown={() => setHistoryItem(null)}>
          <section className="admin-history-modal" role="dialog" aria-modal="true" aria-labelledby="media-history-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="cinematic-modal-header">
              <div className="cinematic-modal-title">
                <span className="cinematic-modal-icon"><History size={19} /></span>
                <div>
                  <span className="cinematic-modal-kicker"><Sparkles size={13} /> REVISION HISTORY</span>
                  <h2 id="media-history-title">ประวัติการแก้ไข</h2>
                  <p>{historyItem.title}</p>
                </div>
              </div>
              <button className="cinematic-modal-close" type="button" onClick={() => setHistoryItem(null)} aria-label="ปิดประวัติ"><X size={18} /> ปิด</button>
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
