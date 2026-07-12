import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { heuristicParser, normalizeTrackedNames, ParsedResult } from "../lib/parsing/parser";
import { computeShareOfVoiceFromParsed } from "../lib/parsing/sov";

interface FixtureResult {
  aiTool: string;
  errorMessage: string | null;
  rawResponse: string;
}
interface Fixture {
  brandName: string;
  industry: string;
  competitorNamesAtRunTime: string[];
  results: FixtureResult[];
}

const fixturesDir = path.join(__dirname, "fixtures");
const fixtureFiles = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));

function appearsIn(text: string, name: string): boolean {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(text);
}

test("fixture suite covers multiple industries", () => {
  assert.ok(fixtureFiles.length >= 2, "at least two saved run fixtures");
  const industries = new Set(
    fixtureFiles.map((f) => (JSON.parse(readFileSync(path.join(fixturesDir, f), "utf8")) as Fixture).industry)
  );
  assert.ok(industries.size >= 2, `fixtures span multiple industries, got: ${[...industries]}`);
});

for (const file of fixtureFiles) {
  const fixture: Fixture = JSON.parse(readFileSync(path.join(fixturesDir, file), "utf8"));
  const { brandName } = fixture;
  // Feed the parser the names exactly as they were stored at run time
  // (a single comma-joined string) — the fix must handle that shape.
  const trackedInput = fixture.competitorNamesAtRunTime;
  const trackedNames = normalizeTrackedNames(trackedInput);
  const okResponses = fixture.results.filter((r) => !r.errorMessage).map((r) => r.rawResponse);

  const parsed: ParsedResult[] = okResponses.map((text) =>
    heuristicParser.parse(text, { brandName, competitorNames: trackedInput })
  );
  const sov = computeShareOfVoiceFromParsed(brandName, trackedInput, parsed);

  test(`${file}: fixture is intact`, () => {
    assert.ok(okResponses.length > 0, "fixture has successful responses");
    assert.ok(trackedNames.length > 1, "fixture tracks multiple competitors");
  });

  test(`${file}: every competitor present in the answers is counted with mentions > 0`, () => {
    for (const name of trackedNames) {
      const presentSomewhere = okResponses.some((text) => appearsIn(text, name));
      const entry = sov.find((e) => e.name.toLowerCase() === name.toLowerCase());
      assert.ok(entry, `SoV entry exists for ${name}`);
      if (!presentSomewhere) {
        console.log(`  [${file}] ${name}: absent from all answers (0 mentions, correctly)`);
        continue;
      }
      assert.ok(entry!.mentions > 0, `${name} appears in answers but was counted 0`);
      console.log(`  [${file}] ${name}: ${entry!.mentions} mentions, avgRank=${entry!.avgRank?.toFixed(1) ?? "—"}`);
    }
  });

  test(`${file}: target SoV is < 100% whenever any competitor is mentioned`, () => {
    const brand = sov.find((e) => e.isBrand)!;
    const competitorMentions = sov.filter((e) => !e.isBrand).reduce((sum, e) => sum + e.mentions, 0);
    console.log(
      `  [${file}] ${brand.name} SoV = ${(brand.shareOfVoice * 100).toFixed(1)}% (${brand.mentions} of ${
        brand.mentions + competitorMentions
      } tracked mentions)`
    );
    if (competitorMentions > 0) {
      assert.ok(brand.shareOfVoice < 1, "target cannot hold 100% SoV while competitors are mentioned");
    }
  });
}
