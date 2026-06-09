import { getCurrentUser } from "@/lib/supabase/server";
import { ConversationService } from "@/services/ConversationService";

export const runtime = "nodejs";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

/** DELETE /api/conversations/[id] — delete a conversation (messages cascade). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("unauthorized", "Authentication required.", 401);

  const { id } = await ctx.params;
  try {
    await new ConversationService().delete(id);
    return Response.json({ ok: true, data: { id } });
  } catch (err) {
    console.error("[api/conversations/[id]] DELETE failed:", err);
    return jsonError(
      "internal_error",
      err instanceof Error ? err.message : "Failed to delete conversation.",
      500,
    );
  }
}
