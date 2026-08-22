import pLimit from "p-limit";
import { AiTool } from "./types";

/**
 * Pacing is per provider, not global. A single shared limit lets a run fire six
 * calls at whichever providers happen to be free, which is what pushed Gemini
 * past its allowance: its free tier permits roughly 15 requests a minute, while
 * a 14-prompt run asks for 14 within seconds.
 *
 * `minIntervalMs` spaces out the *starts* of calls, which is what a
 * requests-per-minute limit actually measures — concurrency alone cannot
 * express it, since short calls finish and immediately free a slot.
 */
const setting = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

const DEFAULTS: Record<AiTool, { concurrency: number; minIntervalMs: number }> = {
  claude: { concurrency: 6, minIntervalMs: 0 },
  openai: { concurrency: 4, minIntervalMs: 0 },
  // ~15 requests/minute, the documented free-tier ceiling for Flash.
  gemini: { concurrency: 2, minIntervalMs: 4000 },
};

const envKey = (tool: AiTool) => (tool === "openai" ? "OPENAI" : tool.toUpperCase());

// Read per call rather than at import, so pacing can be tuned without a restart.
function paceOf(tool: AiTool) {
  const prefix = envKey(tool);
  return {
    concurrency: setting(`${prefix}_CONCURRENCY`, DEFAULTS[tool].concurrency),
    minIntervalMs: setting(`${prefix}_MIN_INTERVAL_MS`, DEFAULTS[tool].minIntervalMs),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createGate(tool: AiTool) {
  const limit = pLimit(Math.max(1, paceOf(tool).concurrency));
  let nextStart = 0;

  return <T>(fn: () => Promise<T>): Promise<T> =>
    limit(async () => {
      const { minIntervalMs } = paceOf(tool);
      if (minIntervalMs > 0) {
        const now = Date.now();
        const startAt = Math.max(now, nextStart);
        nextStart = startAt + minIntervalMs;
        if (startAt > now) await sleep(startAt - now);
      }
      return fn();
    });
}

const gates: Record<AiTool, ReturnType<typeof createGate>> = {
  claude: createGate("claude"),
  openai: createGate("openai"),
  gemini: createGate("gemini"),
};

/** Queues `fn` behind that provider's own concurrency and spacing limits. */
export function throttle<T>(tool: AiTool, fn: () => Promise<T>): Promise<T> {
  return gates[tool](fn);
}
