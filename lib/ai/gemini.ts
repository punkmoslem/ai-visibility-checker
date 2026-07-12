import { generateMockResponse } from "./mock-generator";
import { MockContext, ModelResponse } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export async function callGemini(prompt: string, mockContext: MockContext): Promise<ModelResponse> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const start = Date.now();

  if (!apiKey) {
    return {
      text: generateMockResponse("gemini", mockContext),
      isMock: true,
      latencyMs: Date.now() - start,
    };
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
    });
    return { text: response.text ?? "", isMock: false, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      text: "",
      isMock: false,
      latencyMs: Date.now() - start,
      errorMessage: err instanceof Error ? err.message : "Gemini API call failed",
    };
  }
}
