import type { AuthActionState } from "@/views/users/actions";

/** Renders the success/error message returned by an auth action. */
export function AuthMessage({ state }: { state: AuthActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
        {state.success}
      </p>
    );
  }
  return null;
}
