"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  CloudRain,
  Eye,
  FileText,
  HeartPulse,
  Home,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  Menu,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
    description: "รู้ความเสี่ยง เตรียมคน เตรียมของ และติดตามสัญญาณเตือน",
    icon: ShieldCheck,
  },
  {
    id: "during",
    step: "02",
    title: "ระหว่างเกิดเหตุ",
    description: "ข้อมูลที่ต้องรู้ทันที เพื่อลดอันตรายและตัดสินใจอย่างปลอดภัย",
    icon: AlertTriangle,
  },
  {
    id: "after",
    step: "03",
    title: "หลังเกิดเหตุ",
    description: "ฟื้นฟูสุขภาพ ทำความสะอาด และป้องกันเหตุหรือโรคซ้ำ",
    icon: ClipboardCheck,
  },
];

const phaseLabels: Record<IncidentPhase, string> = {
  before: "ก่อนเกิดเหตุ",
  during: "ระหว่างเกิดเหตุ",
  after: "หลังเกิดเหตุ",
};

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

function getVisualClass(category: string) {
  if (category.includes("น้ำ")) return "flood";
  if (category.includes("โรค")) return "health";
  if (category.includes("หมอก") || category.includes("ฝุ่น")) return "haze";
  if (category.includes("อุบัติเหตุ")) return "road";
  return "recovery";
}

function MediaArtwork({ item, large = false }: { item: MediaItem; large?: boolean }) {
  const visual = getVisualClass(item.category);
  if (item.thumbnailUrl) {
    return (
      <img
        className={large ? "detail-image" : "media-image"}
        src={item.thumbnailUrl}
        alt={item.altText}
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

function MediaGallerySkeleton() {
  return (
    <main
      className="site-shell site-data-skeleton"
      id="top"
      aria-busy="true"
      aria-describedby="gallery-loading-status"
    >
      <div className="top-ribbon">
        <div className="container ribbon-inner">
          <span><HeartPulse size={15} /> ศูนย์สื่อสารความเสี่ยงด้านสุขภาพ จังหวัดสตูล</span>
          <span>ข้อมูลเพื่อประชาชน • ใช้งานและเผยแพร่ต่อได้</span>
        </div>
      </div>

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
            <div className="island-shape island-shape-one" />
            <div className="island-shape island-shape-two" />
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
            {[0, 1, 2, 3, 4, 5].map((item) => (
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
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/media")
      .then((response) => response.json() as Promise<MediaResponse>)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setSource(result.source);
        setSourceMessage(result.message ?? "");
        const requestedId = new URLSearchParams(window.location.search).get(
          "media",
        );
        const requestedItem = result.items.find(
          (item) => item.id === requestedId,
        );
        if (requestedItem) setSelected(requestedItem);
      })
      .catch(() => {
        if (active) setSourceMessage("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (fullscreen) setFullscreen(false);
      else setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
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
    () => ["ทั้งหมด", ...Array.from(new Set(items.map((item) => item.category)))],
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return items.filter((item) => {
      const matchesPhase = phase === "all" || item.phase === phase;
      const matchesCategory = category === "ทั้งหมด" || item.category === category;
      const haystack = [
        item.title,
        item.description,
        item.location,
        item.category,
        ...item.keywords,
      ]
        .join(" ")
        .toLocaleLowerCase("th");
      return matchesPhase && matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [category, items, phase, query]);

  const featured = items[0];

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
      <div className="top-ribbon">
        <div className="container ribbon-inner">
          <span><HeartPulse size={15} /> ศูนย์สื่อสารความเสี่ยงด้านสุขภาพ จังหวัดสตูล</span>
          <span>ข้อมูลเพื่อประชาชน • ใช้งานและเผยแพร่ต่อได้</span>
        </div>
      </div>

      <header className="site-header">
        <div className="container nav-wrap">
          <a className="brand" href="#" aria-label="กลับไปหน้าแรก">
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
            <a href="#phases" onClick={() => setMenuOpen(false)}>ช่วงเหตุการณ์</a>
            <a href="#gallery" onClick={() => setMenuOpen(false)}>คลังสื่อ</a>
            <a href="#about" onClick={() => setMenuOpen(false)}>เกี่ยวกับเรา</a>
            <a className="admin-link" href="/admin">
              สำหรับผู้ดูแล <ArrowRight size={16} />
            </a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-pattern" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={16} /> SATUN RISK COMMUNICATION HUB</span>
            <h1>รู้ก่อน เตรียมพร้อม<br />รับมือไปด้วยกัน</h1>
            <p>
              ศูนย์รวมสื่อที่เชื่อถือได้สำหรับอุบัติการณ์ในจังหวัดสตูล
              ตั้งแต่การเตรียมตัว การรับมือ จนถึงการฟื้นฟูหลังเหตุการณ์
            </p>
            <label className="hero-search">
              <Search size={21} aria-hidden="true" />
              <span className="sr-only">ค้นหาสื่อ</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={jumpToGallery}
                placeholder="ค้นหาเหตุการณ์ พื้นที่ หรือคำแนะนำ..."
              />
              <button type="button" onClick={jumpToGallery}>ค้นหา</button>
            </label>
            <div className="hero-metrics" aria-label="สรุปข้อมูล">
              <span><strong>{items.length || "—"}</strong> สื่อพร้อมใช้</span>
              <span><strong>3</strong> ช่วงเหตุการณ์</span>
              <span><strong>7</strong> อำเภอในสตูล</span>
            </div>
          </div>

          <div className="hero-panel">
            <div className="island-shape island-shape-one" />
            <div className="island-shape island-shape-two" />
            <div className="alert-card">
              <div className="alert-card-head">
                <span className="live-dot" />
                <span>ประกาศที่ควรติดตาม</span>
                <small>อัปเดตล่าสุด</small>
              </div>
              <div className="alert-icon"><CloudRain size={34} /></div>
              <p>เฝ้าระวัง</p>
              <h2>{featured?.title ?? "เฝ้าระวังเหตุการณ์ในจังหวัดสตูล"}</h2>
              <div className="alert-meta">
                <span><MapPin size={15} /> {featured?.location ?? "จังหวัดสตูล"}</span>
                <span><CalendarDays size={15} /> {featured ? formatThaiDate(featured.eventDate) : "วันนี้"}</span>
              </div>
              <button type="button" onClick={() => featured && setSelected(featured)}>
                ดูข้อมูลฉบับเต็ม <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {source === "demo" && sourceMessage && (
        <div className="container demo-notice" role="status">
          <span><AlertTriangle size={17} /></span>
          <p><strong>เวอร์ชันทดลอง:</strong> {sourceMessage}</p>
        </div>
      )}

      <section className="phase-section" id="phases">
        <div className="container">
          <div className="section-heading phase-heading">
            <div>
              <span className="section-kicker">ข้อมูลตามช่วงเวลา</span>
              <h2>เลือกสื่อให้ตรงกับสถานการณ์</h2>
            </div>
            <p>แต่ละช่วงต้องการข้อมูลและการตัดสินใจที่ต่างกัน เลือกช่วงที่คุณกำลังเผชิญอยู่</p>
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
                    <em>{count} รายการ <ArrowRight size={15} /></em>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="gallery-section" id="gallery">
        <div className="container">
          <div className="section-heading gallery-heading">
            <div>
              <span className="section-kicker">MEDIA GALLERY</span>
              <h2>สื่อล่าสุดเพื่อประชาชน</h2>
            </div>
            <p>ดู ดาวน์โหลด และแชร์ต่อได้ทันที เพื่อให้ข้อมูลที่ถูกต้องไปถึงคนที่ต้องการ</p>
          </div>

          <div className="gallery-tools">
            <label className="gallery-search">
              <Search size={18} />
              <span className="sr-only">ค้นหาในคลังสื่อ</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาในคลังสื่อ"
              />
              {query && (
                <button type="button" aria-label="ล้างคำค้น" onClick={() => setQuery("")}>
                  <X size={17} />
                </button>
              )}
            </label>
            <div className="filter-chips" aria-label="กรองตามประเภท">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={category === item ? "filter-chip is-active" : "filter-chip"}
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                >
                  {category === item && <Check size={14} />}
                  {item}
                </button>
              ))}
            </div>
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
          </div>

          <div className="result-line">
            <span>พบ <strong>{filteredItems.length}</strong> รายการ</span>
            {phase !== "all" && <span className="active-filter">{phaseLabels[phase]}</span>}
          </div>

          {filteredItems.length ? (
            <div className="gallery-grid">
              {filteredItems.map((item) => (
                <article className="media-card" key={item.id}>
                  <button className="media-preview" type="button" onClick={() => setSelected(item)}>
                    <MediaArtwork item={item} />
                    <span className="preview-overlay"><Eye size={18} /> ดูสื่อ</span>
                    <span className={`phase-badge badge-${item.phase}`}>{phaseLabels[item.phase]}</span>
                  </button>
                  <div className="media-body">
                    <div className="media-category">
                      <span>{item.fileType.includes("pdf") ? <FileText size={15} /> : <ImageIcon size={15} />}</span>
                      {item.category}
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="media-location"><MapPin size={14} /> {item.location}</div>
                    <div className="media-footer">
                      <time dateTime={item.eventDate}>{formatThaiDate(item.eventDate)}</time>
                      <div>
                        {item.downloadUrl ? (
                          <a href={item.downloadUrl} download aria-label={`ดาวน์โหลด ${item.title}`}>
                            <ArrowDownToLine size={17} />
                          </a>
                        ) : (
                          <button type="button" onClick={downloadFallback} aria-label={`ดาวน์โหลด ${item.title}`}>
                            <ArrowDownToLine size={17} />
                          </button>
                        )}
                        <button type="button" onClick={() => shareItem(item)} aria-label={`แชร์ ${item.title}`}>
                          <Share2 size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
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
          <div>
            <span className="section-kicker">สื่อสารอย่างรับผิดชอบ</span>
            <h2>ข้อมูลที่ชัดเจน<br />ช่วยให้ชุมชนตัดสินใจได้ดีขึ้น</h2>
          </div>
          <div className="trust-points">
            <div><ShieldCheck size={22} /><span><strong>ตรวจสอบได้</strong><small>เผยแพร่จากหน่วยงานสาธารณสุขจังหวัด</small></span></div>
            <div><Share2 size={22} /><span><strong>พร้อมกระจายต่อ</strong><small>ดาวน์โหลดและแชร์ไปยังชุมชนได้ง่าย</small></span></div>
            <div><MapPin size={22} /><span><strong>ตรงบริบทพื้นที่</strong><small>ค้นหาตามเหตุการณ์และพื้นที่ในจังหวัดสตูล</small></span></div>
          </div>
        </div>
      </section>

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
          <div className="footer-actions">
            <span className="visitor-counter" title="นับหนึ่งครั้งต่อการเข้าใช้งานในแต่ละรอบ">
              <Eye size={15} />
              ผู้เข้าชม {visitorStats?.totalViews.toLocaleString("th-TH") ?? "—"} ครั้ง
            </span>
            <a href="/admin">เข้าสู่ระบบผู้ดูแล <ArrowRight size={15} /></a>
          </div>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="เมนูทางลัด">
        <a href="#top"><Home size={20} /><span>หน้าแรก</span></a>
        <a href="#phases"><ShieldCheck size={20} /><span>ช่วงเหตุ</span></a>
        <a href="#gallery"><ImageIcon size={20} /><span>คลังสื่อ</span></a>
        <a href="/admin"><UserRound size={20} /><span>ผู้ดูแล</span></a>
      </nav>

      {selected && (
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
            <button
              className="detail-visual"
              type="button"
              onClick={() => setFullscreen(true)}
              aria-label={`ดูภาพ ${selected.title} แบบเต็มหน้าจอ`}
            >
              <MediaArtwork item={selected} large />
              <span className="fullscreen-hint">
                <Maximize2 size={17} /> ดูเต็มหน้าจอ
              </span>
            </button>
            <div className="detail-copy">
              <div className="detail-badges">
                <span className={`phase-badge badge-${selected.phase}`}>{phaseLabels[selected.phase]}</span>
                <span>{selected.category}</span>
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
                {selected.downloadUrl ? (
                  <a className="primary-action" href={selected.downloadUrl} download>
                    <ArrowDownToLine size={18} /> ดาวน์โหลดสื่อ
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
      )}

      {selected && fullscreen && (
        <div
          className="fullscreen-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`ภาพเต็มหน้าจอ ${selected.title}`}
          onMouseDown={() => setFullscreen(false)}
        >
          <button
            className="fullscreen-close"
            type="button"
            aria-label="ปิดภาพเต็มหน้าจอ"
            onClick={() => setFullscreen(false)}
          >
            <X size={23} />
          </button>
          <div
            className="fullscreen-stage"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <MediaArtwork item={selected} large />
          </div>
          <div className="fullscreen-caption">{selected.title}</div>
        </div>
      )}

      {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
    </main>
  );
}
