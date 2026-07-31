import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalContext } from "@/app/lib/users";
import { AdminConsole } from "./admin-console";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ระบบจัดการสื่อ",
  description: "ระบบหลังบ้านสำหรับจัดการคลังสื่อสารความเสี่ยงจังหวัดสตูล",
};

export default async function AdminPage() {
  const { identity, user } = await getPortalContext();
  if (!identity) redirect("/admin/login");
  if (!user) redirect("/admin/register");
  if (user.status !== "approved") redirect("/admin/pending");
  if (identity.provider !== "google") redirect("/admin/google-required");

  return <AdminConsole currentUser={user} />;
}
