"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import type { AllowedUser } from "@/app/api/auth/[...nextauth]/route";

const ALL_PERMISSIONS = ["dashboard", "projects", "deliverables", "calendar", "settings", "todos"];

const PERMISSION_LABELS: Record<string, string> = {
  dashboard:    "Dashboard",
  projects:     "Projects",
  deliverables: "Deliverables",
  calendar:     "Calendar",
  settings:     "Settings",
  todos:        "Todos",
};

function getLevel(permissions: string[], key: string): "none" | "view" | "edit" {
  if (permissions.includes(key)) return "edit";
  if (permissions.includes(`${key}:view`)) return "view";
  return "none";
}

function cycleLevel(permissions: string[], key: string): string[] {
  const level = getLevel(permissions, key);
  const filtered = permissions.filter((p) => p !== key && p !== `${key}:view`);
  if (level === "none") return [...filtered, `${key}:view`];
  if (level === "view") return [...filtered, key];
  return filtered;
}

function LevelButton({
  perm,
  permissions,
  disabled,
  onClick,
}: {
  perm: string;
  permissions: string[];
  disabled?: boolean;
  onClick: () => void;
}) {
  const level = getLevel(permissions, perm);
  const levelLabel = level === "edit" ? "Edit" : level === "view" ? "View" : "No access";

  return (
    <button
      className="admin-perm-level-btn"
      data-level={level}
      disabled={disabled}
      onClick={onClick}
      title={`${PERMISSION_LABELS[perm]}: ${levelLabel} — click to cycle`}
    >
      {level === "view" && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
      )}
      {level === "edit" && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      )}
      <span className="admin-perm-level-label">{PERMISSION_LABELS[perm]}</span>
      <span className="admin-perm-level-state">{levelLabel}</span>
    </button>
  );
}

export function UserManagement() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>([...ALL_PERMISSIONS]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addUser() {
    if (!newEmail.trim()) return;
    setAdding(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim(), permissions: newPerms }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setAdding(false); return; }
    setUsers((u) => [...u, data.user]);
    setNewEmail("");
    setNewPerms([...ALL_PERMISSIONS]);
    setAdding(false);
  }

  async function togglePermission(email: string, perm: string) {
    const user = users.find((u) => u.email === email);
    if (!user) return;
    const next = cycleLevel(user.permissions, perm);
    setSaving(email);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, permissions: next }),
    });
    setUsers((us) => us.map((u) => u.email === email ? { ...u, permissions: next } : u));
    setSaving(null);
  }

  async function removeUser(email: string) {
    if (!confirm(`Remove ${email}?`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setUsers((us) => us.filter((u) => u.email !== email));
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2 className="admin-heading">Team Access</h2>
        <p className="admin-subheading">Control who can access your Studio workspace and which sections they can view.</p>
      </div>

      {/* Admin info */}
      <div className="admin-self-card">
        <div className="admin-user-info">
          <div className="admin-avatar admin-avatar-admin">R</div>
          <div>
            <div className="admin-user-email">raunaq@rmmedia.in</div>
            <div className="admin-user-role">Admin · Full access to everything</div>
          </div>
        </div>
        <span className="admin-badge admin-badge-admin">Admin</span>
      </div>

      {/* Emergency restore */}
      <div className="admin-restore-card">
        <div className="admin-restore-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#f97316", flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <div className="admin-restore-title">Restore access</div>
            <div className="admin-restore-sub">If the app feels broken or you&apos;re locked out — refresh your session. All data is preserved.</div>
          </div>
        </div>
        <button
          className="admin-restore-btn"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        >
          Sign out &amp; refresh
        </button>
      </div>

      {/* Add user */}
      <div className="admin-section">
        <h3 className="admin-section-title">Invite team member</h3>
        <div className="admin-add-row">
          <input
            className="modal-input"
            placeholder="teammate@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addUser(); }}
          />
          <button
            className="kanban-btn-primary"
            onClick={addUser}
            disabled={adding || !newEmail.trim()}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {error && <p className="admin-error">{error}</p>}

        {/* Default permission toggles for new user */}
        <div style={{ marginTop: 12 }}>
          <div className="admin-perm-label" style={{ marginBottom: 8 }}>Default access — click to cycle: No access → View → Edit</div>
          <div className="admin-perm-level-group">
            {ALL_PERMISSIONS.map((perm) => (
              <LevelButton
                key={perm}
                perm={perm}
                permissions={newPerms}
                onClick={() => setNewPerms((p) => cycleLevel(p, perm))}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Users list */}
      <div className="admin-section">
        <h3 className="admin-section-title">
          Team members
          {!loading && <span className="admin-count">{users.length}</span>}
        </h3>

        {loading ? (
          <div className="dl-loading" style={{ padding: "20px 0" }}>
            <div className="dl-spinner" />
          </div>
        ) : users.length === 0 ? (
          <div className="admin-empty">
            No team members yet. Add someone above to get started.
          </div>
        ) : (
          <div className="admin-users-list">
            {users.map((user) => (
              <div key={user.email} className="admin-user-row">
                {/* Top: avatar + email + delete */}
                <div className="admin-user-row-top">
                  <div className="admin-user-info">
                    <div className="admin-avatar">
                      {user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="admin-user-email">{user.email}</div>
                      <div className="admin-user-role">
                        Added {new Date(user.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {saving === user.email && <span style={{ marginLeft: 6, color: "var(--app-text-muted)" }}>Saving…</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    className="admin-remove-btn"
                    onClick={() => removeUser(user.email)}
                    title="Remove user"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>

                {/* Bottom: permission chips */}
                <div className="admin-perm-level-group">
                  {ALL_PERMISSIONS.map((perm) => (
                    <LevelButton
                      key={perm}
                      perm={perm}
                      permissions={user.permissions}
                      disabled={saving === user.email}
                      onClick={() => togglePermission(user.email, perm)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
