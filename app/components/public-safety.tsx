"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  ExternalLink,
  Eye,
  Images,
  LifeBuoy,
  Map as MapIcon,
  MapPin,
  Phone,
  ScanSearch,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getItemCategories,
  optimizeThumbnailUrl,
  resolveTagConfig,
  type CategoryTagConfig,
} from "../lib/category-tags";
import { getMediaSlides } from "../lib/media-gallery-utils";
import {
  SEVERITY_META,
  type WatchSituationConfig,
} from "../lib/watch-situation";
import type { IncidentPhase, MediaItem } from "../types";

/* =========================================================
   Static data (Satun Geo-EOC)
   ========================================================= */

export const EMERGENCY_NUMBERS = [
  { number: "1669", label: "เจ็บป่วยฉุกเฉิน" },
  { number: "1784", label: "สาธารณภัย (ปภ.)" },
  { number: "191", label: "เหตุด่วนเหตุร้าย" },
  { number: "199", label: "ดับเพลิง" },
] as const;

const EOC_BASE = "https://stn.moph.go.th/stn-eoc";

export type PublicServiceId = "fakenews" | "help" | "map";

type PublicService = {
  id: PublicServiceId;
  label: string;
  shortLabel: string;
  description: string;
  url: string;
  icon: typeof ScanSearch;
  tone: "violet" | "red" | "teal";
  /**
   * The provider must allow framing (no `X-Frame-Options: DENY/SAMEORIGIN`
   * and a permissive `frame-ancestors`) for the in-page iframe to work.
   */
  embeddable: boolean;
};

// stn.moph.go.th is operated by the same provincial health office. If its
// team allows this site in `frame-ancestors`, set NEXT_PUBLIC_EOC_EMBED=true
// to show the EOC pages directly inside the in-page viewer.
const EOC_EMBED_ENABLED = process.env.NEXT_PUBLIC_EOC_EMBED === "true";

export const PUBLIC_SERVICES: PublicService[] = [
  {
    id: "fakenews",
    label: "ตรวจสอบ Fake News",
    shortLabel: "เช็กข่าวปลอม",
    description: "ตรวจสอบภาพ/ข่าวที่อาจสร้างจาก AI ด้วย SynthID ก่อนแชร์ต่อ",
    url: "https://synthid.com/",
    icon: ScanSearch,
    tone: "violet",
    embeddable: false, // synthid.com sends X-Frame-Options: SAMEORIGIN
  },
  {
    id: "help",
    label: "ขอความช่วยเหลือ",
    shortLabel: "ขอความช่วยเหลือ",
    description: "แจ้งเหตุและกรอกข้อมูลขอความช่วยเหลือถึงศูนย์ปฏิบัติการภาวะฉุกเฉิน จ.สตูล",
    url: `${EOC_BASE}/public/report-incident/`,
    icon: LifeBuoy,
    tone: "red",
    embeddable: EOC_EMBED_ENABLED,
  },
  {
    id: "map",
    label: "แผนที่สถานการณ์และความเสี่ยง",
    shortLabel: "แผนที่ความเสี่ยง",
    description: "ติดตามฝน ระดับน้ำ และพื้นที่เสี่ยงแบบเรียลไทม์บนแผนที่ Satun Geo-EOC",
    url: `${EOC_BASE}/public/weather-watch/`,
    icon: MapIcon,
    tone: "teal",
    embeddable: EOC_EMBED_ENABLED,
  },
];

const phaseLabels: Record<IncidentPhase, string> = {
  before: "ก่อนเกิดเหตุ",
  during: "ระหว่างเกิดเหตุ",
  after: "หลังเกิดเหตุ",
};

function formatThaiDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

/* =========================================================
   Emergency hotlines grid
   ========================================================= */

export function EmergencyHotlines({
  title = "เบอร์ฉุกเฉิน (โทรฟรี 24 ชม.)",
  variant = "dark",
}: {
  title?: string;
  variant?: "dark" | "light";
}) {
  return (
    <div className={`hotline-box hotline-${variant}`}>
      <h4>
        <Phone size={16} aria-hidden="true" /> {title}
      </h4>
      <ul className="hotline-grid">
        {EMERGENCY_NUMBERS.map((entry) => (
          <li key={entry.number}>
            <a href={`tel:${entry.number}`} aria-label={`โทร ${entry.number} ${entry.label}`}>
              <strong>{entry.number}</strong>
              <span>{entry.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* =========================================================
   Public quick-service bar + in-page viewer
   ========================================================= */

export function PublicServiceBar({
  onOpen,
  compact = false,
}: {
  onOpen: (id: PublicServiceId) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "public-service-bar is-compact" : "public-service-bar"}>
      {PUBLIC_SERVICES.map((service) => {
        const Icon = service.icon;
        return (
          <button
            key={service.id}
            type="button"
            className={`public-service-btn tone-${service.tone}`}
            onClick={() => onOpen(service.id)}
          >
            <span className="public-service-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="public-service-copy">
              <strong>{compact ? service.shortLabel : service.label}</strong>
              {!compact && <small>{service.description}</small>}
            </span>
            <ArrowRight size={16} aria-hidden="true" className="public-service-arrow" />
          </button>
        );
      })}
    </div>
  );
}

const FAKE_NEWS_CHECKLIST = [
  "ตรวจสอบแหล่งที่มา: มาจากหน่วยงานราชการหรือสื่อที่เชื่อถือได้หรือไม่",
  "ดูวันที่เผยแพร่: เป็นข่าวเก่าที่ถูกนำกลับมาแชร์ใหม่หรือเปล่า",
  "สังเกตภาพ: มีร่องรอยการตัดต่อ หรือเป็นภาพที่สร้างจาก AI หรือไม่ (ใช้ SynthID ช่วยตรวจ)",
  "เทียบกับประกาศของ สสจ.สตูล / ศูนย์ EOC จังหวัดสตูล",
  "ถ้ายังไม่แน่ใจ อย่าเพิ่งแชร์ต่อ",
];

export function PublicServiceViewer({
  serviceId,
  onClose,
}: {
  serviceId: PublicServiceId | null;
  onClose: () => void;
}) {
  const service = PUBLIC_SERVICES.find((item) => item.id === serviceId) ?? null;
  const [checked, setChecked] = useState<number[]>([]);

  useEffect(() => {
    if (!service) return;
    setChecked([]);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [service, onClose]);

  if (!service) return null;
  const Icon = service.icon;

  return (
    <div className="service-viewer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`service-viewer tone-${service.tone}${service.embeddable ? " is-embedded" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-viewer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="service-viewer-header">
          <div className="service-viewer-title">
            <span className="service-viewer-icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <div>
              <small>บริการสำหรับประชาชน</small>
              <h2 id="service-viewer-title">{service.label}</h2>
            </div>
          </div>
          <button type="button" className="service-viewer-close" onClick={onClose}>
            <X size={18} /> ปิด
          </button>
        </header>

        {service.embeddable ? (
          <div className="service-viewer-frame-wrap">
            <iframe
              src={service.url}
              title={service.label}
              className="service-viewer-frame"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="service-viewer-body">
            <p className="service-viewer-lead">{service.description}</p>

            {service.id === "fakenews" && (
              <div className="service-checklist">
                <h3>
                  <ShieldAlert size={17} aria-hidden="true" /> เช็กลิสต์ก่อนแชร์ข่าวสุขภาพ
                </h3>
                <ul>
                  {FAKE_NEWS_CHECKLIST.map((text, idx) => {
                    const isChecked = checked.includes(idx);
                    return (
                      <li key={text}>
                        <button
                          type="button"
                          className={isChecked ? "is-checked" : ""}
                          aria-pressed={isChecked}
                          onClick={() =>
                            setChecked((current) =>
                              current.includes(idx)
                                ? current.filter((value) => value !== idx)
                                : [...current, idx],
                            )
                          }
                        >
                          <span className="check-box">{isChecked && <Check size={13} />}</span>
                          {text}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {checked.length === FAKE_NEWS_CHECKLIST.length && (
                  <p className="service-checklist-done">
                    <Check size={15} /> ตรวจครบทุกข้อแล้ว ข่าวนี้มีแนวโน้มน่าเชื่อถือมากขึ้น
                  </p>
                )}
              </div>
            )}

            {service.id === "help" && (
              <>
                <EmergencyHotlines title="กรณีเร่งด่วน โทรทันที (ฟรี 24 ชม.)" variant="light" />
                <div className="service-checklist">
                  <h3>
                    <AlertTriangle size={17} aria-hidden="true" /> เตรียมข้อมูลก่อนแจ้งขอความช่วยเหลือ
                  </h3>
                  <ul className="service-plain-list">
                    <li>ชื่อผู้แจ้งและเบอร์โทรศัพท์ที่ติดต่อกลับได้</li>
                    <li>ตำแหน่งหรือจุดสังเกตของสถานที่เกิดเหตุ (อำเภอ/ตำบล/หมู่บ้าน)</li>
                    <li>ลักษณะเหตุการณ์ จำนวนผู้ได้รับผลกระทบ และผู้ป่วยติดเตียง/กลุ่มเปราะบาง</li>
                    <li>ภาพถ่ายประกอบ (ถ้ามี)</li>
                  </ul>
                </div>
              </>
            )}

            {service.id === "map" && (
              <div className="service-checklist">
                <h3>
                  <MapIcon size={17} aria-hidden="true" /> ข้อมูลที่ดูได้บนแผนที่
                </h3>
                <ul className="service-plain-list">
                  <li>ระดับน้ำในคลองและปริมาณฝน (ThaiWater สสน.)</li>
                  <li>พยากรณ์และโอกาสฝนหนัก (ECMWF / Open-Meteo)</li>
                  <li>ภาพเรดาร์ฝน แผนที่ลมและคลื่น</li>
                  <li>เหตุการณ์และศูนย์พักพิงที่เจ้าหน้าที่บันทึก</li>
                </ul>
              </div>
            )}

            <div className="service-viewer-note">
              <AlertTriangle size={16} aria-hidden="true" />
              <p>
                เว็บไซต์ปลายทางตั้งค่าความปลอดภัยไม่อนุญาตให้แสดงซ้อนภายในเว็บไซต์อื่น
                ระบบจึงจะพาไปยังหน้าบริการในแท็บเดิม (ไม่เปิดแท็บใหม่) และสามารถกดย้อนกลับเพื่อกลับมาหน้านี้ได้ทันที
              </p>
            </div>

            <a className="service-viewer-go" href={service.url}>
              ไปที่{service.label} <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   Watch situation container (homepage)
   ========================================================= */

export function WatchSituationBanner({
  config,
  mediaItems,
  tagConfigs,
  onOpenMedia,
  onOpenService,
  onViewAll,
}: {
  config: WatchSituationConfig;
  mediaItems: MediaItem[];
  tagConfigs: CategoryTagConfig[];
  onOpenMedia: (item: MediaItem) => void;
  onOpenService: (id: PublicServiceId) => void;
  onViewAll: () => void;
}) {
  if (!config.enabled) return null;
  const meta = SEVERITY_META[config.severity];
  const advisoryLines = config.advisoryText
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <section
      className={`watch-situation severity-${config.severity}`}
      id="watch"
      aria-labelledby="watch-situation-title"
      aria-live="polite"
    >
      <div className="container">
        <div className="watch-shell">
          <div className="watch-head">
            <span className="watch-badge">
              <span className="watch-pulse" aria-hidden="true" />
              <i className={meta.icon} aria-hidden="true" />
              {meta.badgeText}
            </span>
            <span className="watch-updated">
              <CalendarDays size={14} aria-hidden="true" /> อัปเดต {formatThaiDateTime(config.updatedAt)}
              {config.updatedBy ? ` • ${config.updatedBy}` : ""}
            </span>
          </div>

          <div className="watch-grid">
            <div className="watch-copy">
              <h2 id="watch-situation-title">{config.title}</h2>
              <p className="watch-subtitle">{config.subtitle}</p>

              <div className="watch-meta">
                <span>
                  <MapPin size={15} aria-hidden="true" /> {config.location}
                </span>
                {config.phase !== "all" && (
                  <span className={`phase-badge badge-${config.phase}`}>{phaseLabels[config.phase]}</span>
                )}
                {config.categories.map((cat) => {
                  const cfg = resolveTagConfig(cat, tagConfigs);
                  return (
                    <span
                      key={cat}
                      className="event-tag-badge compact"
                      style={{ color: cfg.textColor, backgroundColor: cfg.bgColor, borderColor: cfg.borderColor }}
                    >
                      <i className={cfg.icon} aria-hidden="true" /> {cat}
                    </span>
                  );
                })}
              </div>

              {advisoryLines.length > 0 && (
                <ul className="watch-advisory">
                  {advisoryLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}

              <div className="watch-actions">
                <button type="button" className="watch-btn-primary" onClick={onViewAll}>
                  ดูสื่อที่ต้องรู้ในช่วงนี้ <ArrowRight size={16} />
                </button>
                <button type="button" className="watch-btn-danger" onClick={() => onOpenService("help")}>
                  <LifeBuoy size={16} /> ขอความช่วยเหลือ
                </button>
                <button type="button" className="watch-btn-ghost" onClick={() => onOpenService("map")}>
                  <MapIcon size={16} /> แผนที่ความเสี่ยง
                </button>
              </div>
            </div>

            <aside className="watch-side">
              <EmergencyHotlines />
            </aside>
          </div>

          {mediaItems.length > 0 && (
            <div className="watch-media">
              <h3>
                <Eye size={16} aria-hidden="true" /> สื่อที่ประชาชนควรรับรู้ในสถานการณ์นี้
              </h3>
              <div className="watch-media-grid">
                {mediaItems.map((item) => {
                  const slides = getMediaSlides(item);
                  const thumb = optimizeThumbnailUrl(slides[0]?.thumbnailUrl || item.thumbnailUrl, 480);
                  const firstCat = getItemCategories(item)[0];
                  const cfg = firstCat ? resolveTagConfig(firstCat, tagConfigs) : null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="watch-media-card"
                      onClick={() => onOpenMedia(item)}
                    >
                      <span className="watch-media-thumb">
                        {thumb ? (
                          <img src={thumb} alt={item.altText} loading="lazy" decoding="async" />
                        ) : (
                          <Images size={22} aria-hidden="true" />
                        )}
                        {slides.length > 1 && (
                          <span className="watch-media-count">
                            <Images size={11} /> {slides.length}
                          </span>
                        )}
                      </span>
                      <span className="watch-media-copy">
                        {cfg && firstCat && (
                          <span className="watch-media-tag" style={{ color: cfg.textColor }}>
                            <i className={cfg.icon} aria-hidden="true" /> {firstCat}
                          </span>
                        )}
                        <strong>{item.title}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Footer panel with Satun Geo-EOC information
   ========================================================= */

const EOC_HELP_LINKS = [
  { label: "ติดต่อหน่วยงาน", href: `${EOC_BASE}/public/agencies/` },
  { label: "คำถามที่พบบ่อย", href: `${EOC_BASE}/public/help/faq/` },
  { label: "ข้อมูลเชิงลึกและสถิติ (สำหรับสื่อ/นักวิจัย)", href: `${EOC_BASE}/public/insights/` },
  { label: "นโยบายความเป็นส่วนตัว", href: `${EOC_BASE}/privacy-policy/` },
];

const RELATED_LINKS = [
  { label: "สำนักงานสาธารณสุขจังหวัดสตูล", href: "https://satun.moph.go.th/" },
  { label: "กระทรวงสาธารณสุข", href: "https://www.moph.go.th/" },
  { label: "ศูนย์ปฏิบัติการภาวะฉุกเฉิน จ.สตูล (Satun Geo-EOC)", href: `${EOC_BASE}/` },
];

const DATA_PARTNERS = [
  { name: "GISTDA (สทอภ.)", detail: "ฝุ่น PM2.5 • พื้นที่น้ำท่วมซ้ำซาก", href: "https://www.gistda.or.th/" },
  { name: "ThaiWater (สสน.)", detail: "ระดับน้ำ • ปริมาณฝน • คำเตือน", href: "https://www.thaiwater.net/" },
  { name: "กรมอุตุนิยมวิทยา", detail: "พยากรณ์อากาศ • เรดาร์ฝน", href: "https://www.tmd.go.th/" },
  { name: "Open-Meteo", detail: "พยากรณ์ฝน/ลม/คลื่น • ระดับน้ำทะเล", href: "https://open-meteo.com/" },
  { name: "RainViewer", detail: "ภาพเรดาร์ฝน", href: "https://www.rainviewer.com/" },
  { name: "Windy.com", detail: "แผนที่ลม/คลื่น", href: "https://www.windy.com/" },
  { name: "IOC Sea Level Monitoring (UNESCO)", detail: "ระดับน้ำทะเล • น้ำทะเลหนุน", href: "https://www.ioc-sealevelmonitoring.org/" },
];

export function EocFooterPanel() {
  return (
    <div className="eoc-footer-panel">
      <div className="container eoc-footer-grid">
        <div className="eoc-footer-col">
          <h4>ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล</h4>
          <p>Satun Provincial Emergency Operations Center (Satun Geo-EOC)</p>
          <dl className="eoc-data-sources">
            <div><dt>ระดับน้ำในคลอง / ฝนที่วัดได้</dt><dd>ThaiWater (สสน.)</dd></div>
            <div><dt>พยากรณ์และโอกาสฝนหนัก</dt><dd>ECMWF</dd></div>
            <div><dt>เหตุการณ์และศูนย์พักพิง</dt><dd>ศูนย์ปฏิบัติการภาวะฉุกเฉิน จ.สตูล</dd></div>
          </dl>
        </div>

        <div className="eoc-footer-col">
          <EmergencyHotlines />
        </div>

        <div className="eoc-footer-col">
          <h4>ข้อมูลและความช่วยเหลือ</h4>
          <ul className="eoc-link-list">
            {EOC_HELP_LINKS.map((link) => (
              <li key={link.href}><a href={link.href}>{link.label}</a></li>
            ))}
          </ul>
          <h4 className="eoc-subhead">ลิงก์ที่เกี่ยวข้อง</h4>
          <ul className="eoc-link-list">
            {RELATED_LINKS.map((link) => (
              <li key={link.href}><a href={link.href}>{link.label}</a></li>
            ))}
          </ul>
        </div>

        <div className="eoc-footer-col">
          <h4>ขอขอบคุณหน่วยงานที่ให้ข้อมูล</h4>
          <ul className="eoc-partner-list">
            {DATA_PARTNERS.map((partner) => (
              <li key={partner.href}>
                <a href={partner.href}>
                  <strong>{partner.name}</strong>
                  <span>{partner.detail}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="container eoc-footer-disclaimer">
        <p>
          ข้อมูลสถานการณ์ประเมินและอัปเดตอัตโนมัติ ไม่ใช่ประกาศทางราชการ โปรดยึดประกาศของหน่วยงานราชการเป็นหลัก •
          © 2025–2026 สำนักงานสาธารณสุขจังหวัดสตูล
        </p>
      </div>
    </div>
  );
}
