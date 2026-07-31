import { ArrowLeft, UsersRound } from "lucide-react";
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
    <main className="member-page user-management-page">
      <header className="member-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <img src="/satun-risk-logo.png" alt="" aria-hidden="true" />
          </span>
          <span>
            <strong>จัดการสมาชิก</strong>
            <small>คลังสื่อสารความเสี่ยง จังหวัดสตูล</small>
          </span>
        </Link>
        <PortalSignOutButton />
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
              อนุมัติคำขอใหม่ กำหนดสิทธิ์ และระงับผู้ใช้งานในระบบอัปโหลด
            </p>
          </div>
        </section>
        <UserManager initialUsers={users} currentUser={user} />
      </div>
    </main>
  );
}
