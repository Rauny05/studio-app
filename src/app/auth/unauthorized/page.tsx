"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function UnauthorizedPage() {
  const { data: session } = useSession();

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" style={{ background: "rgba(239,68,68,0.1)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="auth-title">No access</h1>
        <p className="auth-subtitle">
          {session?.user?.email
            ? `${session.user.email} doesn't have permission to view this page.`
            : "You don't have permission to view this page."}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/dashboard" className="kanban-btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
            ← Back
          </Link>
          <button
            className="kanban-btn-secondary"
            style={{ flex: 1 }}
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
