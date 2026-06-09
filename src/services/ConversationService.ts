import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { ConversationDTO } from "@/types/entities";

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

function toDTO(row: ConversationRow): ConversationDTO {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Conversation persistence over the Supabase JS client. RLS scopes every
 * query to the authenticated user, so reads/writes are auto-filtered; we still
 * set `user_id` explicitly on insert.
 */
export class ConversationService {
  async list(): Promise<ConversationDTO[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ConversationRow[]).map(toDTO);
  }

  async create(input: { id?: string; title?: string }): Promise<ConversationDTO> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated.");

    const supabase = await createClient();
    const row = {
      id: input.id ?? crypto.randomUUID(),
      user_id: user.id,
      title: input.title?.trim() || "New chat",
    };
    const { data, error } = await supabase
      .from("conversations")
      .insert(row)
      .select("id,title,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return toDTO(data as ConversationRow);
  }

  async ensure(input: { id: string; title?: string }): Promise<void> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated.");

    const supabase = await createClient();
    const row = {
      id: input.id,
      user_id: user.id,
      title: input.title?.trim() || "New chat",
    };
    const { error } = await supabase
      .from("conversations")
      .upsert(row, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  async touch(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  /** Delete a conversation (its messages cascade via the FK). RLS scopes the
   * delete to the owner, so a non-owner's call is a no-op. */
  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
