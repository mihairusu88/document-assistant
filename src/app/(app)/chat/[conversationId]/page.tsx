import { ChatWindow } from "@/views/chat/components/chatWindow";
import { MessageService } from "@/services/MessageService";

/**
 * Conversation thread. Loads the persisted message history for this
 * conversation (RLS scopes it to the signed-in user) and hands it to the chat
 * UI, which streams new turns against /api/chat.
 */
export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const { conversationId } = await params;
  const { draft } = await searchParams;

  // Best-effort: a missing/empty history (or pre-migration) renders an empty
  // thread rather than crashing.
  const initialMessages = await new MessageService()
    .listAsUIMessages(conversationId)
    .catch(() => []);

  return (
    <ChatWindow
      conversationId={conversationId}
      initialMessages={initialMessages}
      initialDraft={draft}
      documents={[]}
    />
  );
}
