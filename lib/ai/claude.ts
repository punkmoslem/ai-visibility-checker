import { generateMockResponse } from "./mock-generator";
import { MockContext, ProviderResult } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Throws on failure so callModel can classify the error and decide whether
// another attempt is worthwhile; it also measures latency around the retries.
export async function callClaude(prompt: string, mockContext: MockContext): Promise<ProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { text: generateMockResponse("claude", mockContext), isMock: true };
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  // Retries are owned by withRetry, so the SDK's own attempts are disabled —
  // otherwise the two multiply and the reported attempt count means nothing.
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const text = message.content
    .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  return { text, isMock: false };
}
