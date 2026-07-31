"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function PortalSignOutButton() {
  return (
    <button
      className="portal-signout"
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
    >
      <LogOut size={17} />
      ออกจากระบบ
    </button>
  );
}
