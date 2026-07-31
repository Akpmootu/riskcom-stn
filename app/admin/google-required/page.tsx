import {
  HeartPulse,
  LogIn,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authProviderAvailability, signIn } from "@/auth";
import { getPortalContext } from "@/app/lib/users";
import { PortalSignOutButton } from "../portal-sign-out";

export const dynamic = "force-dynamic";

export default async function GoogleRequiredPage() {
  const { identity, user } = await getPortalContext();
  if (!identity) redirect("/admin/login");
  if (!user) redirect("/admin/register");
  if (user.status !== "approved") redirect("/admin/pending");
  if (identity.provider === "google") redirect("/admin");

  return (
    <main className="member-page">
      <header className="member-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <HeartPulse size={24} />
          </span>
          <span>
            <strong>ยืนยันบัญชี Gmail</strong>
            <small>คลังสื่อสารความเสี่ยง จังหวัดสตูล</small>
          </span>
        </Link>
        <PortalSignOutButton />
      </header>
      <div className="member-shell status-shell">
        <section className="member-card status-card">
          <span className="member-card-icon">
            <Mail size={29} />
          </span>
          <span className="section-kicker">GOOGLE SIGN-IN REQUIRED</span>
          <h1>คำขอได้รับการอนุมัติแล้ว</h1>
          <p>
            เพื่อเข้าใช้ระบบอัปโหลด กรุณาเข้าสู่ระบบด้วย Gmail{" "}
            <strong>{user.email}</strong> ตามที่ระบุไว้ตอนลงทะเบียน
          </p>
          {authProviderAvailability.google ? (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/admin" });
              }}
            >
              <button className="admin-primary inline-action" type="submit">
                <LogIn size={18} /> เข้าสู่ระบบด้วย Google
              </button>
            </form>
          ) : (
            <div className="form-alert error">
              ยังไม่ได้ตั้งค่าการเชื่อมต่อ Google Login
            </div>
          )}
          <div className="oauth-note">
            <ShieldCheck size={18} />
            ระบบจะตรวจสอบว่า Gmail ตรงกับบัญชีที่ได้รับอนุมัติ
          </div>
        </section>
      </div>
    </main>
  );
}
