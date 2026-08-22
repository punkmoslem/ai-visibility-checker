import { AiTool, FailureKind } from "./types";

// Read per call rather than at import, so tuning these does not require a
// restart and tests can shorten the waits.
const setting = (name: string, fallback: number) => Number(process.env[name] || fallback);

/** HTTP status from whichever shape the provider SDK throws. */
function statusOf(err: unknown): number | undefined {
  const e = err as { status?: unknown; statusCode?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const value of [e?.status, e?.statusCode, e?.response?.status, e?.code]) {
    if (typeof value === "number") return value;
  }
  // Gemini reports the status inside a JSON string on the message.
  const message = err instanceof Error ? err.message : "";
  const match = message.match(/"code"\s*:\s*(\d{3})/) ?? message.match(/^\s*(\d{3})\s/);
  return match ? Number(match[1]) : undefined;
}

function codeOf(err: unknown): string {
  const e = err as { code?: unknown; type?: unknown; error?: { code?: unknown; type?: unknown; status?: unknown } };
  const candidates = [e?.code, e?.type, e?.error?.code, e?.error?.type, e?.error?.status];
  return candidates.filter((c) => typeof c === "string").join(" ").toLowerCase();
}

/**
 * Both OpenAI and Gemini answer an exhausted allowance with `429 You exceeded
 * your current quota`, so the wording alone cannot tell a per-minute rate limit
 * from an account with no credit. The provider is what disambiguates: OpenAI
 * uses that phrasing (and the `insufficient_quota` code) only for billing,
 * raising `rate_limit_exceeded` for genuine throttling, whereas Gemini's free
 * tier returns it for ordinary per-minute pacing that clears within seconds.
 */
export function classifyFailure(tool: AiTool, err: unknown): FailureKind {
  const status = statusOf(err);
  const code = codeOf(err);
  const message = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  if (code.includes("insufficient_quota")) return "no_quota";
  if (status === 401 || status === 403 || code.includes("invalid_api_key")) return "auth";

  if (status === 429) {
    if (code.includes("rate_limit")) return "rate_limit";
    if (tool === "openai" && /quota|billing/.test(message)) return "no_quota";
    return "rate_limit";
  }

  if (status !== undefined && status >= 500) return "transient";
  if (/etimedout|econnreset|econnrefused|enotfound|socket hang up|fetch failed|network|timeout/.test(message)) {
    return "transient";
  }
  return "fatal";
}

/** Waiting out a rate limit or a blip is worthwhile; a funding or key problem
 *  is not — it fails identically however many times it is tried. */
export function isWorthRetrying(kind: FailureKind): boolean {
  return kind === "rate_limit" || kind === "transient";
}

/** Providers advertise how long to wait; honour it when they do. */
function retryAfterMs(err: unknown): number | undefined {
  const e = err as { headers?: Record<string, unknown> };
  const raw = e?.headers?.["retry-after"] ?? e?.headers?.["Retry-After"];
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

function backoffMs(attempt: number): number {
  const base = setting("AI_RETRY_BASE_MS", 1000);
  const ceiling = setting("AI_RETRY_MAX_MS", 20000);
  const exponential = Math.min(base * 2 ** (attempt - 1), ceiling);
  // Full jitter, so a batch that rate-limits together does not retry in lockstep
  // and immediately rate-limit again.
  return Math.round(Math.random() * exponential);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface AttemptOutcome<T> {
  value?: T;
  error?: unknown;
  kind?: FailureKind;
  attempts: number;
}

/**
 * Runs `fn`, retrying only failures that can plausibly succeed on a later try.
 * Reports the attempt count either way so callers can say how hard they tried.
 */
export async function withRetry<T>(
  tool: AiTool,
  fn: () => Promise<T>,
  maxAttempts: number = setting("AI_MAX_ATTEMPTS", 4)
): Promise<AttemptOutcome<T>> {
  let lastError: unknown;
  let lastKind: FailureKind = "fatal";
  let used = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    used = attempt;
    try {
      return { value: await fn(), attempts: attempt };
    } catch (err) {
      lastError = err;
      lastKind = classifyFailure(tool, err);
      if (!isWorthRetrying(lastKind) || attempt === maxAttempts) break;
      await sleep(retryAfterMs(err) ?? backoffMs(attempt));
    }
  }

  return { error: lastError, kind: lastKind, attempts: used };
}
