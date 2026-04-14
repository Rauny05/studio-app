"use client";

import { useState, useEffect } from "react";
import type { AllowedUser } from "@/app/api/auth/[...nextauth]/route";

const ALL_PERMISSIONS = ["dashboard", "projects", "deliverables", "calendar", "settings"];

const PERMISSION_LABELS: Record<string, string> = {
  dashboard:    "Dashboard",
  projects:     "Projects",
  deliverables: "Deliverables",
  calendar:     "Calendar",
  settings:     "Settings",
};

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
    const next = user.permissions.includes(perm)
      ? user.permissions.filter((p) => p !== perm)
      : [...user.permissions, perm];
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
            <div className="admin-user-role">Admin · Full access</div>
          </div>
        </div>
        <span className="admin-badge admin-badge-admin">Admin</span>
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
        <div className="admin-perm-row" style={{ marginTop: 10 }}>
          <span className="admin-perm-label">Default access:</span>
          {ALL_PERMISSIONS.map((perm) => (
            <button
              key={perm}
              className={`admin-perm-toggle ${newPerms.includes(perm) ? "active" : ""}`}
              onClick={() => setNewPerms((p) =>
                p.includes(perm) ? p.filter((x) => x !== perm) : [...p, perm]
              )}
            >
              {PERMISSION_LABELS[perm]}
            </button>
          ))}
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
                <div className="admin-user-info">
                  <div className="admin-avatar">
                    {user.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="admin-user-email">{user.email}</div>
                    <div className="admin-user-role">
                      Added {new Date(user.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>

                <div className="admin-user-perms">
                  {ALL_PERMISSIONS.map((perm) => (
                    <button
                      key={perm}
                      className={`admin-perm-toggle ${user.permissions.includes(perm) ? "active" : ""}`}
                      onClick={() => togglePermission(user.email, perm)}
                      disabled={saving === user.email}
                      title={user.permissions.includes(perm) ? `Remove ${perm} access` : `Grant ${perm} access`}
                    >
                      {PERMISSION_LABELS[perm]}
                    </button>
                  ))}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
