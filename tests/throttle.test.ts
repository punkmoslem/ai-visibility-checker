import test from "node:test";
import assert from "node:assert/strict";
import { throttle } from "../lib/ai/throttle";

// Real pacing is 4s between Gemini calls; the behaviour under test is the
// spacing itself, so run it compressed.
process.env.GEMINI_MIN_INTERVAL_MS = "60";

test("gemini call starts are spaced, not merely limited in parallelism", async () => {
  // A requests-per-minute ceiling cannot be expressed with concurrency alone:
  // short calls finish and immediately free a slot, so four quick calls would
  // all land inside the same second and trip the limit.
  const starts: number[] = [];
  const begun = Date.now();

  await Promise.all(
    Array.from({ length: 4 }, () =>
      throttle("gemini", async () => {
        starts.push(Date.now() - begun);
      })
    )
  );

  starts.sort((a, b) => a - b);
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1];
    assert.ok(gap >= 50, `call ${i + 1} started only ${gap}ms after the previous one`);
  }
});

test("one provider's pacing does not slow the others", async () => {
  // The original global limit is what pushed Gemini over its allowance; the
  // fix is worthless if it instead drags Claude down to Gemini's rate.
  const begun = Date.now();
  await Promise.all(Array.from({ length: 6 }, () => throttle("claude", async () => {})));
  const elapsed = Date.now() - begun;

  assert.ok(elapsed < 200, `six Claude calls took ${elapsed}ms — pacing is leaking across providers`);
});
