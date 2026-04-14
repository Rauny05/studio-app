import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, ADMIN_EMAIL, ALL_PERMISSIONS } from "@/app/api/auth/[...nextauth]/route";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { AllowedUser } from "@/app/api/auth/[...nextauth]/route";

const DATA_PATH = join(process.cwd(), "data", "allowed-users.json");

function loadUsers(): AllowedUser[] {
  if (!existsSync(DATA_PATH)) return [];
  try { return JSON.parse(readFileSync(DATA_PATH, "utf-8")); } catch { return []; }
}

function saveUsers(users: AllowedUser[]) {
  writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));
}

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return false;
  }
  return true;
}

// GET — list all users
export async function GET() {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ users: loadUsers(), allPermissions: ALL_PERMISSIONS });
}

// POST — add user
export async function POST(req: NextRequest) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { email, permissions } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const users = loadUsers();
  if (users.some((u) => u.email === email)) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }
  const newUser: AllowedUser = {
    email: email.toLowerCase().trim(),
    role: "member",
    permissions: permissions ?? ALL_PERMISSIONS,
    addedAt: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsers(users);
  return NextResponse.json({ user: newUser });
}

// PATCH — update user permissions
export async function PATCH(req: NextRequest) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { email, permissions } = await req.json();
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email === email);
  if (idx === -1) return NextResponse.json({ error: "User not found" }, { status: 404 });
  users[idx].permissions = permissions;
  saveUsers(users);
  return NextResponse.json({ user: users[idx] });
}

// DELETE — remove user
export async function DELETE(req: NextRequest) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { email } = await req.json();
  const users = loadUsers().filter((u) => u.email !== email);
  saveUsers(users);
  return NextResponse.json({ ok: true });
}
