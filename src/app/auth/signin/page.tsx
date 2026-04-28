"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

function SignInContent() {
  const params = useSearchParams();
  const error = params.get("error");

  // Detect Capacitor / Android WebView — skip Google OAuth entirely
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [mode, setMode] = useState<"google" | "passcode">("passcode");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");

  useEffect(() => {
    // window.Capacitor is injected by Capacitor runtime in the WebView
    const native =
      typeof window !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).Capacitor !== undefined ||
        /wv|WebView/.test(navigator.userAgent));
    setIsNativeApp(native);
    if (native) setMode("passcode");
  }, []);

  async function handlePasscodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setPasscodeError("");
    const result = await signIn("passcode", {
      email,
      passcode,
      callbackUrl: "/dashboard",
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setPasscodeError("Invalid email or access code.");
    } else if (result?.url) {
      // Use replace() so the login page is removed from history
      // — prevents Android back button from returning to sign-in
      window.location.replace(result.url);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-1px", lineHeight: 1 }}>RM</span>
        </div>
        <h1 className="auth-title">RM Studio</h1>
        <p className="auth-subtitle">Sign in to access your workspace</p>

        {error && (
          <div className="auth-error">
            {error === "AccessDenied"
              ? "Your account hasn't been granted access. Contact your admin."
              : "Something went wrong. Please try again."}
          </div>
        )}

        {/* Passcode form — for all team members */}
        {mode === "passcode" && (
          <form onSubmit={handlePasscodeSubmit} className="auth-passcode-form">
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="Access code"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              required
              className="auth-input"
              autoComplete="current-password"
            />
            {passcodeError && <div className="auth-error">{passcodeError}</div>}
            <button type="submit" className="auth-passcode-btn" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
            {/* Admin-only: Google sign-in hidden link */}
            {!isNativeApp && (
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="auth-admin-google"
              >
                Admin? Sign in with Google
              </button>
            )}
          </form>
        )}

        <p className="auth-footer">Access is invite-only.</p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
