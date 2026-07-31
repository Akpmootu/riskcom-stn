import { Clock3, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalContext } from "@/app/lib/users";
import { PortalSignOutButton } from "../portal-sign-out";

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const { identity, user } = await getPortalContext();
  if (!identity) redirect("/admin/login");
  if (!user) redirect("/admin/register");
  if (user.status === "approved") redirect("/admin");

  const rejected = user.status === "rejected";

  return (
    <main className="member-page">
      <header className="member-header">
        <Link href="/" className="brand">
          <span className="brand-mark"><img src="/satun-risk-logo.png" alt="" aria-hidden="true" /></span>
          <span>
            <strong>สถานะคำขอใช้งาน</strong>
            <small>คลังสื่อสารความเสี่ยง จังหวัดสตูล</small>
          </span>
        </Link>
        <PortalSignOutButton />
      </header>
      <div className="member-shell status-shell">
        <section className={`member-card status-card ${rejected ? "rejected" : ""}`}>
          <span className="member-card-icon">
            {rejected ? <ShieldAlert size={30} /> : <Clock3 size={30} />}
          </span>
          <span className="section-kicker">ACCESS REQUEST</span>
          <h1>{rejected ? "คำขอยังไม่ได้รับการอนุมัติ" : "อยู่ระหว่างการตรวจสอบ"}</h1>
          <p>
            {rejected
              ? "คุณสามารถตรวจสอบและแก้ไขข้อมูล แล้วส่งคำขอใหม่ให้ผู้ดูแลพิจารณาอีกครั้ง"
              : "ผู้ดูแลระบบได้รับคำขอของคุณแล้ว เมื่ออนุมัติแล้วให้เข้าสู่ระบบครั้งถัดไปด้วยบัญชี Gmail"}
          </p>
          <dl className="request-summary">
            <div><dt>ชื่อผู้สมัคร</dt><dd>{user.firstName} {user.lastName}</dd></div>
            <div><dt>Gmail</dt><dd>{user.email}</dd></div>
            <div><dt>ตำแหน่ง</dt><dd>{user.position}</dd></div>
            <div><dt>สถานที่ปฏิบัติงาน</dt><dd>{user.workplace}</dd></div>
          </dl>
          {rejected && (
            <Link className="admin-primary inline-action" href="/admin/register">
              แก้ไขและส่งคำขอใหม่
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
