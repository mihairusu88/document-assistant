import type { UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";

type MessageRow = {
  id: string;
  role: UIMessage["role"];
  parts: UIMessage["parts"];
};

/**
 * Message persistence over the Supabase JS client. RLS scopes rows through the
 * parent conversation's ownership policy, so queries are auto-filtered to the
 * authenticated user.
 */
export class MessageService {
  async listAsUIMessages(conversationId: string): Promise<UIMessage[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("messages")
      .select("id,role,parts")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as MessageRow[]).map(
      (row) => ({ id: row.id, role: row.role, parts: row.parts }) as UIMessage,
    );
  }

  async saveUIMessages(conversationId: string, messages: UIMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const supabase = await createClient();
    const rows = messages.map((m) => ({
      id: m.id,
      conversation_id: conversationId,
      role: m.role,
      parts: m.parts,
    }));
    const { error } = await supabase
      .from("messages")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
}
