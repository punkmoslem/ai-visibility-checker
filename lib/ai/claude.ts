import { generateMockResponse } from "./mock-generator";
import { MockContext, ModelResponse } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export async function callClaude(prompt: string, mockContext: MockContext): Promise<ModelResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const start = Date.now();

  if (!apiKey) {
    return {
      text: generateMockResponse("claude", mockContext),
      isMock: true,
      latencyMs: Date.now() - start,
    };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content
      .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    return { text, isMock: false, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      text: "",
      isMock: false,
      latencyMs: Date.now() - start,
      errorMessage: err instanceof Error ? err.message : "Claude API call failed",
    };
  }
}
