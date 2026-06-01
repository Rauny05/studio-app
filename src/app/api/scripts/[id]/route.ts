import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateScript, updateScriptDoc } from "@/lib/scripts-store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json() as {
      status?: "approved" | "pending";
      docId?: string; // if set, update a specific doc
    };

    if (body.status !== "approved" && body.status !== "pending") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    let updated;

    if (body.docId) {
      // Update a specific doc within the script
      updated = await updateScriptDoc(id, body.docId, body.status, session.user.email);
    } else {
      // Update the whole script (legacy / approve all)
      const now = new Date().toISOString();
      updated = await updateScript(id, {
        status: body.status,
        approved_at: body.status === "approved" ? now : null,
        approved_by: body.status === "approved" ? session.user.email : null,
      });
    }

    if (!updated) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    return NextResponse.json({ script: updated });
  } catch (err) {
    console.error("[scripts/:id] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update script" }, { status: 500 });
  }
}
