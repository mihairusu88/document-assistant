/**
 * View-model shapes rendered by the UI (sidebar, chat, document chips).
 * The data/persistence layer that produced these was removed during the RAG
 * rebuild — these remain as the contracts the UI components expect, so the
 * backend can be reintroduced against them.
 */

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface UserDTO {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDTO {
  id: string;
  conversationId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
  status: DocumentStatus;
  error: string | null;
  createdAt: string;
}
