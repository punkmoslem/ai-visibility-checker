export type AiTool = "claude" | "openai" | "gemini";

export interface ModelResponse {
  text: string;
  isMock: boolean;
  latencyMs: number;
  errorMessage?: string;
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
