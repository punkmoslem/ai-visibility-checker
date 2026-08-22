import { callClaude } from "./claude";
import { callOpenAI } from "./openai";
import { callGemini } from "./gemini";
import { withRetry } from "./retry";
import { throttle } from "./throttle";
import { AiTool, FailureKind, MockContext, ModelResponse, ProviderResult } from "./types";

export const AI_TOOLS: AiTool[] = ["claude", "openai", "gemini"];

const PROVIDERS: Record<AiTool, (prompt: string, ctx: MockContext) => Promise<ProviderResult>> = {
  claude: callClaude,
  openai: callOpenAI,
  gemini: callGemini,
};

const TOOL_LABEL: Record<AiTool, string> = {
  claude: "Claude",
  openai: "ChatGPT",
  gemini: "Gemini",
};

/**
 * A stored error is read by someone deciding whether to re-run, so it says
 * which of the two things happened: the run pushed too hard, or the account
 * cannot serve the request at all. The raw provider text is kept on the end,
 * since it carries the detail needed to actually fix a funding or key problem.
 */
function describeFailure(tool: AiTool, kind: FailureKind, attempts: number, err: unknown): string {
  const label = TOOL_LABEL[tool];
  const detail = err instanceof Error ? err.message : String(err ?? "unknown error");
  const tries = `${attempts} ${attempts === 1 ? "attempt" : "attempts"}`;

  switch (kind) {
    case "rate_limit":
      return `${label} rate limit — still limited after ${tries}. Re-running later should succeed. (${detail})`;
    case "no_quota":
      return `${label} account is out of quota — add billing credit, as retrying cannot help. (${detail})`;
    case "auth":
      return `${label} rejected the API key — check it is valid and belongs to the funded account. (${detail})`;
    case "transient":
      return `${label} was unavailable after ${tries}. Re-running should succeed. (${detail})`;
    default:
      return `${label} call failed: ${detail}`;
  }
}

export function callModel(tool: AiTool, prompt: string, mockContext: MockContext): Promise<ModelResponse> {
  const start = Date.now();

  return throttle(tool, async () => {
    const outcome = await withRetry(tool, () => PROVIDERS[tool](prompt, mockContext));
    const latencyMs = Date.now() - start;

    if (outcome.value) {
      return { ...outcome.value, latencyMs, attempts: outcome.attempts };
    }

    const kind = outcome.kind ?? "fatal";
    return {
      text: "",
      isMock: false,
      latencyMs,
      attempts: outcome.attempts,
      failureKind: kind,
      errorMessage: describeFailure(tool, kind, outcome.attempts, outcome.error),
    };
  });
}

export * from "./types";
export { classifyFailure, isWorthRetrying } from "./retry";
