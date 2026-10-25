import {
  ArrowLeft,
  FileText,
  Home,
  Info,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isManagerRole } from "@/app/auth-types";
import { getPortalContext, listPortalUsers } from "@/app/lib/users";
import { PortalSignOutButton } from "../portal-sign-out";
import { UserManager } from "./user-manager";

export const dynamic = "force-dynamic";

export default async function UserManagementPage() {
  const { identity, user } = await getPortalContext();
  if (!identity) redirect("/admin/login");
  if (!user) redirect("/admin/register");
  if (user.status !== "approved") redirect("/admin/pending");
  if (identity.provider !== "google") redirect("/admin/google-required");
  if (!isManagerRole(user.role)) redirect("/admin");

  const users = await listPortalUsers();

  return (
    <main className="member-page user-management-page site-shell">
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
            <Link className="nav-item" href="/admin/profile">
              <UserRound size={16} /> โปรไฟล์ของฉัน
            </Link>
            <Link className="nav-item is-active" href="/admin/users">
              <Info size={16} /> จัดการสมาชิก
            </Link>
            <div className="nav-right-group">
              <PortalSignOutButton />
            </div>
          </nav>
        </div>
      </header>

      <div className="member-shell user-management-shell">
        <Link href="/admin" className="back-home">
          <ArrowLeft size={17} /> กลับหน้าจัดการสื่อ
        </Link>
        <section className="user-page-heading">
          <span className="member-card-icon">
            <UsersRound size={28} />
          </span>
          <div>
            <span className="section-kicker">MEMBER MANAGEMENT</span>
            <h1>ตรวจสอบและจัดการผู้ใช้งาน</h1>
            <p>
              ตรวจสอบรายชื่อ อนุมัติคำขอ กำหนดสิทธิ์ และแก้ไขข้อมูลสมาชิกในระบบอัปโหลด
            </p>
          </div>
        </section>
        <UserManager initialUsers={users} currentUser={user} />
      </div>
    </main>
  );
}
