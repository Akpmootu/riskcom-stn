"use client";

import { AlertTriangle, Check, ChevronDown, LoaderCircle, Send, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PortalIdentity, PortalUser } from "@/app/auth-types";

type Option = { value: string; label: string; group?: string };

type SearchableSelectProps = {
  label: string;
  value: string;
  options: Option[];
  placeholder: string;
  required?: boolean;
  onChange: (value: string) => void;
  helper?: string;
};

const DEPARTMENTS = [
  "คุ้มครองผู้บริโภคและเภสัชสาธารณสุข",
  "การแพทย์แผนไทยและการแพทย์ทางเลือก",
  "อนามัยสิ่งแวดล้อมและอาชีวอนามัย",
  "ทันตสาธารณสุข",
  "ปฐมภูมิและเครือข่ายสุขภาพ",
  "พัฒนาคุณภาพและรูปแบบบริการ",
  "ควบคุมโรคไม่ติดต่อ สุขภาพจิตและยาเสพติด",
  "ควบคุมโรคติดต่อ",
  "ส่งเสริมสุขภาพ",
  "กลุ่มกฎหมาย",
  "สุขภาพดิจิทัล",
  "ประกันสุขภาพ",
  "บริหารทรัพยากรบุคคล",
  "พัฒนายุทธศาสตร์สาธารณสุข",
  "บริหารทั่วไป",
].map((label) => ({ value: label, label }));

const POSITION_LEVELS = [
  "ปฏิบัติการ",
  "ปฏิบัติงาน",
  "ชำนาญงาน",
  "ชำนาญการ",
  "ชำนาญการพิเศษ",
  "อาวุโส",
  "เชี่ยวชาญ",
];

const POSITION_LEVEL_MAP: Record<string, string[]> = {
  "ทันตแพทย์": ["ชำนาญการ", "ปฏิบัติการ"],
  "นักจัดการงานทั่วไป": ["ชำนาญการพิเศษ", "ชำนาญการ"],
  "นักทรัพยากรบุคคล": ["ชำนาญการพิเศษ", "ชำนาญการ"],
  "นักวิชาการคอมพิวเตอร์": ["ชำนาญการ", "ปฏิบัติการ"],
  "นักวิชาการพัสดุ": ["ชำนาญการ", "ปฏิบัติการ"],
  "นักวิชาการสาธารณสุข": ["ชำนาญการพิเศษ", "ชำนาญการ", "ปฏิบัติการ", "เชี่ยวชาญ"],
  "นักวิชาการเงินและบัญชี": ["ชำนาญการ"],
  "นักวิเคราะห์นโยบายและแผน": ["ชำนาญการพิเศษ", "ชำนาญการ"],
  "นักสาธารณสุข": ["ชำนาญการ", "ปฏิบัติการ"],
  "นิติกร": ["ชำนาญการพิเศษ", "ชำนาญการ", "ปฏิบัติการ"],
  "พยาบาลวิชาชีพ": ["ชำนาญการพิเศษ", "ชำนาญการ", "ปฏิบัติการ"],
  "เจ้าพนักงานการเงินและบัญชี": ["อาวุโส"],
  "เจ้าพนักงานทันตสาธารณสุข": ["ชำนาญงาน"],
  "เจ้าพนักงานธุรการ": ["ชำนาญงาน", "ปฏิบัติงาน"],
  "เจ้าพนักงานสาธารณสุข": ["ชำนาญงาน"],
  "เภสัชกร": ["ชำนาญการพิเศษ", "ชำนาญการ", "เชี่ยวชาญ"],
  "แพทย์แผนไทย": ["ชำนาญการพิเศษ", "ชำนาญการ", "ปฏิบัติการ"],
};

const POSITION_BASES = [
  "นายแพทย์สาธารณสุขจังหวัดสตูล",
  "นายแพทย์เชี่ยวชาญ (ด้านเวชกรรมป้องกัน)",
  "เภสัชกร",
  "นักวิชาการสาธารณสุข",
  "นักจัดการงานทั่วไป",
  "นักวิชาการเงินและบัญชี",
  "เจ้าพนักงานการเงินและบัญชี",
  "นักวิชาการพัสดุ",
  "นักทรัพยากรบุคคล",
  "เจ้าพนักงานบันทึกข้อมูล",
  "พนักงานธุรการ",
  "พนักงานขับรถยนต์",
  "พนักงานบริการ",
  "แม่บ้าน",
  "รปภ.",
  "คนสวน",
  "เจ้าพนักงานสาธารณสุข",
  "พนักงานโสตทัศนศึกษา",
  "พยาบาลวิชาชีพ",
  "เจ้าพนักงานธุรการ",
  "นักวิเคราะห์นโยบายและแผน",
  "นักสาธารณสุข",
  "นักวิชาการคอมพิวเตอร์",
  "นิติกร",
  "ทันตแพทย์",
  "เจ้าพนักงานทันตสาธารณสุข",
  "แพทย์แผนไทย",
  "นักวิชการสาธารณสุข",
].filter((value, index, values) => values.indexOf(value) === index).map((label) => ({ value: label, label }));

// แหล่งข้อมูลสถานบริการจะถูกเติมจากคอลัมน์ C ของไฟล์อ้างอิงเมื่อ Google Sheet เปิดให้อ่านได้
// ระหว่างนี้คงรายการระดับอำเภอและหน่วยงานหลักไว้ เพื่อให้สมาชิกพิมพ์ค้นหา/กรอกต่อได้
const FACILITY_OPTIONS: Option[] = [
  { value: "สำนักงานสาธารณสุขจังหวัดสตูล", label: "สำนักงานสาธารณสุขจังหวัดสตูล", group: "เมืองสตูล" },
  { value: "โรงพยาบาลสตูล", label: "โรงพยาบาลสตูล", group: "เมืองสตูล" },
  { value: "โรงพยาบาลควนโดน", label: "โรงพยาบาลควนโดน", group: "ควนโดน" },
  { value: "โรงพยาบาลควนกาหลง", label: "โรงพยาบาลควนกาหลง", group: "ควนกาหลง" },
  { value: "โรงพยาบาลท่าแพ", label: "โรงพยาบาลท่าแพ", group: "ท่าแพ" },
  { value: "โรงพยาบาลละงู", label: "โรงพยาบาลละงู", group: "ละงู" },
  { value: "โรงพยาบาลทุ่งหว้า", label: "โรงพยาบาลทุ่งหว้า", group: "ทุ่งหว้า" },
  { value: "โรงพยาบาลมะนัง", label: "โรงพยาบาลมะนัง", group: "มะนัง" },
];

function parsePosition(value: string) {
  const match = POSITION_LEVELS.slice().sort((a, b) => b.length - a.length).find((level) => value.endsWith(level));
  return match
    ? { base: value.slice(0, -match.length).trim(), level: match }
    : { base: value, level: "" };
}

function SearchableSelect({ label, value, options, placeholder, required, onChange, helper }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const menuId = `searchable-${label.replace(/[^a-zA-Z0-9ก-๙]+/g, "-")}`;
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("th");
    return options.filter((option) => !needle || option.label.toLocaleLowerCase("th").includes(needle) || option.group?.toLocaleLowerCase("th").includes(needle));
  }, [options, search]);

  function selectOption(option: Option) {
    onChange(option.value);
    setSearch(option.label);
    setOpen(false);
  }

  return (
    <label className="cinematic-field searchable-field">
      <span>{label} {required && <em>*</em>}</span>
      <div className="searchable-control">
        <input
          value={search}
          required={required}
          role="combobox"
          aria-expanded={open}
          aria-controls={menuId}
          aria-autocomplete="list"
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setSearch(event.target.value); onChange(event.target.value); setOpen(true); }}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {search && <button type="button" aria-label={`ล้าง${label}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSearch(""); onChange(""); setOpen(true); }}><X size={15} /></button>}
        <ChevronDown size={17} aria-hidden="true" />
        {open && (
          <div className="searchable-menu" id={menuId} role="listbox">
            {filtered.length > 0 ? filtered.map((option) => (
              <button type="button" key={`${option.group || "all"}-${option.value}`} role="option" aria-selected={option.value === value} onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(option)}>
                {option.group && <small>{option.group}</small>}
                <strong>{option.label}</strong>
              </button>
            )) : <div className="searchable-empty">ไม่พบรายการที่ค้นหา — สามารถพิมพ์ข้อมูลเองได้</div>}
          </div>
        )}
      </div>
      {helper && <small className="field-helper">{helper}</small>}
    </label>
  );
}

function PhoneOtpInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const digits = value.replace(/\D/g, "").slice(0, 10).split("");
  return (
    <label className="cinematic-field phone-otp-field">
      <span>เบอร์โทรติดต่อ <em>*</em></span>
      <div className="phone-otp-grid" role="group" aria-label="เบอร์โทรศัพท์ 10 หลัก">
        {Array.from({ length: 10 }, (_, index) => (
          <input
            key={index}
            value={digits[index] || ""}
            required
            maxLength={1}
            inputMode="numeric"
            aria-label={`เบอร์โทรหลักที่ ${index + 1}`}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "");
              const nextDigits = [...digits];
              nextDigits[index] = next.slice(-1);
              onChange(nextDigits.join("").slice(0, 10));
              if (next && event.currentTarget.nextElementSibling instanceof HTMLInputElement) event.currentTarget.nextElementSibling.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index] && event.currentTarget.previousElementSibling instanceof HTMLInputElement) event.currentTarget.previousElementSibling.focus();
            }}
          />
        ))}
      </div>
      <small className="field-helper">กรอกตัวเลขให้ครบ 10 หลัก เช่น 0812345678</small>
    </label>
  );
}

export function RegistrationForm({ identity, existingUser }: { identity: PortalIdentity; existingUser: PortalUser | null }) {
  const router = useRouter();
  const parsed = parsePosition(existingUser?.position || "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [positionBase, setPositionBase] = useState(parsed.base);
  const [positionLevel, setPositionLevel] = useState(parsed.level);
  const [department, setDepartment] = useState("");
  const [workplace, setWorkplace] = useState(existingUser?.workplace || "");
  const [phone, setPhone] = useState(existingUser?.phone || "");
  const positionOptions = POSITION_BASES;
  const levelOptions = (POSITION_LEVEL_MAP[positionBase] || POSITION_LEVELS).map((label) => ({ value: label, label }));
  const positionValue = positionBase ? `${positionBase}${positionLevel}` : "";

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const data = new FormData(event.currentTarget);
      data.set("position", positionValue);
      data.set("department", department);
      data.set("workplace", workplace);
      data.set("phone", phone);
      const response = await fetch("/api/registration", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(data.entries())) });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "ส่งคำขอใช้งานไม่สำเร็จ");
      setMessage({ type: "success", text: "ส่งคำขอใช้งานแล้ว กำลังนำไปยังหน้าติดตามสถานะ" });
      router.push("/admin/pending");
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "ส่งคำขอใช้งานไม่สำเร็จ" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="member-form cinematic-registration-form" onSubmit={submitRegistration}>
      <div className="registration-form-intro"><span>SECURE MEMBERSHIP REQUEST</span><strong>ข้อมูลสำหรับตรวจสอบสิทธิ์</strong><small>กรอกข้อมูลให้ครบถ้วน ระบบจะส่งให้ผู้ดูแลตรวจสอบก่อนอนุมัติ</small></div>
      <div className="member-form-grid">
        <label className="cinematic-field">ชื่อ <em>*</em><input name="firstName" required defaultValue={existingUser?.firstName || ""} autoComplete="given-name" /></label>
        <label className="cinematic-field">นามสกุล <em>*</em><input name="lastName" required defaultValue={existingUser?.lastName || ""} autoComplete="family-name" /></label>
        <SearchableSelect label="ตำแหน่ง" required value={positionBase} options={positionOptions} placeholder="พิมพ์ค้นหาตำแหน่ง" onChange={(value) => { setPositionBase(value); if (!POSITION_LEVEL_MAP[value]) setPositionLevel(""); }} helper="ตัดรายการซ้ำแล้ว และเลือกเป็นชื่อตำแหน่งแยกจากระดับ" />
        <SearchableSelect label="ระดับ" value={positionLevel} options={levelOptions} placeholder={positionBase ? "เลือกหรือพิมพ์ระดับ" : "เลือกตำแหน่งก่อน"} onChange={setPositionLevel} />
        <SearchableSelect label="หน่วยงาน" required value={department} options={DEPARTMENTS} placeholder="พิมพ์ค้นหาหน่วยงาน" onChange={setDepartment} />
        <SearchableSelect label="สถานที่ปฏิบัติงาน" required value={workplace} options={FACILITY_OPTIONS} placeholder="พิมพ์ค้นหาชื่อหน่วยบริการ" onChange={setWorkplace} helper="รายการจะแยกตามอำเภอ และยังสามารถพิมพ์ชื่อสถานที่ได้" />
        <PhoneOtpInput value={phone} onChange={setPhone} />
        <label className="cinematic-field">บัญชี Gmail สำหรับเข้าใช้งานครั้งถัดไป <em>*</em><input name="email" type="email" required readOnly={identity.provider === "google"} defaultValue={identity.provider === "google" ? identity.email : existingUser?.email || ""} autoComplete="email" placeholder="yourname@gmail.com" /></label>
      </div>
      <input type="hidden" name="position" value={positionValue} readOnly />
      <input type="hidden" name="department" value={department} readOnly />
      <input type="hidden" name="workplace" value={workplace} readOnly />
      <input type="hidden" name="phone" value={phone} readOnly />
      {identity.provider === "line" && <div className="member-info-note"><AlertTriangle size={18} />LINE ใช้สำหรับเริ่มลงทะเบียนเท่านั้น หลังได้รับอนุมัติให้เข้าสู่ระบบด้วย Gmail ที่ระบุไว้</div>}
      {message && <div className={`form-alert ${message.type}`} role="status" aria-live="polite">{message.type === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}{message.text}</div>}
      <button className="admin-primary member-submit cinematic-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}{submitting ? "กำลังส่งคำขอ..." : "ส่งคำขอใช้งานระบบ"}</button>
    </form>
  );
}
