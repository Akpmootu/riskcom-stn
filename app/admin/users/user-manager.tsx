"use client";

import {
  AlertTriangle,
  Check,
  Edit3,
  LoaderCircle,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  portalRoleLabel,
  portalStatusLabel,
  type PortalRole,
  type PortalStatus,
  type PortalUser,
} from "@/app/auth-types";

type UpdateMessage = {
  type: "success" | "error";
  text: string;
};

type UserDraft = Pick<PortalUser, "firstName" | "lastName" | "position" | "workplace" | "phone">;

function toDraft(user: PortalUser): UserDraft {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    position: user.position,
    workplace: user.workplace,
    phone: user.phone,
  };
}

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
  const [editingEmail, setEditingEmail] = useState("");
  const [draft, setDraft] = useState<UserDraft | null>(null);
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
          user.phone,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, users]);

  const pendingCount = users.filter((user) => user.status === "pending").length;
  const approvedCount = users.filter((user) => user.status === "approved").length;
  const rejectedCount = users.filter((user) => user.status === "rejected").length;

  function canManageUser(user: PortalUser) {
    if (user.role === "super_admin") return false;
    return currentUser.role === "super_admin" || user.role === "uploader";
  }

  function startEditing(user: PortalUser) {
    setEditingEmail(user.email);
    setDraft(toDraft(user));
    setMessage(null);
  }

  function cancelEditing() {
    setEditingEmail("");
    setDraft(null);
  }

  async function updateUser(
    user: PortalUser,
    changes: { status: PortalStatus; role: PortalRole } & Partial<UserDraft>,
    successText: string,
  ) {
    setBusyEmail(user.email);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email, ...changes }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        user?: PortalUser;
      };
      if (!response.ok || !result.ok || !result.user) {
        throw new Error(result.error || "อัปเดตข้อมูลสมาชิกไม่สำเร็จ");
      }
      setUsers((current) =>
        current.map((entry) =>
          entry.email === result.user?.email ? result.user : entry,
        ),
      );
      setMessage({ type: "success", text: successText });
      cancelEditing();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "อัปเดตข้อมูลสมาชิกไม่สำเร็จ",
      });
    } finally {
      setBusyEmail("");
    }
  }

  function saveDetails(user: PortalUser) {
    if (!draft) return;
    const cleanDraft = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      position: draft.position.trim(),
      workplace: draft.workplace.trim(),
      phone: draft.phone.replace(/[^\d+]/g, "").trim(),
    };
    if (
      !cleanDraft.firstName ||
      !cleanDraft.lastName ||
      !cleanDraft.position ||
      !cleanDraft.workplace ||
      cleanDraft.phone.length < 9
    ) {
      setMessage({ type: "error", text: "กรุณากรอกข้อมูลสมาชิกให้ครบถ้วนและตรวจสอบเบอร์โทร" });
      return;
    }
    void updateUser(
      user,
      { status: user.status, role: user.role, ...cleanDraft },
      `บันทึกข้อมูลของ ${cleanDraft.firstName} ${cleanDraft.lastName} แล้ว`,
    );
  }

  return (
    <>
      <section className="user-stats" aria-label="สรุปจำนวนสมาชิก">
        <article>
          <span>รออนุมัติ</span>
          <strong>{pendingCount}</strong>
        </article>
        <article>
          <span>สมาชิกทั้งหมด</span>
          <strong>{users.length}</strong>
        </article>
        <article>
          <span>อนุมัติแล้ว</span>
          <strong>{approvedCount}</strong>
        </article>
        <article>
          <span>ไม่อนุมัติ</span>
          <strong>{rejectedCount}</strong>
        </article>
      </section>

      <section className="user-manager-panel">
        <div className="user-panel-heading">
          <div>
            <span className="section-kicker">MEMBER DIRECTORY</span>
            <h2>รายชื่อสมาชิกในระบบ</h2>
            <p>ตรวจสอบข้อมูลและแก้ไขรายละเอียดสมาชิกได้จากรายการด้านล่าง</p>
          </div>
          <span className="user-result-count">แสดง {visibleUsers.length} จาก {users.length} คน</span>
        </div>

        <div className="user-toolbar">
          <label className="user-search">
            <Search size={17} />
            <span className="sr-only">ค้นหาสมาชิก</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อ อีเมล ตำแหน่ง หน่วยงาน หรือเบอร์โทร"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as PortalStatus | "all")}
            aria-label="กรองตามสถานะ"
          >
            <option value="pending">รอตรวจสอบ</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="rejected">ไม่อนุมัติ</option>
            <option value="all">ทุกสถานะ</option>
          </select>
        </div>

        {message && (
          <div className={`form-alert ${message.type}`} role="status" aria-live="polite">
            {message.type === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}
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
              const manageable = canManageUser(user);
              const isEditing = editingEmail === user.email && Boolean(draft);
              const canChangeRole = currentUser.role === "super_admin" && !isSuperAdmin;
              return (
                <article className={`user-card${isEditing ? " is-editing" : ""}`} key={user.id || user.email}>
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
                      <strong>{user.firstName} {user.lastName}</strong>
                      <span className={`user-status ${user.status}`}>{portalStatusLabel(user.status)}</span>
                    </div>
                    <p>{user.email}</p>
                    <small>{user.position || "ไม่ระบุตำแหน่ง"} · {user.workplace || "ไม่ระบุสถานที่ปฏิบัติงาน"} · {user.phone || "ไม่ระบุเบอร์โทร"}</small>
                    <span className="user-role-label">{portalRoleLabel(user.role)} · สมัครเมื่อ {user.createdAt ? new Date(user.createdAt).toLocaleDateString("th-TH") : "ไม่ระบุวันที่"}</span>
                  </div>
                  <div className="user-controls">
                    <label>
                      สิทธิ์
                      <select
                        value={user.role}
                        disabled={!canChangeRole || working}
                        onChange={(event) => void updateUser(user, { status: user.status, role: event.target.value as PortalRole }, `อัปเดตสิทธิ์ของ ${user.firstName} ${user.lastName} แล้ว`)}
                      >
                        {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                        <option value="admin">ผู้ดูแลระบบ</option>
                        <option value="uploader">ผู้อัปโหลดสื่อ</option>
                      </select>
                    </label>
                    {manageable && !isSelf && (
                      <button className="user-edit-button" type="button" onClick={() => (isEditing ? cancelEditing() : startEditing(user))} disabled={working}>
                        {isEditing ? <X size={16} /> : <Edit3 size={16} />}
                        {isEditing ? "ยกเลิก" : "แก้ไขข้อมูล"}
                      </button>
                    )}
                    {!isSelf && !isSuperAdmin && (
                      <div className="user-action-buttons">
                        <button className="approve" type="button" disabled={working || user.status === "approved"} onClick={() => void updateUser(user, { status: "approved", role: user.role }, `อนุมัติ ${user.firstName} ${user.lastName} แล้ว`)}>
                          {working ? <LoaderCircle className="spin" size={16} /> : <UserCheck size={16} />} อนุมัติ
                        </button>
                        <button className="reject" type="button" disabled={working || user.status === "rejected"} onClick={() => void updateUser(user, { status: "rejected", role: user.role }, `เปลี่ยนสถานะ ${user.firstName} ${user.lastName} แล้ว`)}>
                          <UserX size={16} /> ไม่อนุมัติ
                        </button>
                      </div>
                    )}
                    {(isSelf || isSuperAdmin) && (
                      <span className="protected-user"><ShieldCheck size={15} />{isSuperAdmin ? "บัญชีหลักของระบบ" : "บัญชีของคุณ"}</span>
                    )}
                  </div>

                  {isEditing && draft && (
                    <form className="user-edit-form" onSubmit={(event) => { event.preventDefault(); saveDetails(user); }}>
                      <div className="user-edit-form-heading">
                        <div><strong>แก้ไขข้อมูลสมาชิก</strong><small>ข้อมูลนี้ใช้สำหรับติดต่อและแสดงตัวตนในระบบ</small></div>
                        <Edit3 size={18} />
                      </div>
                      <div className="user-edit-fields">
                        <label>ชื่อ <em>*</em><input required value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} /></label>
                        <label>นามสกุล <em>*</em><input required value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} /></label>
                        <label>ตำแหน่ง <em>*</em><input required value={draft.position} onChange={(event) => setDraft({ ...draft, position: event.target.value })} /></label>
                        <label>หน่วยงาน / สถานที่ปฏิบัติงาน <em>*</em><input required value={draft.workplace} onChange={(event) => setDraft({ ...draft, workplace: event.target.value })} /></label>
                        <label>เบอร์โทรติดต่อ <em>*</em><input required inputMode="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
                        <label>Gmail ที่ใช้เข้าสู่ระบบ<input value={user.email} readOnly aria-readonly="true" /></label>
                      </div>
                      <div className="user-edit-actions">
                        <button type="button" className="user-cancel-button" onClick={cancelEditing}><X size={16} /> ยกเลิก</button>
                        <button type="submit" className="admin-primary" disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} {working ? "กำลังบันทึก..." : "บันทึกข้อมูลสมาชิก"}</button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
