// coiner_v1 was frozen on 2026-11-23, after the sample in COINER_SAMPLE.md
// passed the ear test (ROADMAP.md phase 1 gate).
//
// From that moment the weight tables are data, not tuning knobs: changing one
// changes every word the coiner has ever produced, including words already
// written down, already learned, already rendered in Khargûl. If you want
// different weights, that is coiner_v2 — a new file, a new version tag, a new
// golden fixture — and v1 keeps serving every gloss it has already coined.
//
// If this test fails, do not update the digest. Revert the data file.
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COINER_VERSION } from "../engine/lexicon/coiner.js";

const WEIGHTS_SHA256 = "107a63e16d299d64604f3cd023e7615b22856441764c55e0d7decb3b2c64fba5";
const weightsPath = fileURLToPath(new URL("../data/phonology/coinerWeights_v1.json", import.meta.url));

describe("coiner_v1 is frozen", () => {
  it("the measured weight tables are byte-for-byte the frozen ones", () => {
    const actual = createHash("sha256").update(readFileSync(weightsPath)).digest("hex");
    expect(
      actual,
      "data/phonology/coinerWeights_v1.json has changed. Every word coiner_v1 has ever produced has changed with it. " +
        "Revert the file; if new weights are genuinely wanted, add coiner_v2 instead of editing v1."
    ).toBe(WEIGHTS_SHA256);
  });

  it("still reports itself as v1", () => {
    expect(COINER_VERSION).toBe("v1");
  });
});
