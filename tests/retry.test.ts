import test from "node:test";
import assert from "node:assert/strict";
import { classifyFailure, isWorthRetrying, withRetry } from "../lib/ai/retry";

// Keep backoff imperceptible; withRetry reads these per call.
process.env.AI_RETRY_BASE_MS = "1";
process.env.AI_RETRY_MAX_MS = "2";

// The exact messages these providers returned in production, kept verbatim
// because the whole difficulty is that they read almost identically.
const OPENAI_QUOTA =
  "429 You exceeded your current quota, please check your plan and billing details. " +
  "For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.";

const GEMINI_QUOTA =
  '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and ' +
  'billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits","status":"RESOURCE_EXHAUSTED"}}';

const GEMINI_UNAVAILABLE =
  '{"error":{"code":503,"message":"The service is currently unavailable.","status":"UNAVAILABLE"}}';

test("an OpenAI quota error is a funding problem, not a rate limit", () => {
  // Retrying this forever cannot help — it needs billing credit.
  const err = Object.assign(new Error(OPENAI_QUOTA), { status: 429, code: "insufficient_quota" });
  assert.equal(classifyFailure("openai", err), "no_quota");
  assert.equal(isWorthRetrying("no_quota"), false);
});

test("an OpenAI quota error is recognised from the message alone", () => {
  // Not every thrown shape carries the structured code.
  assert.equal(classifyFailure("openai", new Error(OPENAI_QUOTA)), "no_quota");
});

test("OpenAI throttling is still a rate limit despite the same status", () => {
  const err = Object.assign(new Error("429 Rate limit reached"), {
    status: 429,
    code: "rate_limit_exceeded",
  });
  assert.equal(classifyFailure("openai", err), "rate_limit");
  assert.equal(isWorthRetrying("rate_limit"), true);
});

test("the same wording from Gemini is a rate limit, because its free tier paces per minute", () => {
  // This is the distinction the whole classifier exists for: identical prose,
  // opposite handling.
  assert.equal(classifyFailure("gemini", new Error(GEMINI_QUOTA)), "rate_limit");
  assert.notEqual(
    classifyFailure("gemini", new Error(GEMINI_QUOTA)),
    classifyFailure("openai", new Error(OPENAI_QUOTA)),
    "near-identical text must not collapse into one verdict"
  );
});

test("a 503 buried in Gemini's JSON is transient", () => {
  assert.equal(classifyFailure("gemini", new Error(GEMINI_UNAVAILABLE)), "transient");
});

test("a rejected key is never retried", () => {
  const err = Object.assign(new Error("Incorrect API key provided"), { status: 401 });
  assert.equal(classifyFailure("claude", err), "auth");
  assert.equal(isWorthRetrying("auth"), false);
});

test("network faults are transient", () => {
  assert.equal(classifyFailure("claude", new Error("fetch failed: ECONNRESET")), "transient");
});

test("retries a transient failure and reports how many tries it took", async () => {
  let calls = 0;
  const outcome = await withRetry("gemini", async () => {
    calls++;
    if (calls < 3) throw Object.assign(new Error("overloaded"), { status: 503 });
    return "ok";
  });

  assert.equal(outcome.value, "ok");
  assert.equal(outcome.attempts, 3);
  assert.equal(calls, 3);
});

test("gives up immediately on a funding problem instead of burning attempts", async () => {
  let calls = 0;
  const outcome = await withRetry("openai", async () => {
    calls++;
    throw Object.assign(new Error(OPENAI_QUOTA), { status: 429, code: "insufficient_quota" });
  });

  assert.equal(calls, 1, "a hopeless call must be made exactly once");
  assert.equal(outcome.attempts, 1, "the attempt count must reflect reality, not the ceiling");
  assert.equal(outcome.kind, "no_quota");
  assert.equal(outcome.value, undefined);
});

test("stops after the attempt ceiling when a rate limit never clears", async () => {
  let calls = 0;
  const outcome = await withRetry(
    "gemini",
    async () => {
      calls++;
      throw new Error(GEMINI_QUOTA);
    },
    3
  );

  assert.equal(calls, 3);
  assert.equal(outcome.attempts, 3);
  assert.equal(outcome.kind, "rate_limit");
});
