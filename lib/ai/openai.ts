import { generateMockResponse } from "./mock-generator";
import { MockContext, ProviderResult } from "./types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Throws on failure — see callClaude for why.
export async function callOpenAI(prompt: string, mockContext: MockContext): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { text: generateMockResponse("openai", mockContext), isMock: true };
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey, maxRetries: 0 });
  const response = await client.responses.create({
    model: MODEL,
    input: prompt,
  });
  return { text: response.output_text, isMock: false };
}
