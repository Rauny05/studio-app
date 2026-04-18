"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

function SignInContent() {
  const params = useSearchParams();
  const error = params.get("error");

  // Detect Capacitor / Android WebView — skip Google OAuth entirely
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [mode, setMode] = useState<"google" | "passcode">("google");
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
      window.location.href = result.url;
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
        </div>
        <h1 className="auth-title">Studio</h1>
        <p className="auth-subtitle">Sign in to access your workspace</p>

        {error && (
          <div className="auth-error">
            {error === "AccessDenied"
              ? "Your account hasn't been granted access. Contact your admin."
              : "Something went wrong. Please try again."}
          </div>
        )}

        {/* Only show tabs on web — native app goes straight to passcode */}
        {!isNativeApp && (
          <div className="auth-tabs">
            <button className={`auth-tab ${mode === "google" ? "active" : ""}`} onClick={() => setMode("google")} type="button">Google</button>
            <button className={`auth-tab ${mode === "passcode" ? "active" : ""}`} onClick={() => setMode("passcode")} type="button">Access Code</button>
          </div>
        )}

        {mode === "google" ? (
          <button
            className="auth-google-btn"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        ) : (
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
