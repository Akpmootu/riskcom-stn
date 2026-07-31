"use client";

import { AlertTriangle, Check, LoaderCircle, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { PortalIdentity, PortalUser } from "@/app/auth-types";

export function RegistrationForm({
  identity,
  existingUser,
}: {
  identity: PortalIdentity;
  existingUser: PortalUser | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/registration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "ส่งคำขอใช้งานไม่สำเร็จ");
      }
      setMessage({
        type: "success",
        text: "ส่งคำขอใช้งานแล้ว กำลังนำไปยังหน้าติดตามสถานะ",
      });
      router.push("/admin/pending");
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "ส่งคำขอใช้งานไม่สำเร็จ",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="member-form" onSubmit={submitRegistration}>
      <div className="member-form-grid">
        <label>
          ชื่อ <em>*</em>
          <input
            name="firstName"
            required
            defaultValue={existingUser?.firstName || ""}
            autoComplete="given-name"
          />
        </label>
        <label>
          นามสกุล <em>*</em>
          <input
            name="lastName"
            required
            defaultValue={existingUser?.lastName || ""}
            autoComplete="family-name"
          />
        </label>
        <label>
          ตำแหน่ง <em>*</em>
          <input
            name="position"
            required
            defaultValue={existingUser?.position || ""}
            placeholder="เช่น นักวิชาการสาธารณสุข"
          />
        </label>
        <label>
          สถานที่ปฏิบัติงาน <em>*</em>
          <input
            name="workplace"
            required
            defaultValue={existingUser?.workplace || ""}
            placeholder="เช่น สำนักงานสาธารณสุขจังหวัดสตูล"
          />
        </label>
        <label>
          เบอร์โทรติดต่อ <em>*</em>
          <input
            name="phone"
            required
            inputMode="tel"
            defaultValue={existingUser?.phone || ""}
            autoComplete="tel"
            placeholder="08x-xxx-xxxx"
          />
        </label>
        <label>
          บัญชี Gmail สำหรับเข้าใช้งานครั้งถัดไป <em>*</em>
          <input
            name="email"
            type="email"
            required
            readOnly={identity.provider === "google"}
            defaultValue={
              identity.provider === "google"
                ? identity.email
                : existingUser?.email || ""
            }
            autoComplete="email"
            placeholder="yourname@gmail.com"
          />
        </label>
      </div>

      {identity.provider === "line" && (
        <div className="member-info-note">
          <AlertTriangle size={18} />
          LINE ใช้สำหรับเริ่มลงทะเบียนเท่านั้น หลังได้รับอนุมัติให้เข้าสู่ระบบด้วย Gmail ที่ระบุไว้
        </div>
      )}

      {message && (
        <div className={`form-alert ${message.type}`}>
          {message.type === "success" ? (
            <Check size={17} />
          ) : (
            <AlertTriangle size={17} />
          )}
          {message.text}
        </div>
      )}

      <button className="admin-primary member-submit" type="submit" disabled={submitting}>
        {submitting ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        {submitting ? "กำลังส่งคำขอ..." : "ส่งคำขอใช้งานระบบ"}
      </button>
    </form>
  );
}
