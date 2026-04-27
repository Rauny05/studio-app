import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, ADMIN_EMAIL, ALL_PERMISSIONS } from "@/app/api/auth/[...nextauth]/route";
import { loadUsers, saveUsers } from "@/lib/users-store";
import type { AllowedUser } from "@/lib/users-store";

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  return !!(session?.user?.email && session.user.email === ADMIN_EMAIL);
}

export async function GET() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const users = await loadUsers();
  return NextResponse.json({ users, allPermissions: ALL_PERMISSIONS });
}

export async function POST(req: NextRequest) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { email, permissions } = await req.json();
  if (!email || typeof email !== "string") return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const users = await loadUsers();
  if (users.some((u) => u.email === email)) return NextResponse.json({ error: "User already exists" }, { status: 409 });

  const newUser: AllowedUser = {
    email: email.toLowerCase().trim(),
    role: "member",
    permissions: permissions ?? ALL_PERMISSIONS,
    addedAt: new Date().toISOString(),
  };
  users.push(newUser);
  try {
    await saveUsers(users);
  } catch (err) {
    console.error("[admin/users] POST save failed:", err);
    return NextResponse.json({ error: "Failed to save — storage error" }, { status: 500 });
  }
  return NextResponse.json({ user: newUser });
}

export async function PATCH(req: NextRequest) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { email, permissions } = await req.json();
  const users = await loadUsers();
  const idx = users.findIndex((u) => u.email === email);
  if (idx === -1) return NextResponse.json({ error: "User not found" }, { status: 404 });
  users[idx].permissions = permissions;
  try {
    await saveUsers(users);
  } catch (err) {
    console.error("[admin/users] PATCH save failed:", err);
    return NextResponse.json({ error: "Failed to save — storage error" }, { status: 500 });
  }
  return NextResponse.json({ user: users[idx] });
}

export async function DELETE(req: NextRequest) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { email } = await req.json();
  const users = (await loadUsers()).filter((u) => u.email !== email);
  try {
    await saveUsers(users);
  } catch (err) {
    console.error("[admin/users] DELETE save failed:", err);
    return NextResponse.json({ error: "Failed to save — storage error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
