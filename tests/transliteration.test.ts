import { describe, it, expect } from "vitest";
import { roundTripsCleanly, latinToNative, nativeToLatin } from "../engine/generator/transliteration.js";
import { lexicon } from "../engine/data.js";

describe("Latin <-> native-script round trip", () => {
  it("round-trips every lexicon word losslessly through the phoneme tokenizer", () => {
    const failures: string[] = [];
    for (const entry of lexicon.entries) {
      const word = entry.gkh.replace(/-/g, "");
      if (!roundTripsCleanly(word)) failures.push(entry.gkh);
    }
    expect(failures).toEqual([]);
  });

  it("latinToNative -> nativeToLatin reconstructs the original word for sample vocabulary", () => {
    for (const word of ["khar", "shak", "ghûldor", "nâzgam", "pâkûl", "rûkakûk"]) {
      const result = latinToNative(word);
      expect(nativeToLatin(result.words)).toBe(word);
    }
  });

  it("produces non-empty SVG markup for a multi-word sentence", () => {
    const result = latinToNative("ük sel dor.");
    expect(result.nativeSvg).toContain("<svg");
    expect(result.nativeSvg.match(/<svg/g)?.length).toBeGreaterThanOrEqual(3); // ük, sel, dor
  });

  it("is deterministic", () => {
    const a = latinToNative("khardûm magdûm");
    const b = latinToNative("khardûm magdûm");
    expect(a).toEqual(b);
  });
});
