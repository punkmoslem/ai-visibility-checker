import { callClaude } from "./claude";
import { callOpenAI } from "./openai";
import { callGemini } from "./gemini";
import { AiTool, MockContext, ModelResponse } from "./types";

export const AI_TOOLS: AiTool[] = ["claude", "openai", "gemini"];

export function callModel(tool: AiTool, prompt: string, mockContext: MockContext): Promise<ModelResponse> {
  switch (tool) {
    case "claude":
      return callClaude(prompt, mockContext);
    case "openai":
      return callOpenAI(prompt, mockContext);
    case "gemini":
      return callGemini(prompt, mockContext);
  }
}

export * from "./types";
