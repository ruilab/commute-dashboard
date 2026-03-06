/**
 * Resilient fetch with timeout, retry, and structured error handling.
 * Used for all external API calls (transit, weather, GitHub).
 */

import { log } from "./logger";

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  label?: string; // for logging
}

export async function resilientFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 5000,
    retries = 1,
    retryDelayMs = 500,
    label = url.slice(0, 60),
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok && attempt < retries) {
        log.warn("fetch failed, retrying", {
          label,
          status: response.status,
          attempt: attempt + 1,
        });
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries) {
        log.warn("fetch error, retrying", {
          label,
          error: lastError.message,
          attempt: attempt + 1,
        });
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  log.error("fetch failed permanently", {
    label,
    error: lastError?.message,
    retries,
  });

  throw lastError || new Error(`Failed to fetch: ${label}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
