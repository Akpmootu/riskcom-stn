"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Braces,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CloudRain,
  Eye,
  FileText,
  Globe,
  HeartPulse,
  Home,
  Image as ImageIcon,
  Images,
  Info,
  MapPin,
  Maximize2,
  Menu,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getItemCategories,
  optimizeThumbnailUrl,
  readStoredTagConfigs,
  resolveTagConfig,
  writeStoredTagConfigs,
  type CategoryTagConfig,
} from "./lib/category-tags";
import {
  getMediaSlides,
  normalizeMediaItems,
} from "./lib/media-gallery-utils";
import {
  DEFAULT_WATCH_SITUATION,
  normalizeWatchSituation,
  readStoredWatchConfig,
  selectWatchMediaItems,
  writeStoredWatchConfig,
  type WatchSituationConfig,
} from "./lib/watch-situation";
import {
  EocFooterPanel,
  PublicServiceBar,
  PublicServiceViewer,
  WatchSituationBanner,
  type PublicServiceId,
} from "./components/public-safety";
import {
  readMediaCache,
  writeMediaCache,
} from "./media-cache";
import type {
  IncidentPhase,
  MediaItem,
  MediaResponse,
  VisitorStats,
} from "./types";

const phases: Array<{
  id: IncidentPhase;
  step: string;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
}> = [
  {
    id: "before",
    step: "01",
    title: "ก่อนเกิดเหตุ",
    description: "รู้ก่อน ป้องกันได้ เตรียมความพร้อม ลดความเสี่ยง ดูแลตนเองและครอบครัว",
    icon: ShieldCheck,
  },
  {
    id: "during",
    step: "02",
    title: "ระหว่างเกิดเหตุ",
    description: "ติดตามสถานการณ์ ปฏิบัติตามคำแนะนำ ดูแลความปลอดภัยของตนเองและคนรอบข้าง",
    icon: AlertTriangle,
  },
  {
    id: "after",
    step: "03",
    title: "หลังเกิดเหตุ",
    description: "ฟื้นฟูสุขภาพ สำรวจความเสียหาย และป้องกันการเกิดซ้ำ",
    icon: ClipboardCheck,
  },
];

const phaseLabels: Record<IncidentPhase, string> = {
  before: "ก่อนเกิดเหตุ",
  during: "ระหว่างเกิดเหตุ",
  after: "หลังเกิดเหตุ",
};

const popularKeywords = [
  "ไข้เลือดออก",
  "โรคอุบัติใหม่",
  "PM2.5",
  "อุทกภัย",
  "สุขภาพเด็ก",
];

function formatThaiDate(value: string) {
  if (!value) return "ไม่ระบุวันที่";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00+07:00`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "ไม่ระบุวันที่";

  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function formatCacheTime(value: number) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function getVisualClass(category: string) {
  if (category.includes("น้ำ")) return "flood";
  if (category.includes("โรค")) return "health";
  if (category.includes("หมอก") || category.includes("ฝุ่น")) return "haze";
  if (category.includes("อุบัติเหตุ")) return "road";
  return "recovery";
}

function pickRandomInterestingMedia(allItems: MediaItem[], maxCount = 5): MediaItem[] {
  if (allItems.length === 0) return [];
  const withImages = allItems.filter((item) => Boolean(item.thumbnailUrl));
  const pool = withImages.length >= Math.min(2, allItems.length) ? [...withImages] : [...allItems];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }
  const selected = pool.slice(0, maxCount);
  if (selected.length < maxCount && allItems.length > selected.length) {
    const remaining = allItems.filter((item) => !selected.some((s) => s.id === item.id));
    selected.push(...remaining.slice(0, maxCount - selected.length));
  }
  return selected;
}

function getMediaTypeLabel(item: MediaItem) {
  const slides = getMediaSlides(item);
  if (slides.length > 1) return `ชุดสื่อ ${slides.length} ภาพ`;
  if (item.fileType.includes("pdf")) return "คู่มือ / PDF";
  if (item.fileType.includes("video")) return "วิดีโอ";
  if (item.category.includes("โรค") || item.category.includes("หมอก")) return "อินโฟกราฟิก";
  return "โปสเตอร์";
}

function MediaArtwork({
  item,
  large = false,
  slideUrl,
}: {
  item: MediaItem;
  large?: boolean;
  slideUrl?: string;
}) {
  const visual = getVisualClass(item.category);
  const rawUrl = slideUrl ?? item.thumbnailUrl;
  const effectiveUrl = optimizeThumbnailUrl(rawUrl, large ? 1600 : 640);
  if (effectiveUrl) {
    return (
      <img
        className={large ? "detail-image" : "media-image"}
        src={effectiveUrl}
        alt={item.altText}
        loading={large ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  return (
    <div className={`media-art media-art-${visual} ${large ? "media-art-large" : ""}`}>
      <div className="art-orbit art-orbit-one" />
      <div className="art-orbit art-orbit-two" />
      <div className="art-grid" />
      <div className="art-copy">
        <span>{phaseLabels[item.phase]}</span>
        <strong>{item.category}</strong>
        <small>สื่อพร้อมใช้ • สสจ.สตูล</small>
      </div>
    </div>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={`skeleton-block ${className}`} aria-hidden="true" />;
}

export function MediaGallerySkeleton() {
  return (
    <main
      className="site-shell site-data-skeleton"
      id="top"
      aria-busy="true"
      aria-describedby="gallery-loading-status"
    >
      <header className="site-header">
        <div className="container nav-wrap">
          <a className="brand" href="#top" aria-label="กลับไปหน้าแรก">
            <span className="brand-mark">
              <img src="/satun-risk-logo.png" alt="" aria-hidden="true" />
            </span>
            <span>
              <strong>คลังสื่อสารความเสี่ยง</strong>
              <small>สำนักงานสาธารณสุขจังหวัดสตูล</small>
            </span>
          </a>
          <div className="skeleton-nav" aria-hidden="true">
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock className="skeleton-nav-admin" />
          </div>
          <span className="skeleton-mobile-menu" aria-hidden="true"><Menu size={22} /></span>
        </div>
      </header>

      <div className="skeleton-status-banner" id="gallery-loading-status" role="status" aria-live="polite">
        <span className="skeleton-loading-dot" aria-hidden="true" />
        กำลังดาวน์โหลดข้อมูลจากคลังสื่อ กรุณารอสักครู่
      </div>

      <section className="hero skeleton-hero" aria-label="กำลังโหลดข้อมูลส่วนแนะนำ">
        <div className="hero-pattern" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <SkeletonBlock className="skeleton-eyebrow" />
            <div className="skeleton-title" aria-hidden="true">
              <SkeletonBlock />
              <SkeletonBlock />
            </div>
            <div className="skeleton-paragraph" aria-hidden="true">
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
            </div>
            <SkeletonBlock className="skeleton-hero-search" />
            <div className="skeleton-metrics" aria-hidden="true">
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
            </div>
          </div>
          <div className="hero-panel">
            <div className="alert-card skeleton-alert-card" aria-hidden="true">
              <div className="skeleton-alert-head">
                <SkeletonBlock />
                <SkeletonBlock />
              </div>
              <SkeletonBlock className="skeleton-alert-icon" />
              <SkeletonBlock className="skeleton-alert-kicker" />
              <SkeletonBlock className="skeleton-alert-title" />
              <SkeletonBlock className="skeleton-alert-title skeleton-alert-title-short" />
              <div className="skeleton-alert-meta">
                <SkeletonBlock />
                <SkeletonBlock />
              </div>
              <SkeletonBlock className="skeleton-alert-action" />
            </div>
          </div>
        </div>
      </section>

      <section className="phase-section" id="phases" aria-label="กำลังโหลดช่วงเหตุการณ์">
        <div className="container">
          <div className="phase-surface">
            <div className="section-heading skeleton-section-heading" aria-hidden="true">
              <div>
                <SkeletonBlock className="skeleton-kicker" />
                <SkeletonBlock className="skeleton-section-title" />
              </div>
              <div className="skeleton-section-copy">
                <SkeletonBlock />
                <SkeletonBlock />
              </div>
            </div>
            <div className="phase-path skeleton-phase-path" aria-hidden="true">
              {[0, 1, 2].map((item) => (
                <article className="phase-card skeleton-phase-card" key={item}>
                  <SkeletonBlock className="skeleton-phase-icon" />
                  <SkeletonBlock className="skeleton-phase-title" />
                  <SkeletonBlock className="skeleton-phase-copy" />
                  <SkeletonBlock className="skeleton-phase-copy skeleton-phase-copy-short" />
                  <SkeletonBlock className="skeleton-phase-link" />
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="gallery-section" id="gallery" aria-label="กำลังโหลดคลังสื่อ">
        <div className="container">
          <div className="section-heading skeleton-section-heading" aria-hidden="true">
            <div>
              <SkeletonBlock className="skeleton-kicker" />
              <SkeletonBlock className="skeleton-section-title" />
            </div>
            <div className="skeleton-section-copy">
              <SkeletonBlock />
              <SkeletonBlock />
            </div>
          </div>
          <div className="gallery-tools skeleton-gallery-tools" aria-hidden="true">
            <SkeletonBlock className="skeleton-gallery-search" />
            <div className="skeleton-filter-chips">
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
            </div>
          </div>
          <SkeletonBlock className="skeleton-result-line" />
          <div className="gallery-grid" aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <article className="media-card skeleton-media-card" key={item}>
                <SkeletonBlock className="skeleton-media-visual" />
                <div className="media-body">
                  <SkeletonBlock className="skeleton-media-category" />
                  <SkeletonBlock className="skeleton-media-title" />
                  <SkeletonBlock className="skeleton-media-title skeleton-media-title-short" />
                  <SkeletonBlock className="skeleton-media-copy" />
                  <SkeletonBlock className="skeleton-media-copy skeleton-media-copy-short" />
                  <SkeletonBlock className="skeleton-media-location" />
                  <div className="skeleton-media-footer">
                    <SkeletonBlock />
                    <span><SkeletonBlock /><SkeletonBlock /></span>
                  </div>
                </div>
              </article>
            ))}
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
          <div className="footer-credit">
            <p>จัดทำโดย นายอรรฆพร ศรีปานรอด นักวิชาการคอมพิวเตอร์ปฏิบัติการ</p>
            <p>กลุ่มงานสุขภาพดิจิทัล สำนักงานสาธารณสุขจังหวัดสตูล</p>
          </div>
          <div className="footer-actions skeleton-footer-actions" aria-hidden="true">
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="เมนูทางลัด">
        <a href="#top"><Home size={20} /><span>หน้าแรก</span></a>
        <a href="#phases"><ShieldCheck size={20} /><span>ช่วงเหตุ</span></a>
        <a href="#gallery"><ImageIcon size={20} /><span>คลังสื่อ</span></a>
        <a href="/admin"><UserRound size={20} /><span>ผู้ดูแล</span></a>
      </nav>
    </main>
  );
}

export function MediaGallery() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [source, setSource] = useState<MediaResponse["source"]>("demo");
  const [sourceMessage, setSourceMessage] = useState("");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<IncidentPhase | "all">("all");
  const [category, setCategory] = useState("ทั้งหมด");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [cardSlideIndices, setCardSlideIndices] = useState<Record<string, number>>({});
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState<number | null>(null);
  const [showingCachedData, setShowingCachedData] = useState(false);
  const [featuredList, setFeaturedList] = useState<MediaItem[]>([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [tagConfigs, setTagConfigs] = useState<CategoryTagConfig[]>([]);
  const [watchConfig, setWatchConfig] = useState<WatchSituationConfig>(DEFAULT_WATCH_SITUATION);
  const [activeService, setActiveService] = useState<PublicServiceId | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const stored = readStoredTagConfigs();
    if (stored) setTagConfigs(stored);
    fetch("/api/admin/categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tagConfigs?: CategoryTagConfig[] } | null) => {
        if (data?.tagConfigs && Array.isArray(data.tagConfigs) && data.tagConfigs.length > 0) {
          setTagConfigs(data.tagConfigs);
          writeStoredTagConfigs(data.tagConfigs);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const storedWatch = readStoredWatchConfig();
    if (storedWatch) setWatchConfig(storedWatch);
    let active = true;
    fetch("/api/watch-situation")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; config?: Partial<WatchSituationConfig> } | null) => {
        if (active && data?.config) {
          const normalized = normalizeWatchSituation(data.config);
          setWatchConfig(normalized);
          writeStoredWatchConfig(normalized);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const applyMediaResponse = useCallback(
    (result: MediaResponse, cachedAt: number, fromCache: boolean) => {
      const normalized = normalizeMediaItems(result.items || [], ["published"]);
      const effectiveItems = normalized.length > 0 ? normalized : result.items;
      setItems(effectiveItems);
      setSource(result.source);
      setSourceMessage(result.message ?? "");
      setCacheSavedAt(cachedAt);
      setShowingCachedData(fromCache);
      const requestedId = new URLSearchParams(window.location.search).get(
        "media",
      );
      const requestedItem = effectiveItems.find(
        (item) => item.id === requestedId,
      );
      if (requestedItem) {
        setSelected(requestedItem);
        setSelectedSlideIndex(0);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function hydrateMedia() {
      const cached = readMediaCache();
      if (cached && active) {
        applyMediaResponse(cached.response, cached.cachedAt, true);
        setLoading(false);
        if (cached.isFresh) return;
        setRefreshing(true);
      }

      try {
        const response = await fetch("/api/media", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Media API ${response.status}`);
        const result = (await response.json()) as MediaResponse;
        if (!active) return;

        if (
          cached?.response.source === "google" &&
          result.source === "demo"
        ) {
          setSourceMessage(
            "ยังใช้ข้อมูลที่บันทึกไว้ เนื่องจากตรวจสอบข้อมูลล่าสุดไม่สำเร็จ",
          );
          setShowingCachedData(true);
          return;
        }

        const cachedAt = Date.now();
        applyMediaResponse(result, cachedAt, false);
        writeMediaCache(result, cachedAt);
      } catch {
        if (!active || controller.signal.aborted) return;
        setSourceMessage(
          cached
            ? "กำลังใช้ข้อมูลที่บันทึกไว้ในเครื่อง เนื่องจากเชื่อมต่อข้อมูลล่าสุดไม่สำเร็จ"
            : "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
        );
        setShowingCachedData(Boolean(cached));
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void hydrateMedia();
    return () => {
      active = false;
      controller.abort();
    };
  }, [applyMediaResponse]);

  useEffect(() => {
    let active = true;
    async function updateVisitorCount() {
      let token = "";
      let alreadyCounted = false;
      try {
        token =
          window.sessionStorage.getItem("satun-risk-session") ||
          window.crypto.randomUUID();
        alreadyCounted =
          window.sessionStorage.getItem("satun-risk-view-counted") === "yes";
        window.sessionStorage.setItem("satun-risk-session", token);
      } catch {
        token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      const response = await fetch(
        alreadyCounted ? "/api/analytics/stats" : "/api/analytics/view",
        alreadyCounted
          ? { cache: "no-store" }
          : {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ sessionToken: token }),
            },
      );
      const result = (await response.json()) as {
        stats?: VisitorStats;
      };
      if (active && result.stats) setVisitorStats(result.stats);
      if (!alreadyCounted) {
        try {
          window.sessionStorage.setItem("satun-risk-view-counted", "yes");
        } catch {
          // Private browsing may disable session storage.
        }
      }
    }

    void updateVisitorCount().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!selected) return;
    const slides = getMediaSlides(selected);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (fullscreen) setFullscreen(false);
        else setSelected(null);
        return;
      }
      if (slides.length > 1) {
        if (event.key === "ArrowLeft") {
          setSelectedSlideIndex((idx) => (idx - 1 + slides.length) % slides.length);
        } else if (event.key === "ArrowRight") {
          setSelectedSlideIndex((idx) => (idx + 1) % slides.length);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreen, selected]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);

  const categories = useMemo(
    () => [
      "ทั้งหมด",
      ...Array.from(
        new Set(items.flatMap((item) => getItemCategories(item))),
      ),
    ],
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return items.filter((item) => {
      const matchesPhase = phase === "all" || item.phase === phase;
      const itemCats = getItemCategories(item);
      const matchesCategory = category === "ทั้งหมด" || itemCats.includes(category);
      const haystack =
        item._searchIndex ||
        [
          item.title,
          item.description,
          item.location,
          item.category,
          ...itemCats,
          ...item.keywords,
        ]
          .join(" ")
          .toLocaleLowerCase("th");
      return matchesPhase && matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [category, items, phase, query]);

  useEffect(() => {
    if (items.length === 0) {
      setFeaturedList([]);
      return;
    }
    setFeaturedList(pickRandomInterestingMedia(items, 5));
    setFeaturedIndex(0);
  }, [items]);

  useEffect(() => {
    if (featuredList.length <= 1 || selected) return;
    const timer = window.setInterval(() => {
      setFeaturedIndex((idx) => (idx + 1) % featuredList.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [featuredList.length, selected]);

  function shuffleFeaturedNews() {
    if (items.length <= 1) return;
    const nextList = pickRandomInterestingMedia(items, 5);
    if (nextList.length > 1 && featured && nextList[0]?.id === featured.id) {
      const first = nextList.shift();
      if (first) nextList.push(first);
    }
    setFeaturedList(nextList);
    setFeaturedIndex(0);
  }

  const safeFeaturedIndex = featuredList.length ? featuredIndex % featuredList.length : 0;
  const featured = featuredList[safeFeaturedIndex] ?? items[0];
  const featuredSlides = useMemo(
    () => (featured ? getMediaSlides(featured) : []),
    [featured],
  );
  const matchingWatchItems = useMemo(
    () => selectWatchMediaItems(items, watchConfig, 4),
    [items, watchConfig],
  );

  async function refreshMedia() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/media?refresh=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Media API ${response.status}`);
      const result = (await response.json()) as MediaResponse;
      if (source === "google" && result.source === "demo" && items.length) {
        throw new Error(result.message || "ตรวจสอบข้อมูลล่าสุดไม่สำเร็จ");
      }
      const cachedAt = Date.now();
      applyMediaResponse(result, cachedAt, false);
      writeMediaCache(result, cachedAt);
      setToast("อัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว");
    } catch {
      setShowingCachedData(Boolean(items.length));
      setToast(
        items.length
          ? "ยังใช้ข้อมูลเดิมอยู่ เนื่องจากอัปเดตข้อมูลล่าสุดไม่สำเร็จ"
          : "อัปเดตข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function shareItem(item: MediaItem) {
    const url = `${window.location.origin}${window.location.pathname}?media=${encodeURIComponent(item.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: item.description, url });
      } else {
        await navigator.clipboard.writeText(url);
        setToast("คัดลอกลิงก์สำหรับแชร์แล้ว");
      }
    } catch {
      // A cancelled native share sheet needs no error message.
    }
  }

  function downloadFallback() {
    setToast("รายการตัวอย่างจะดาวน์โหลดได้เมื่อเชื่อมต่อ Google Drive แล้ว");
  }

  function jumpToGallery() {
    document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
  }

  if (loading) return <MediaGallerySkeleton />;

  return (
    <main className="site-shell" id="top">
      <header className="site-header">
        <div className="container nav-wrap">
          <a className="brand" href="#top" aria-label="กลับไปหน้าแรก">
            <span className="brand-mark">
              <img src="/satun-risk-logo.png" alt="" aria-hidden="true" />
            </span>
            <span>
              <strong>คลังสื่อสารความเสี่ยง</strong>
              <small>สำนักงานสาธารณสุขจังหวัดสตูล</small>
            </span>
          </a>
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
            <a className="nav-item is-active" href="#top" onClick={() => setMenuOpen(false)}>
              <Home size={16} /> หน้าแรก
            </a>
            <a className="nav-item" href="#phases" onClick={() => setMenuOpen(false)}>
              <ShieldCheck size={16} /> ข้อมูลสถานการณ์
            </a>
            <a className="nav-item" href="#gallery" onClick={() => setMenuOpen(false)}>
              <FileText size={16} /> คลังสื่อ
            </a>
            <a className="nav-item" href="#about" onClick={() => setMenuOpen(false)}>
              <Info size={16} /> เกี่ยวกับเรา
            </a>
            <div className="nav-right-group">
              <button
                type="button"
                className="nav-search-trigger"
                aria-label="ค้นหาในคลังสื่อ"
                onClick={() => {
                  setMenuOpen(false);
                  jumpToGallery();
                }}
              >
                <Search size={18} />
              </button>
              <a className="admin-link" href="/admin">
                <UserRound size={15} /> สำหรับผู้ดูแลระบบ <ArrowRight size={15} />
              </a>
            </div>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-pattern" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={15} /> SATUN RISK COMMUNICATION HUB</span>
            <h1>รู้ก่อน เตรียมพร้อม<br />รับมือไปด้วยกัน</h1>
            <p>
              ศูนย์รวมสื่อที่เชื่อถือได้สำหรับการเฝ้าระวัง ป้องกัน และสื่อสารความเสี่ยง
              ด้านสุขภาพในจังหวัดสตูล เพื่อให้ประชาชนมีความรู้ พร้อมรับมือทุกสถานการณ์
            </p>
            <label className="hero-search">
              <Search size={21} aria-hidden="true" />
              <span className="sr-only">ค้นหาสื่อ</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") jumpToGallery();
                }}
                placeholder="ค้นหาสถานการณ์ โรค หรือสื่อที่คุณสนใจ..."
              />
              <button type="button" onClick={jumpToGallery}>
                ค้นหา <ArrowRight size={16} />
              </button>
            </label>

            <div className="hero-popular" aria-label="คำค้นหายอดนิยม">
              <span className="hero-popular-label">คำค้นหายอดนิยม :</span>
              <div className="hero-popular-tags">
                {popularKeywords.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={query === tag ? "popular-tag is-active" : "popular-tag"}
                    onClick={() => {
                      setQuery((current) => (current === tag ? "" : tag));
                      jumpToGallery();
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="hero-public-services" aria-label="บริการด่วนสำหรับประชาชน">
              <span className="hero-services-kicker">
                <i className="fa-solid fa-bell" aria-hidden="true" style={{ marginRight: 6 }} />
                บริการด่วนสำหรับประชาชน & ศูนย์ EOC
              </span>
              <PublicServiceBar onOpen={(serviceId) => setActiveService(serviceId)} />
            </div>
          </div>

          <div className="hero-panel">
            <div className="alert-card">
              <div className="alert-card-head">
                <span className="alert-badge-pill">
                  <span className="live-dot" />
                  <span>ประกาศเพื่อประชาชน</span>
                </span>
                <div className="alert-head-meta">
                  <small>อัปเดตล่าสุด {featured ? formatThaiDate(featured.eventDate) : "วันนี้"}</small>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="alert-shuffle-btn"
                      onClick={shuffleFeaturedNews}
                      title="สุ่มข่าวที่น่าสนใจเรื่องอื่น"
                      aria-label="สุ่มข่าวที่น่าสนใจเรื่องอื่น"
                    >
                      <RefreshCw size={13} /> สุ่มข่าว
                    </button>
                  )}
                </div>
              </div>

              <div className="alert-card-body">
                {featured && (
                  <div
                    className="alert-card-media"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelected(featured);
                      setSelectedSlideIndex(0);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(featured);
                        setSelectedSlideIndex(0);
                      }
                    }}
                    aria-label={`ดูรูปภาพ ${featured.title}`}
                  >
                    <MediaArtwork
                      item={featured}
                      slideUrl={featuredSlides[0]?.thumbnailUrl}
                    />
                    <span className={`phase-badge badge-${featured.phase}`}>
                      {phaseLabels[featured.phase]}
                    </span>
                    {featuredSlides.length > 1 && (
                      <span className="alert-media-slide-pill">
                        <Images size={12} /> ชุดสื่อ {featuredSlides.length} ภาพ
                      </span>
                    )}
                    <span className="alert-media-overlay">
                      <Eye size={16} /> คลิกเพื่อดูภาพขยาย
                    </span>
                  </div>
                )}

                <div className="alert-title-block">
                  <div className="alert-card-tags">
                    {featured ? (
                      getItemCategories(featured).map((catName) => {
                        const cfg = resolveTagConfig(catName, tagConfigs);
                        return (
                          <span
                            key={catName}
                            className="alert-tag-pill"
                            style={{
                              backgroundColor: cfg.bgColor,
                              color: cfg.textColor,
                              borderColor: cfg.borderColor,
                            }}
                          >
                            <i className={cfg.icon} aria-hidden="true" />
                            {catName}
                          </span>
                        );
                      })
                    ) : (
                      <span className="alert-kicker">เฝ้าระวังสุขภาพ</span>
                    )}
                  </div>
                  <h2>{featured?.title ?? "เฝ้าระวังเหตุการณ์ในจังหวัดสตูล"}</h2>
                </div>

                <p className="alert-description">
                  {featured?.description ?? "รู้จักกลุ่มเสี่ยง ดูแลตนเอง และป้องกันได้อย่างปลอดภัย"}
                </p>

                <div className="alert-meta">
                  <span><MapPin size={15} /> {featured?.location ?? "จังหวัดสตูล"}</span>
                  <span className="alert-meta-divider" aria-hidden="true">|</span>
                  <span><CalendarDays size={15} /> {featured ? formatThaiDate(featured.eventDate) : "วันนี้"}</span>
                </div>

                <div className="alert-card-footer">
                  <button
                    type="button"
                    className="alert-cta-btn"
                    onClick={() => {
                      if (featured) {
                        setSelected(featured);
                        setSelectedSlideIndex(0);
                      }
                    }}
                  >
                    ดูข้อมูลเพิ่มเติม <ArrowRight size={16} />
                  </button>

                  {featuredList.length > 1 && (
                    <div className="alert-carousel-controls" aria-label="เลื่อนดูประกาศ">
                      <button
                        type="button"
                        aria-label="ประกาศก่อนหน้า"
                        onClick={() =>
                          setFeaturedIndex((idx) => (idx - 1 + featuredList.length) % featuredList.length)
                        }
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div className="alert-dots" aria-hidden="true">
                        {featuredList.map((item, idx) => (
                          <span
                            key={item.id}
                            className={idx === safeFeaturedIndex ? "alert-dot is-active" : "alert-dot"}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        aria-label="ประกาศถัดไป"
                        onClick={() =>
                          setFeaturedIndex((idx) => (idx + 1) % featuredList.length)
                        }
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <WatchSituationBanner
        config={watchConfig}
        mediaItems={matchingWatchItems}
        tagConfigs={tagConfigs}
        onOpenMedia={(item) => {
          setSelected(item);
          setSelectedSlideIndex(0);
        }}
        onOpenService={(serviceId) => setActiveService(serviceId)}
        onViewAll={() => {
          if (watchConfig.phase !== "all") {
            setPhase(watchConfig.phase);
          }
          if (watchConfig.categories.length > 0) {
            setCategory(watchConfig.categories[0]);
          }
          jumpToGallery();
        }}
      />

      {sourceMessage && (source === "demo" || showingCachedData) && (
        <div className={showingCachedData ? "container demo-notice cache-notice" : "container demo-notice"} role="status">
          <span><AlertTriangle size={17} /></span>
          <p><strong>{showingCachedData ? "กำลังใช้ข้อมูลที่บันทึกไว้:" : "เวอร์ชันทดลอง:"}</strong> {sourceMessage}</p>
        </div>
      )}

      <section className="phase-section" id="phases">
        <div className="container">
          <div className="phase-surface">
            <div className="section-heading phase-heading">
              <div>
                <span className="section-kicker">HIGHLIGHT</span>
                <h2>เลือกสื่อให้ตรงกับสถานการณ์</h2>
                <p>เข้าถึงสื่อความรู้ คำแนะนำ และแนวทางปฏิบัติที่เหมาะสม ในทุกช่วงสถานการณ์</p>
              </div>
              <button
                type="button"
                className="section-outline-pill"
                onClick={() => {
                  setPhase("all");
                  jumpToGallery();
                }}
              >
                ดูสถานการณ์ทั้งหมด <ArrowRight size={16} />
              </button>
            </div>

            <div className="phase-path" aria-label="กรองตามช่วงเหตุการณ์">
              {phases.map((item) => {
                const Icon = item.icon;
                const count = items.filter((media) => media.phase === item.id).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={phase === item.id ? `phase-card phase-${item.id} is-active` : `phase-card phase-${item.id}`}
                    onClick={() => {
                      setPhase((current) => (current === item.id ? "all" : item.id));
                      document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    aria-pressed={phase === item.id}
                  >
                    <span className="phase-step">{item.step}</span>
                    <span className="phase-icon"><Icon size={24} /></span>
                    <span className="phase-content">
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                      <em>ดูสื่อทั้งหมด ({count}) <ArrowRight size={15} /></em>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="gallery-section" id="gallery">
        <div className="container">
          <div className="gallery-header-row">
            <div className="section-heading gallery-heading">
              <div>
                <span className="section-kicker">MEDIA LIBRARY</span>
                <h2>สื่อสารสู่ประชาชน</h2>
                <p>สื่อความรู้ที่ผ่านการตรวจสอบจากหน่วยงานสาธารณสุขจังหวัดสตูล ดาวน์โหลดและนำไปใช้ได้ทันที</p>
              </div>
            </div>

            <div className="gallery-tools">
              <label className="gallery-search">
                <Search size={18} />
                <span className="sr-only">ค้นหาในคลังสื่อ</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาชื่อสื่อ หัวข้อ หรือสถานการณ์..."
                />
                {query && (
                  <button type="button" aria-label="ล้างคำค้น" onClick={() => setQuery("")}>
                    <X size={16} />
                  </button>
                )}
              </label>

              <label className="gallery-select-wrap">
                <span className="sr-only">กรองตามหมวดหมู่</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item === "ทั้งหมด" ? "หมวดหมู่: ทั้งหมด" : item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="gallery-select-wrap">
                <span className="sr-only">กรองตามช่วงเหตุการณ์</span>
                <select
                  value={phase}
                  onChange={(event) => setPhase(event.target.value as IncidentPhase | "all")}
                >
                  <option value="all">ช่วงเหตุการณ์: ทั้งหมด</option>
                  <option value="before">ก่อนเกิดเหตุ</option>
                  <option value="during">ระหว่างเกิดเหตุ</option>
                  <option value="after">หลังเกิดเหตุ</option>
                </select>
              </label>

              <button type="button" className="gallery-search-btn" onClick={jumpToGallery}>
                <Search size={16} /> ค้นหา
              </button>
            </div>
          </div>

          <div className="gallery-subbar">
            <div className="filter-chips" aria-label="กรองตามประเภท">
              {categories.map((item) => {
                const isAll = item === "ทั้งหมด";
                const cfg = !isAll ? resolveTagConfig(item, tagConfigs) : null;
                const isActive = category === item;
                return (
                  <button
                    key={item}
                    type="button"
                    className={isActive ? "filter-chip is-active" : "filter-chip"}
                    style={
                      !isAll && cfg
                        ? isActive
                          ? {
                              backgroundColor: cfg.color,
                              borderColor: cfg.color,
                              color: "#ffffff",
                            }
                          : {
                              borderColor: cfg.borderColor,
                              backgroundColor: cfg.bgColor,
                              color: cfg.textColor,
                            }
                        : undefined
                    }
                    onClick={() => setCategory(item)}
                    aria-pressed={isActive}
                  >
                    {isActive ? (
                      <Check size={14} />
                    ) : cfg ? (
                      <i className={cfg.icon} aria-hidden="true" />
                    ) : null}
                    {item}
                  </button>
                );
              })}
            </div>

            <div className="gallery-tool-actions">
              {(phase !== "all" || category !== "ทั้งหมด" || query) && (
                <button
                  className="clear-filters"
                  type="button"
                  onClick={() => {
                    setPhase("all");
                    setCategory("ทั้งหมด");
                    setQuery("");
                  }}
                >
                  ล้างตัวกรอง
                </button>
              )}
              <button
                className="gallery-refresh"
                type="button"
                onClick={() => void refreshMedia()}
                disabled={refreshing}
                title="ข้ามแคชและตรวจสอบข้อมูลล่าสุดจากระบบ"
              >
                <RefreshCw className={refreshing ? "spin" : ""} size={15} />
                {refreshing ? "กำลังอัปเดต" : "อัปเดตข้อมูล"}
              </button>
            </div>
          </div>

          <div className="result-line">
            <span>พบ <strong>{filteredItems.length}</strong> รายการ</span>
            {phase !== "all" && <span className="active-filter">{phaseLabels[phase]}</span>}
            {cacheSavedAt && (
              <span className={showingCachedData ? "cache-meta is-cached" : "cache-meta"} aria-live="polite">
                {refreshing ? "กำลังตรวจสอบข้อมูลใหม่" : showingCachedData ? "ข้อมูลจากแคชในเครื่อง" : "ข้อมูลล่าสุด"}
                {` • ${formatCacheTime(cacheSavedAt)}`}
              </span>
            )}
          </div>

          {filteredItems.length ? (
            <div className="gallery-grid">
              {filteredItems.map((item) => {
                const slides = getMediaSlides(item);
                const cardSlideIdx = Math.min(
                  cardSlideIndices[item.id] ?? 0,
                  Math.max(0, slides.length - 1),
                );
                const activeCardSlide = slides[cardSlideIdx] ?? slides[0];
                return (
                  <article className="media-card" key={item.id}>
                    <div
                      className="media-preview"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelected(item);
                        setSelectedSlideIndex(cardSlideIdx);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(item);
                          setSelectedSlideIndex(cardSlideIdx);
                        }
                      }}
                    >
                      <MediaArtwork item={item} slideUrl={activeCardSlide?.thumbnailUrl} />
                      <span className="preview-overlay">
                        <Eye size={18} />{" "}
                        {slides.length > 1
                          ? `สไลด์ดูทั้งชุด (${slides.length} ภาพ)`
                          : "ดูสื่อขยาย"}
                      </span>
                      <span className="media-type-pill">
                        {slides.length > 1 ? (
                          <Images size={13} />
                        ) : item.fileType.includes("pdf") ? (
                          <FileText size={13} />
                        ) : (
                          <ImageIcon size={13} />
                        )}
                        {getMediaTypeLabel(item)}
                      </span>
                      <span className={`phase-badge badge-${item.phase}`}>{phaseLabels[item.phase]}</span>

                      {slides.length > 1 && (
                        <>
                          <button
                            type="button"
                            className="card-slide-arrow prev"
                            aria-label="ภาพก่อนหน้า"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCardSlideIndices((current) => ({
                                ...current,
                                [item.id]: (cardSlideIdx - 1 + slides.length) % slides.length,
                              }));
                            }}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            className="card-slide-arrow next"
                            aria-label="ภาพถัดไป"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCardSlideIndices((current) => ({
                                ...current,
                                [item.id]: (cardSlideIdx + 1) % slides.length,
                              }));
                            }}
                          >
                            <ChevronRight size={16} />
                          </button>
                          <div className="card-slide-dots" aria-hidden="true">
                            {slides.map((slide, idx) => (
                              <span
                                key={`${slide.id}-${idx}`}
                                className={idx === cardSlideIdx ? "card-slide-dot is-active" : "card-slide-dot"}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="media-body">
                      <div className="media-card-tags">
                        {getItemCategories(item).map((catName) => {
                          const cfg = resolveTagConfig(catName, tagConfigs);
                          return (
                            <span
                              key={catName}
                              className="event-tag-badge compact"
                              style={{
                                color: cfg.textColor,
                                backgroundColor: cfg.bgColor,
                                borderColor: cfg.borderColor,
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setCategory(catName);
                              }}
                            >
                              <i className={cfg.icon} aria-hidden="true" />
                              {catName}
                            </span>
                          );
                        })}
                      </div>
                      <h3
                        onClick={() => {
                          setSelected(item);
                          setSelectedSlideIndex(cardSlideIdx);
                        }}
                      >
                        {item.title}
                      </h3>
                      <p>{item.description}</p>
                      <div className="media-meta-row">
                        <time dateTime={item.eventDate}>
                          <CalendarDays size={14} /> {formatThaiDate(item.eventDate)}
                        </time>
                        <span className="media-location">
                          <MapPin size={14} /> {item.location}
                        </span>
                      </div>
                      <div className="media-footer">
                        {(activeCardSlide?.downloadUrl || item.downloadUrl) ? (
                          <a
                            className="card-download-btn"
                            href={activeCardSlide?.downloadUrl || item.downloadUrl}
                            download
                            aria-label={`ดาวน์โหลด ${item.title}`}
                          >
                            <ArrowDownToLine size={16} /> ดาวน์โหลด
                          </a>
                        ) : (
                          <button
                            className="card-download-btn"
                            type="button"
                            onClick={downloadFallback}
                            aria-label={`ดาวน์โหลด ${item.title}`}
                          >
                            <ArrowDownToLine size={16} /> ดาวน์โหลด
                          </button>
                        )}
                        <button
                          className="card-share-btn"
                          type="button"
                          onClick={() => shareItem(item)}
                          aria-label={`แชร์ ${item.title}`}
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Search size={28} />
              <h3>ยังไม่พบสื่อที่ตรงกับการค้นหา</h3>
              <p>ลองเปลี่ยนคำค้นหา หรือเลือกช่วงเหตุการณ์อื่น</p>
              <button type="button" onClick={() => { setQuery(""); setPhase("all"); setCategory("ทั้งหมด"); }}>
                ดูสื่อทั้งหมด
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="trust-section" id="about">
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
            <nav className="footer-nav" aria-label="ลิงก์ส่วนท้าย">
              <a href="#top">หน้าแรก</a>
              <a href="#phases">ข้อมูลสถานการณ์</a>
              <a href="#gallery">คลังสื่อ</a>
              <a href="#about">เกี่ยวกับเรา</a>
              <a href="/developers">API สำหรับนักพัฒนา <Braces size={14} /></a>
              <a href="/admin">เข้าสู่ระบบผู้ดูแล <ArrowRight size={14} /></a>
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

      <nav className="mobile-bottom-nav" aria-label="เมนูทางลัด">
        <a href="#top"><Home size={20} /><span>หน้าแรก</span></a>
        <a href="#phases"><ShieldCheck size={20} /><span>ช่วงเหตุ</span></a>
        <a href="#gallery"><ImageIcon size={20} /><span>คลังสื่อ</span></a>
        <a href="/admin"><UserRound size={20} /><span>ผู้ดูแล</span></a>
      </nav>

      {selected && (() => {
        const slides = getMediaSlides(selected);
        const safeSlideIdx = Math.min(selectedSlideIndex, Math.max(0, slides.length - 1));
        const activeSlide = slides[safeSlideIdx] ?? slides[0];
        const activeDownloadUrl = activeSlide?.downloadUrl || selected.downloadUrl;
        return (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
            <div
              className="detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="detail-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button className="modal-close" type="button" aria-label="ปิด" onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
              <div
                className="detail-visual-column"
                onTouchStart={(event) => {
                  touchStartX.current = event.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => {
                  if (touchStartX.current === null || slides.length <= 1) return;
                  const deltaX = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
                  touchStartX.current = null;
                  if (Math.abs(deltaX) > 42) {
                    if (deltaX < 0) {
                      setSelectedSlideIndex((safeSlideIdx + 1) % slides.length);
                    } else {
                      setSelectedSlideIndex((safeSlideIdx - 1 + slides.length) % slides.length);
                    }
                  }
                }}
              >
                <div className="detail-visual-stage">
                  {slides.length > 1 && (
                    <span className="detail-slide-counter">
                      <Images size={14} /> ภาพที่ {safeSlideIdx + 1} / {slides.length}
                    </span>
                  )}

                  {slides.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="detail-slide-arrow prev"
                        aria-label="ดูภาพก่อนหน้า"
                        onClick={() =>
                          setSelectedSlideIndex((safeSlideIdx - 1 + slides.length) % slides.length)
                        }
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        type="button"
                        className="detail-slide-arrow next"
                        aria-label="ดูภาพถัดไป"
                        onClick={() =>
                          setSelectedSlideIndex((safeSlideIdx + 1) % slides.length)
                        }
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}

                  <button
                    className="detail-visual"
                    type="button"
                    onClick={() => setFullscreen(true)}
                    aria-label={`ดูภาพ ${selected.title} แบบเต็มหน้าจอ`}
                  >
                    <MediaArtwork item={selected} large slideUrl={activeSlide?.thumbnailUrl} />
                    <span className="fullscreen-hint">
                      <Maximize2 size={17} /> ดูเต็มหน้าจอ
                    </span>
                  </button>
                </div>

                {slides.length > 1 && (
                  <div className="detail-slide-thumbs" aria-label="เลือกรูปภาพในหัวข้อนี้">
                    {slides.map((slide, idx) => (
                      <button
                        key={`${slide.id}-${idx}`}
                        type="button"
                        className={
                          idx === safeSlideIdx ? "detail-thumb-btn is-active" : "detail-thumb-btn"
                        }
                        onClick={() => setSelectedSlideIndex(idx)}
                        aria-label={`ดูภาพที่ ${idx + 1}`}
                      >
                        {slide.thumbnailUrl ? (
                          <img src={slide.thumbnailUrl} alt={`ภาพที่ ${idx + 1}`} />
                        ) : (
                          <ImageIcon size={16} />
                        )}
                        <span>{idx + 1}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="detail-copy">
                <div className="detail-badges">
                  <span className={`phase-badge badge-${selected.phase}`}>{phaseLabels[selected.phase]}</span>
                  {getItemCategories(selected).map((catName) => {
                    const cfg = resolveTagConfig(catName, tagConfigs);
                    return (
                      <span
                        key={catName}
                        className="event-tag-badge"
                        style={{
                          color: cfg.textColor,
                          backgroundColor: cfg.bgColor,
                          borderColor: cfg.borderColor,
                        }}
                      >
                        <i className={cfg.icon} aria-hidden="true" />
                        {catName}
                      </span>
                    );
                  })}
                  {slides.length > 1 && (
                    <span className="detail-multi-badge">
                      <Images size={13} /> ชุดสื่อ {slides.length} ภาพ
                    </span>
                  )}
                </div>
                <h2 id="detail-title">{selected.title}</h2>
                <p>{selected.description}</p>
                <dl>
                  <div><dt><MapPin size={16} /> พื้นที่</dt><dd>{selected.location}</dd></div>
                  <div><dt><CalendarDays size={16} /> วันที่</dt><dd>{formatThaiDate(selected.eventDate)}</dd></div>
                </dl>
                <div className="keyword-list">
                  {selected.keywords.map((keyword) => <span key={keyword}>#{keyword}</span>)}
                </div>
                <div className="detail-actions">
                  {activeDownloadUrl ? (
                    <a className="primary-action" href={activeDownloadUrl} download>
                      <ArrowDownToLine size={18} />{" "}
                      {slides.length > 1
                        ? `ดาวน์โหลดภาพนี้ (${safeSlideIdx + 1}/${slides.length})`
                        : "ดาวน์โหลดสื่อ"}
                    </a>
                  ) : (
                    <button className="primary-action" type="button" onClick={downloadFallback}>
                      <ArrowDownToLine size={18} /> ดาวน์โหลดสื่อ
                    </button>
                  )}
                  <button className="secondary-action" type="button" onClick={() => shareItem(selected)}>
                    <Share2 size={18} /> แชร์ต่อ
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {selected && fullscreen && (() => {
        const slides = getMediaSlides(selected);
        const safeSlideIdx = Math.min(selectedSlideIndex, Math.max(0, slides.length - 1));
        const activeSlide = slides[safeSlideIdx] ?? slides[0];
        return (
          <div
            className="fullscreen-viewer"
            role="dialog"
            aria-modal="true"
            aria-label={`ภาพเต็มหน้าจอ ${selected.title}`}
            onMouseDown={() => setFullscreen(false)}
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (touchStartX.current === null || slides.length <= 1) return;
              const deltaX = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(deltaX) > 42) {
                if (deltaX < 0) {
                  setSelectedSlideIndex((safeSlideIdx + 1) % slides.length);
                } else {
                  setSelectedSlideIndex((safeSlideIdx - 1 + slides.length) % slides.length);
                }
              }
            }}
          >
            <button
              className="fullscreen-close"
              type="button"
              aria-label="ปิดภาพเต็มหน้าจอ"
              onClick={() => setFullscreen(false)}
            >
              <X size={23} />
            </button>
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  className="fullscreen-slide-arrow prev"
                  aria-label="ภาพก่อนหน้า"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedSlideIndex((safeSlideIdx - 1 + slides.length) % slides.length);
                  }}
                >
                  <ChevronLeft size={26} />
                </button>
                <button
                  type="button"
                  className="fullscreen-slide-arrow next"
                  aria-label="ภาพถัดไป"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedSlideIndex((safeSlideIdx + 1) % slides.length);
                  }}
                >
                  <ChevronRight size={26} />
                </button>
              </>
            )}
            <div
              className="fullscreen-stage"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <MediaArtwork item={selected} large slideUrl={activeSlide?.thumbnailUrl} />
            </div>
            <div className="fullscreen-caption">
              {selected.title}
              {slides.length > 1 ? ` • ภาพที่ ${safeSlideIdx + 1} จาก ${slides.length}` : ""}
            </div>
          </div>
        );
      })()}

      <PublicServiceViewer serviceId={activeService} onClose={() => setActiveService(null)} />

      {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
    </main>
  );
}
