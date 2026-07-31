"use client";

import {
  AlertTriangle,
  Check,
  LoaderCircle,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  portalStatusLabel,
  type PortalRole,
  type PortalStatus,
  type PortalUser,
} from "@/app/auth-types";

type UpdateMessage = {
  type: "success" | "error";
  text: string;
};

export function UserManager({
  initialUsers,
  currentUser,
}: {
  initialUsers: PortalUser[];
  currentUser: PortalUser;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PortalStatus | "all">(
    "pending",
  );
  const [busyEmail, setBusyEmail] = useState("");
  const [message, setMessage] = useState<UpdateMessage | null>(null);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;
      const matchesQuery =
        !needle ||
        [
          user.firstName,
          user.lastName,
          user.email,
          user.position,
          user.workplace,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, users]);

  const pendingCount = users.filter(
    (user) => user.status === "pending",
  ).length;

  async function updateUser(
    user: PortalUser,
    status: PortalStatus,
    role: PortalRole,
  ) {
    setBusyEmail(user.email);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email, status, role }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        user?: PortalUser;
      };
      if (!response.ok || !result.ok || !result.user) {
        throw new Error(result.error || "อัปเดตสิทธิ์สมาชิกไม่สำเร็จ");
      }
      setUsers((current) =>
        current.map((entry) =>
          entry.email === result.user?.email ? result.user : entry,
        ),
      );
      setMessage({
        type: "success",
        text: `อัปเดตสิทธิ์ของ ${user.firstName} ${user.lastName} แล้ว`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "อัปเดตสิทธิ์สมาชิกไม่สำเร็จ",
      });
    } finally {
      setBusyEmail("");
    }
  }

  return (
    <>
      <section className="user-stats">
        <article>
          <span>รออนุมัติ</span>
          <strong>{pendingCount}</strong>
        </article>
        <article>
          <span>สมาชิกทั้งหมด</span>
          <strong>{users.length}</strong>
        </article>
        <article>
          <span>ผู้ใช้งานที่อนุมัติแล้ว</span>
          <strong>
            {users.filter((user) => user.status === "approved").length}
          </strong>
        </article>
      </section>

      <section className="user-manager-panel">
        <div className="user-toolbar">
          <label className="user-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อ อีเมล ตำแหน่ง หรือหน่วยงาน"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as PortalStatus | "all")
            }
            aria-label="กรองตามสถานะ"
          >
            <option value="pending">รอตรวจสอบ</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="rejected">ไม่อนุมัติ</option>
            <option value="all">ทุกสถานะ</option>
          </select>
        </div>

        {message && (
          <div className={`form-alert ${message.type}`} role="status">
            {message.type === "success" ? (
              <Check size={17} />
            ) : (
              <AlertTriangle size={17} />
            )}
            {message.text}
          </div>
        )}

        <div className="user-list">
          {visibleUsers.length === 0 ? (
            <div className="user-empty">ไม่พบสมาชิกตามเงื่อนไขที่เลือก</div>
          ) : (
            visibleUsers.map((user) => {
              const isSelf = user.email === currentUser.email;
              const isSuperAdmin = user.role === "super_admin";
              const working = busyEmail === user.email;
              const canChangeRole =
                currentUser.role === "super_admin" && !isSuperAdmin;
              return (
                <article className="user-card" key={user.id || user.email}>
                  <div className="user-avatar" aria-hidden="true">
                    {user.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.imageUrl} alt="" />
                    ) : (
                      <span>{user.firstName.slice(0, 1) || "U"}</span>
                    )}
                  </div>
                  <div className="user-detail">
                    <div className="user-name-row">
                      <strong>
                        {user.firstName} {user.lastName}
                      </strong>
                      <span className={`user-status ${user.status}`}>
                        {portalStatusLabel(user.status)}
                      </span>
                    </div>
                    <p>{user.email}</p>
                    <small>
                      {user.position || "ไม่ระบุตำแหน่ง"} ·{" "}
                      {user.workplace || "ไม่ระบุสถานที่ปฏิบัติงาน"} ·{" "}
                      {user.phone || "ไม่ระบุเบอร์โทร"}
                    </small>
                  </div>
                  <div className="user-controls">
                    <label>
                      สิทธิ์
                      <select
                        value={user.role}
                        disabled={!canChangeRole || working}
                        onChange={(event) =>
                          void updateUser(
                            user,
                            user.status,
                            event.target.value as PortalRole,
                          )
                        }
                      >
                        {isSuperAdmin && (
                          <option value="super_admin">Super Admin</option>
                        )}
                        <option value="admin">ผู้ดูแลระบบ</option>
                        <option value="uploader">ผู้อัปโหลดสื่อ</option>
                      </select>
                    </label>
                    {!isSelf && !isSuperAdmin && (
                      <div className="user-action-buttons">
                        <button
                          className="approve"
                          type="button"
                          disabled={working || user.status === "approved"}
                          onClick={() =>
                            void updateUser(user, "approved", user.role)
                          }
                        >
                          {working ? (
                            <LoaderCircle className="spin" size={16} />
                          ) : (
                            <UserCheck size={16} />
                          )}
                          อนุมัติ
                        </button>
                        <button
                          className="reject"
                          type="button"
                          disabled={working || user.status === "rejected"}
                          onClick={() =>
                            void updateUser(user, "rejected", user.role)
                          }
                        >
                          <UserX size={16} /> ไม่อนุมัติ
                        </button>
                      </div>
                    )}
                    {(isSelf || isSuperAdmin) && (
                      <span className="protected-user">
                        <ShieldCheck size={15} />
                        {isSuperAdmin ? "บัญชีหลักของระบบ" : "บัญชีของคุณ"}
                      </span>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
