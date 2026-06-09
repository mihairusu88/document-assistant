import { getCurrentUser } from "@/lib/supabase/server";
import { ConversationService } from "@/services/ConversationService";

export const runtime = "nodejs";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

/** GET /api/conversations — list the current user's conversations. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("unauthorized", "Authentication required.", 401);

  try {
    const data = await new ConversationService().list();
    return Response.json({ ok: true, data });
  } catch (err) {
    console.error("[api/conversations] GET failed:", err);
    return jsonError(
      "internal_error",
      err instanceof Error ? err.message : "Failed to list conversations.",
      500,
    );
  }
}

/** POST /api/conversations — create a conversation. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("unauthorized", "Authentication required.", 401);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      title?: string;
    };
    const conv = await new ConversationService().create(body);
    return Response.json({ ok: true, data: conv });
  } catch (err) {
    console.error("[api/conversations] POST failed:", err);
    return jsonError(
      "internal_error",
      err instanceof Error ? err.message : "Failed to create conversation.",
      500,
    );
  }
}
