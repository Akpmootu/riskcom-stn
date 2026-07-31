export type PortalRole = "super_admin" | "admin" | "uploader";
export type PortalStatus = "pending" | "approved" | "rejected";
export type AuthProvider = "google" | "line";

export type PortalIdentity = {
  email: string;
  name: string;
  image: string;
  provider: AuthProvider;
  providerAccountId: string;
};

export type PortalUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  workplace: string;
  phone: string;
  role: PortalRole;
  status: PortalStatus;
  provider: AuthProvider;
  providerAccountId: string;
  lineUserId: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string;
  approvedBy: string;
};

export function isManagerRole(role: PortalRole) {
  return role === "super_admin" || role === "admin";
}

export function portalRoleLabel(role: PortalRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "ผู้ดูแลระบบ";
  return "ผู้อัปโหลดสื่อ";
}

export function portalStatusLabel(status: PortalStatus) {
  if (status === "approved") return "อนุมัติแล้ว";
  if (status === "rejected") return "ไม่อนุมัติ";
  return "รอตรวจสอบ";
}
