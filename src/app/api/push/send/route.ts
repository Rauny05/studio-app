/**
 * Send FCM push via v1 API (service account OAuth2).
 * Requires FIREBASE_SERVICE_ACCOUNT env var (JSON stringified).
 */
import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = "rm-studio2";

async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import private key and sign
  const keyData = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signingBytes = new TextEncoder().encode(signingInput);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signingBytes);

  const b64url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${signingInput}.${b64url(signature)}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

export async function POST(req: NextRequest) {
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saRaw) {
    return NextResponse.json({ error: "FIREBASE_SERVICE_ACCOUNT not set" }, { status: 500 });
  }

  const serviceAccount = JSON.parse(saRaw) as { client_email: string; private_key: string };
  const accessToken = await getAccessToken(serviceAccount);

  const { tokens, title, body } = await req.json() as {
    tokens: string[];
    title: string;
    body: string;
  };

  if (!tokens?.length) return NextResponse.json({ sent: 0 });

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

  const results = await Promise.allSettled(
    tokens.map((token) =>
      fetch(fcmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            android: {
              priority: "HIGH",
              notification: { sound: "default", click_action: "FLUTTER_NOTIFICATION_CLICK" },
            },
            data: { route: "/deliverables" },
          },
        }),
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ sent, total: tokens.length });
}
