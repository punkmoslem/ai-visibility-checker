import { generateMockResponse } from "./mock-generator";
import { MockContext, ModelResponse } from "./types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function callOpenAI(prompt: string, mockContext: MockContext): Promise<ModelResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  const start = Date.now();

  if (!apiKey) {
    return {
      text: generateMockResponse("openai", mockContext),
      isMock: true,
      latencyMs: Date.now() - start,
    };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: MODEL,
      input: prompt,
    });
    return { text: response.output_text, isMock: false, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      text: "",
      isMock: false,
      latencyMs: Date.now() - start,
      errorMessage: err instanceof Error ? err.message : "OpenAI API call failed",
    };
  }
}
