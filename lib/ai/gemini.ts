import { generateMockResponse } from "./mock-generator";
import { MockContext, ProviderResult } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Throws on failure — see callClaude for why.
export async function callGemini(prompt: string, mockContext: MockContext): Promise<ProviderResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    return { text: generateMockResponse("gemini", mockContext), isMock: true };
  }

  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
  });
  return { text: response.text ?? "", isMock: false };
}
