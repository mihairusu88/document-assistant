"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  initialRagState,
  type RagState,
  type RagStepState,
} from "./ragSteps";

interface RagStore {
  /** Whether the pipeline drawer is open (not persisted — always starts closed). */
  open: boolean;
  /** RAG step status per conversation id. */
  byConversation: Record<string, RagState>;
  /** Whether the RAG system is enabled. */
  ragEnabled: boolean;
  /** Width (px) of the pipeline drawer; user-resizable, persisted. */
  ragWidth: number;
  setOpen: (open: boolean) => void;
  setRagEnabled: (enabled: boolean) => void;
  setRagWidth: (width: number) => void;
  toggleOpen: () => void;
  setStep: (conversationId: string, id: number, patch: Partial<RagStepState>) => void;
  resetSteps: (conversationId: string, ids: readonly number[]) => void;
}

// On the server there is no sessionStorage; hand persist a no-op so creating the
// store never throws. The real read happens client-side via `rehydrate()`.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/**
 * Global RAG pipeline store. A module singleton, so it survives the client
 * navigation from the new-chat screen to the thread; the `persist` middleware
 * (sessionStorage) additionally survives a full reload.
 */
export const useRagStore = create<RagStore>()(
  persist(
    (set) => ({
      open: true,
      byConversation: {},
      ragEnabled: true,
      ragWidth: 512,

      setOpen: (open) => set({ open }),
      setRagEnabled: (ragEnabled) => set({ ragEnabled }),
      setRagWidth: (ragWidth) => set({ ragWidth }),
      toggleOpen: () => set((s) => ({ open: !s.open })),

      setStep: (conversationId, id, patch) =>
        set((s) => {
          const current = s.byConversation[conversationId] ?? initialRagState();
          return {
            byConversation: {
              ...s.byConversation,
              [conversationId]: { ...current, [id]: { ...current[id], ...patch } },
            },
          };
        }),

      resetSteps: (conversationId, ids) =>
        set((s) => {
          const current = s.byConversation[conversationId] ?? initialRagState();
          const next = { ...current };
          for (const id of ids) next[id] = { status: "pending", log: "" };
          return {
            byConversation: { ...s.byConversation, [conversationId]: next },
          };
        }),
    }),
    {
      name: "rag-status",
      // Bumped when the step `data` shape changes. The migration drops the
      // stale-shaped step payloads (so they're not rendered in the JSON viewer)
      // while preserving the user's preferences.
      version: 2,
      migrate: (persisted) => {
        const prev = (persisted ?? {}) as Partial<
          Pick<RagStore, "byConversation" | "ragEnabled" | "ragWidth">
        >;
        return {
          byConversation: {},
          ragEnabled: prev.ragEnabled ?? true,
          ragWidth: prev.ragWidth ?? 512,
        };
      },
      storage: createJSONStorage(() =>
        globalThis.window === undefined ? noopStorage : globalThis.sessionStorage,
      ),
      // The step data, RAG-enabled flag and drawer width survive a reload; the
      // drawer's open state always resets on load.
      partialize: (s) => ({
        byConversation: s.byConversation,
        ragEnabled: s.ragEnabled,
        ragWidth: s.ragWidth,
      }),
      // Hydrate manually after mount so the first client render matches the
      // server (empty) and React doesn't flag a hydration mismatch.
      skipHydration: true,
    },
  ),
);
