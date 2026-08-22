export type AiTool = "claude" | "openai" | "gemini";

/**
 * Why a call failed. The distinction that matters operationally is between a
 * limit that clears on its own and one that does not: `rate_limit` is worth
 * waiting out, `no_quota` needs someone to add credit and will fail for the
 * rest of the run no matter how often it is retried.
 */
export type FailureKind = "rate_limit" | "no_quota" | "auth" | "transient" | "fatal";

export interface ModelResponse {
  text: string;
  isMock: boolean;
  latencyMs: number;
  errorMessage?: string;
  failureKind?: FailureKind;
  /** How many times the call was attempted, including the first. */
  attempts?: number;
}

/** Providers return this on success and throw on failure, so callModel can
 *  inspect the error and decide whether another attempt is worthwhile. */
export interface ProviderResult {
  text: string;
  isMock: boolean;
}

export interface ModelProvider {
  name: AiTool;
  call(prompt: string, mockContext: MockContext): Promise<ModelResponse>;
}

export interface MockContext {
  seed: string;
  brandName: string;
  industry: string;
  competitorNames: string[];
  promptCategory: string;
}
