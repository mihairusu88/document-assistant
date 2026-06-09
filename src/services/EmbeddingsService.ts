import { EMBEDDING_MODEL, VOYAGE_EMBEDDINGS_URL } from "@/services/constants";

/** Shape of the Voyage AI embeddings response we rely on. */
interface VoyageEmbeddingsResponse {
  data: { embedding: number[]; index: number }[];
}

/** How many times to attempt the embeddings request before giving up. */
const MAX_ATTEMPTS = 3;

/** Exponential backoff between retries (250ms, 500ms, …). */
function backoff(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
}

/**
 * Step 3 of the RAG pipeline: turn chunk texts into embedding vectors.
 * Runs server-side — the API key is a secret.
 *
 * Uses Voyage AI (`voyage-3-large`, 1024-dim) instead of OpenAI: the corporate
 * Zscaler proxy category-blocks `api.openai.com` (and Cohere / Jina / Mistral /
 * Hugging Face), while `api.voyageai.com` is reachable. See the corp-proxy
 * memory note. Voyage ships no Node SDK, so we call the REST API with `fetch`.
 * Equivalent of the original Python:
 *   client.embeddings.create(model=..., input=texts)
 *   return [e.embedding for e in response.data]
 */
export class EmbeddingsService {
  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "VOYAGE_API_KEY is not set. Add it to .env.local (see .env.example).",
      );
    }
    this.apiKey = apiKey;
  }

  /**
   * Embed one or more texts.
   * @param texts      The strings to embed.
   * @param inputType  "document" when storing chunks, "query" when embedding a
   *                   search question — Voyage optimises each differently.
   * @returns one embedding vector per input text (aligned by index).
   */
  async embedText(
    texts: string[],
    inputType: "document" | "query" = "document",
  ): Promise<number[][]> {
    // Retry transient failures: rate limits (429), server errors (5xx) and
    // network/proxy hiccups (fetch rejects) — these are common behind the
    // TLS-intercepting corporate proxy and on rapid successive query embeds, and
    // must not crash the whole chat request. Client errors (4xx) are not retried.
    let lastError: Error = new Error("Voyage embeddings request failed.");

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let res: Response;
      try {
        res = await fetch(VOYAGE_EMBEDDINGS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: texts,
            input_type: inputType,
          }),
        });
      } catch (err) {
        // The request never completed (network / proxy) — always transient.
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_ATTEMPTS) {
          await backoff(attempt);
          continue;
        }
        throw lastError;
      }

      if (res.ok) {
        const json = (await res.json()) as VoyageEmbeddingsResponse;
        // Voyage returns results out of order in theory — sort by index to stay aligned.
        return json.data
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding);
      }

      const detail = await res.text().catch(() => "");
      lastError = new Error(`Voyage embeddings request failed (${res.status}): ${detail}`);
      const transient = res.status === 429 || res.status >= 500;
      if (transient && attempt < MAX_ATTEMPTS) {
        await backoff(attempt);
        continue;
      }
      throw lastError;
    }

    throw lastError;
  }
}
