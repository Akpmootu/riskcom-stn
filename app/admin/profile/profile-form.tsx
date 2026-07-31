"use client";

import { AlertTriangle, Check, LoaderCircle, Save } from "lucide-react";
import { FormEvent, useState } from "react";
import type { PortalUser } from "@/app/auth-types";

export function ProfileForm({ user }: { user: PortalUser }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ");
      }
      setMessage({
        type: "success",
        text: "บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="member-form" onSubmit={updateProfile}>
      <div className="member-form-grid">
        <label>
          ชื่อ <em>*</em>
          <input
            name="firstName"
            required
            defaultValue={user.firstName}
            autoComplete="given-name"
          />
        </label>
        <label>
          นามสกุล <em>*</em>
          <input
            name="lastName"
            required
            defaultValue={user.lastName}
            autoComplete="family-name"
          />
        </label>
        <label>
          ตำแหน่ง <em>*</em>
          <input name="position" required defaultValue={user.position} />
        </label>
        <label>
          สถานที่ปฏิบัติงาน <em>*</em>
          <input name="workplace" required defaultValue={user.workplace} />
        </label>
        <label>
          เบอร์โทรติดต่อ <em>*</em>
          <input
            name="phone"
            required
            inputMode="tel"
            defaultValue={user.phone}
            autoComplete="tel"
          />
        </label>
        <label>
          Gmail ที่ใช้เข้าสู่ระบบ
          <input value={user.email} readOnly aria-readonly="true" />
        </label>
      </div>

      <div className="member-info-note">
        Gmail และสิทธิ์การใช้งานเปลี่ยนได้โดยผู้ดูแลระบบเท่านั้น
      </div>

      {message && (
        <div className={`form-alert ${message.type}`} role="status">
          {message.type === "success" ? (
            <Check size={17} />
          ) : (
            <AlertTriangle size={17} />
          )}
          {message.text}
        </div>
      )}

      <button
        className="admin-primary member-submit"
        type="submit"
        disabled={submitting}
      >
        {submitting ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <Save size={18} />
        )}
        {submitting ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
      </button>
    </form>
  );
}
