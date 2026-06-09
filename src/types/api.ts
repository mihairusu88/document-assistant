/**
 * Uniform API response envelope used by every JSON route handler.
 * (Streaming chat routes are exempt — they return a stream.)
 */

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody };

/** Narrowing helper for clients consuming the envelope. */
export function isApiError<T>(
  res: ApiResponse<T>,
): res is { ok: false; error: ApiErrorBody } {
  return res.ok === false;
}
