import test from "node:test";
import assert from "node:assert/strict";
import { heuristicParser } from "../lib/parsing/parser";

const ctx = { brandName: "JOTUN", competitorNames: ["Dulux", "Avian", "Mowilex"] };

function ranks(rawText: string) {
  const parsed = heuristicParser.parse(rawText, ctx);
  const out: Record<string, number | null> = { JOTUN: parsed.rankPosition };
  for (const c of parsed.competitorMentions) out[c.name] = c.rankPosition;
  return out;
}

test("ranks a clean numbered list by position", () => {
  assert.deepEqual(
    ranks("Top paint brands:\n1. Dulux\n2. Avian\n3. JOTUN\n4. Mowilex"),
    { JOTUN: 3, Dulux: 1, Avian: 2, Mowilex: 4 }
  );
});

test("numbering restarts per list block, so a later section does not inflate rank", () => {
  // Bullets in earlier, unrelated sections previously shared one running
  // counter, pushing brands in a later block to an invented high position.
  const text = [
    "### 1. Cat murah",
    "* Alasan: binder rendah",
    "",
    "### 2. Cat VOC tinggi",
    "* Alasan: bau menyengat",
    "",
    "Rekomendasi per kelas:",
    "* Kelas Premium: JOTUN, Dulux",
    "* Kelas Menengah: Avian",
  ].join("\n");

  const r = ranks(text);
  assert.equal(r.JOTUN, 1, "JOTUN leads the premium tier, not position 8");
  assert.equal(r.Dulux, 2);
  assert.equal(r.Avian, 3);
});

test("brands sharing one line are ordered left to right, not tied", () => {
  const r = ranks("Rekomendasi:\n- Premium: JOTUN, Dulux\n- Ekonomis: Avian");
  assert.equal(r.JOTUN, 1);
  assert.equal(r.Dulux, 2);
  assert.equal(r.Avian, 3);
  assert.notEqual(r.JOTUN, r.Dulux, "same-line brands must not tie");
});

test("a list naming only one tracked brand yields no rank", () => {
  // An explanatory list is not a competitive ranking.
  const text = "Hal yang perlu dihindari:\n- Cat tanpa merek\n- Cat VOC tinggi\n- Hindari tiruan JOTUN";
  assert.equal(ranks(text).JOTUN, null);
});

test("picks the block naming the most tracked brands", () => {
  const text = [
    "Catatan singkat:",
    "- JOTUN dan Avian tersedia luas",
    "",
    "Peringkat resmi:",
    "1. Dulux",
    "2. Mowilex",
    "3. Avian",
    "4. JOTUN",
  ].join("\n");

  const r = ranks(text);
  assert.equal(r.Dulux, 1, "should rank from the four-brand list, not the two-brand aside");
  assert.equal(r.JOTUN, 4);
});

test("falls back to order of mention when there is no list", () => {
  assert.deepEqual(
    ranks("Dulux is widely stocked, while JOTUN leads premium exteriors."),
    { JOTUN: 2, Dulux: 1, Avian: null, Mowilex: null }
  );
});

test("a brand absent from the ranking list has no position", () => {
  const r = ranks("Peringkat:\n1. Dulux\n2. Avian\n3. Mowilex");
  assert.equal(r.JOTUN, null);
});
