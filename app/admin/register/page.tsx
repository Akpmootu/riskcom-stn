import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalContext } from "@/app/lib/users";
import { RegistrationForm } from "./registration-form";
import { PortalSignOutButton } from "../portal-sign-out";

export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const { identity, user } = await getPortalContext();
  if (!identity) redirect("/admin/login");
  if (user?.status === "approved") redirect("/admin");
  if (user?.status === "pending") redirect("/admin/pending");

  return (
    <main className="member-page">
      <header className="member-header">
        <Link href="/" className="brand">
          <span className="brand-mark"><img src="/satun-risk-logo.png" alt="" aria-hidden="true" /></span>
          <span>
            <strong>ลงทะเบียนผู้ใช้งาน</strong>
            <small>คลังสื่อสารความเสี่ยง จังหวัดสตูล</small>
          </span>
        </Link>
        <PortalSignOutButton />
      </header>
      <div className="member-shell">
        <Link href="/admin/login" className="back-home">
          <ArrowLeft size={17} /> กลับหน้าเข้าสู่ระบบ
        </Link>
        <section className="member-card">
          <span className="member-card-icon"><UserPlus size={28} /></span>
          <span className="section-kicker">MEMBERSHIP REQUEST</span>
          <h1>{user?.status === "rejected" ? "ส่งคำขอใช้งานอีกครั้ง" : "ขอสิทธิ์เข้าใช้งานระบบ"}</h1>
          <p>
            กรุณากรอกข้อมูลจริงเพื่อให้ผู้ดูแลตรวจสอบ หลังได้รับอนุมัติแล้วจึงจะสามารถอัปโหลดสื่อได้
          </p>
          <RegistrationForm identity={identity} existingUser={user} />
        </section>
      </div>
    </main>
  );
}
