import type { Metadata } from "next";
import { AdminConsole } from "./admin-console";

export const metadata: Metadata = {
  title: "ระบบจัดการสื่อ",
  description: "ระบบหลังบ้านสำหรับจัดการคลังสื่อสารความเสี่ยงจังหวัดสตูล",
};

export default function AdminPage() {
  return <AdminConsole />;
}
