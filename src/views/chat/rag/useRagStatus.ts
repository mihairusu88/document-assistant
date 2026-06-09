"use client";

import { useCallback, useEffect } from "react";
import {
  ANSWER_STEP_IDS,
  initialRagState,
  INGEST_STEP_IDS,
  type RagState,
  type RagStepState,
} from "./ragSteps";
import { useRagStore } from "./ragStore";

// Stable fallback so a conversation with no steps yet doesn't churn renders.
const EMPTY_STATE: RagState = initialRagState();

/**
 * Per-conversation view of the RAG store: the step states plus bound actions
 * and the shared drawer flag. Triggers the store's manual rehydration once on
 * mount (the store uses `skipHydration` to avoid an SSR mismatch).
 */
export function useRagStatus(conversationId: string) {
  const state = useRagStore((s) => s.byConversation[conversationId]) ?? EMPTY_STATE;
  const open = useRagStore((s) => s.open);
  const setOpen = useRagStore((s) => s.setOpen);
  const toggleOpen = useRagStore((s) => s.toggleOpen);
  const setStepRaw = useRagStore((s) => s.setStep);
  const resetStepsRaw = useRagStore((s) => s.resetSteps);

  useEffect(() => {
    void useRagStore.persist.rehydrate();
  }, []);

  const setStep = useCallback(
    (id: number, patch: Partial<RagStepState>) => setStepRaw(conversationId, id, patch),
    [conversationId, setStepRaw],
  );

  const resetIngest = useCallback(
    () => resetStepsRaw(conversationId, INGEST_STEP_IDS),
    [conversationId, resetStepsRaw],
  );

  const resetAnswer = useCallback(
    () => resetStepsRaw(conversationId, ANSWER_STEP_IDS),
    [conversationId, resetStepsRaw],
  );

  return { state, open, setOpen, toggleOpen, setStep, resetIngest, resetAnswer };
}

export type RagStatus = ReturnType<typeof useRagStatus>;
