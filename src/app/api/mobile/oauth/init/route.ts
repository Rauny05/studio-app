import { NextResponse } from "next/server";

const CALLBACK_URL = "https://rmmedia-studio.vercel.app/api/mobile/oauth/callback";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: CALLBACK_URL,
    response_type: "code",
    scope: "email profile",
    access_type: "online",
    prompt: "select_account",
  });

  return NextResponse.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
}
