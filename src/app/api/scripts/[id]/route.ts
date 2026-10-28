import { NextRequest, NextResponse } from "next/server";
import { updateScript, updateScriptDoc, getScripts } from "@/lib/scripts-store";
import { authenticateRequest } from "@/lib/api-auth";
import { dataSet } from "@/lib/data-store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticateRequest(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json() as { status?: "approved" | "pending"; docId?: string };
    if (body.status !== "approved" && body.status !== "pending") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    let updated;
    if (body.docId) {
      updated = await updateScriptDoc(id, body.docId, body.status, user.email);
    } else {
      updated = await updateScript(id, {
        status: body.status,
        approved_at: body.status === "approved" ? new Date().toISOString() : null,
        approved_by: body.status === "approved" ? user.email : null,
      });
    }
    if (!updated) return NextResponse.json({ error: "Script not found" }, { status: 404 });
    return NextResponse.json({ script: updated });
  } catch (err) {
    console.error("[scripts/:id] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update script" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticateRequest(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const scripts = await getScripts();
    const filtered = scripts.filter((s) => s.id !== id);
    await dataSet("studio:scripts", filtered);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scripts/:id] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
