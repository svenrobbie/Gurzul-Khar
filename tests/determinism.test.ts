import { describe, it, expect } from "vitest";
import { translate } from "../engine/translator/index.js";
import { latinToNative } from "../engine/generator/transliteration.js";
import { generateConsonantGlyph } from "../engine/phonology/glyphGenerator.js";
import { phonology } from "../engine/data.js";

const SAMPLE_SENTENCES: { input: string; direction: "en-gkh" | "nl-gkh" | "gkh-en" | "gkh-nl" }[] = [
  { input: "I see the land", direction: "en-gkh" },
  { input: "ük sel dor", direction: "gkh-en" },
  { input: "ük pâku ag tû magu", direction: "gkh-nl" },
  { input: "Ik zie het land", direction: "nl-gkh" },
];

describe("engine determinism (spec §7.4)", () => {
  it("translate() returns byte-identical results for identical input run twice", () => {
    for (const { input, direction } of SAMPLE_SENTENCES) {
      const first = translate(input, direction);
      const second = translate(input, direction);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    }
  });

  it("latinToNative() produces identical SVG for identical input run twice", () => {
    const a = latinToNative("khar shak dor");
    const b = latinToNative("khar shak dor");
    expect(a.nativeSvg).toBe(b.nativeSvg);
    expect(a.roundTripLatin).toBe(b.roundTripLatin);
  });

  it("generateConsonantGlyph() is a pure function of place/manner/voicing", () => {
    const k = phonology.consonants.find((c) => c.id === "k")!;
    const svg1 = generateConsonantGlyph(k);
    const svg2 = generateConsonantGlyph(k);
    expect(svg1).toBe(svg2);
  });
});
