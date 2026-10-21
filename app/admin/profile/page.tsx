import {
  ArrowLeft,
  BadgeCheck,
  FileText,
  Home,
  Info,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  isManagerRole,
  portalRoleLabel,
  portalStatusLabel,
} from "@/app/auth-types";
import { getPortalContext } from "@/app/lib/users";
import { PortalSignOutButton } from "../portal-sign-out";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { identity, user } = await getPortalContext();
  if (!identity) redirect("/admin/login");
  if (!user) redirect("/admin/register");
  if (user.status !== "approved") redirect("/admin/pending");
  if (identity.provider !== "google") redirect("/admin/google-required");

  return (
    <main className="member-page site-shell">
      <header className="site-header">
        <div className="container nav-wrap">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <img src="/satun-risk-logo.png" alt="" aria-hidden="true" />
            </span>
            <span>
              <strong>คลังสื่อสารความเสี่ยง</strong>
              <small>สำนักงานสาธารณสุขจังหวัดสตูล</small>
            </span>
          </Link>
          <nav className="nav-links" aria-label="เมนูหลัก">
            <Link className="nav-item" href="/">
              <Home size={16} /> หน้าแรก
            </Link>
            <Link className="nav-item" href="/admin">
              <FileText size={16} /> จัดการคลังสื่อ
            </Link>
            <Link className="nav-item is-active" href="/admin/profile">
              <UserRound size={16} /> โปรไฟล์ของฉัน
            </Link>
            {isManagerRole(user.role) && (
              <Link className="nav-item" href="/admin/users">
                <Info size={16} /> จัดการสมาชิก
              </Link>
            )}
            <div className="nav-right-group">
              <PortalSignOutButton />
            </div>
          </nav>
        </div>
      </header>

      <div className="member-shell">
        <Link href="/admin" className="back-home">
          <ArrowLeft size={17} /> กลับหน้าจัดการสื่อ
        </Link>
        <section className="member-card">
          <span className="member-card-icon">
            <UserRound size={28} />
          </span>
          <span className="section-kicker">MY PROFILE</span>
          <h1>ข้อมูลส่วนตัวของฉัน</h1>
          <p>
            อัปเดตข้อมูลติดต่อและสถานที่ปฏิบัติงานให้เป็นปัจจุบัน
          </p>

          <div className="profile-access-summary">
            <BadgeCheck size={20} />
            <div>
              <strong>{portalRoleLabel(user.role)}</strong>
              <span>{portalStatusLabel(user.status)}</span>
            </div>
          </div>
          <ProfileForm user={user} />
        </section>
      </div>
    </main>
  );
}
