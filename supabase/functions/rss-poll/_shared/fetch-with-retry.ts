// Aucune source RSS de SentiqS n'avait de seconde chance en cas de 429/503/timeout
// transitoire (un seul fetch() par cycle de cron) — voir audit du 2026-08-09. Ce
// helper factorise un retry avec backoff exponentiel + jitter, en respectant
// Retry-After quand le serveur le fournit, et sans retenter les erreurs 4xx
// définitives (404, 401...) qui ne se résoudront pas en réessayant.

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  timeoutMs: 20000,
};

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> {
  const { maxAttempts, baseDelayMs, maxDelayMs, timeoutMs } = { ...DEFAULT_OPTIONS, ...opts };
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok || !isTransientStatus(resp.status)) {
        return resp;
      }
      if (attempt === maxAttempts) {
        return resp; // dernière tentative : renvoyer tel quel pour que l'appelant logge le vrai statut
      }

      const retryAfterHeader = resp.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : null;
      const delay = retryAfterMs && !Number.isNaN(retryAfterMs)
        ? Math.min(retryAfterMs, maxDelayMs)
        : Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs) + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      if (attempt === maxAttempts) throw err;
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs) + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastErr;
}
