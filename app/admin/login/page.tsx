import {
  ArrowLeft,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, authProviderAvailability, signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user) redirect("/admin");

  return (
    <main className="admin-login-page oauth-login-page">
      <div className="admin-login-brand">
        <span className="brand-mark"><img src="/satun-risk-logo.png" alt="" aria-hidden="true" /></span>
        <span>
          <strong>คลังสื่อสารความเสี่ยง</strong>
          <small>สำนักงานสาธารณสุขจังหวัดสตูล</small>
        </span>
      </div>
      <div className="login-shell">
        <Link href="/" className="back-home">
          <ArrowLeft size={17} /> กลับหน้าคลังสื่อ
        </Link>
        <section className="login-card oauth-card">
          <span className="login-icon"><LockKeyhole size={28} /></span>
          <span className="section-kicker">SECURE MEMBER PORTAL</span>
          <h1>เข้าสู่ระบบผู้ใช้งาน</h1>
          <p>
            เจ้าหน้าที่ที่ได้รับอนุมัติแล้วให้เข้าสู่ระบบด้วยบัญชี Gmail
            ส่วนผู้สมัครใหม่สามารถเริ่มลงทะเบียนผ่าน Google หรือ LINE ได้
          </p>

          <div className="oauth-actions">
            {authProviderAvailability.google && (
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/admin" });
                }}
              >
                <button className="oauth-button google" type="submit">
                  <Mail size={20} />
                  เข้าสู่ระบบด้วย Google
                </button>
              </form>
            )}
            {authProviderAvailability.line && (
              <form
                action={async () => {
                  "use server";
                  await signIn("line", { redirectTo: "/admin/register" });
                }}
              >
                <button className="oauth-button line" type="submit">
                  <MessageCircle size={20} />
                  ลงทะเบียนด้วย LINE
                </button>
              </form>
            )}
            {authProviderAvailability.credentials && (
              <form
                action={async () => {
                  "use server";
                  await signIn("credentials", {
                    redirectTo: "/admin",
                    email: "akaporn1234@gmail.com",
                  });
                }}
              >
                <button className="admin-primary" type="submit" style={{ marginTop: 10 }}>
                  <ShieldCheck size={20} />
                  เข้าสู่ระบบผู้ดูแลระบบ (Dev / Demo Mode)
                </button>
              </form>
            )}
          </div>

          {!authProviderAvailability.google &&
            !authProviderAvailability.line && (
              <div className="form-alert error" style={{ marginTop: 14 }}>
                ยังไม่ได้ตั้งค่า Google / LINE OAuth (สามารถกดปุ่มสีส้มด้านบนเพื่อทดสอบระบบได้ทันที)
              </div>
            )}

          <div className="oauth-note">
            <ShieldCheck size={18} />
            <span>
              ระบบไม่เก็บรหัสผ่าน Gmail หรือ LINE และผู้สมัครต้องได้รับอนุมัติก่อนอัปโหลดสื่อ
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
