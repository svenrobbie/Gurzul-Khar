// The other half of the frozen-coiner bargain.
//
// coiner_v1 avoids a FROZEN snapshot of the lexicon, not the live one, so the
// dictionary can grow without any coined word ever moving. The cost is that a
// newly hand-authored word could take a spelling the coiner has already issued
// to some other gloss — which would make one spelling mean two things, in a
// language whose whole promise is that it doesn't.
//
// This test catches that at authoring time, when it is free to fix: pick a
// different spelling for the new word. Never "fix" it by editing the golden
// file or the reserved snapshot — the coined word may already be written down.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lexicon, coinerReservedV1 } from "../engine/data.js";

interface GoldenCase {
  lemma: string;
  pos: string;
  lang: string;
  gkh: string;
}

const goldenPath = fileURLToPath(new URL("./fixtures/coiner_v1.golden.json", import.meta.url));
const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as { cases: GoldenCase[] };

describe("hand-authored words never collide with issued coinages", () => {
  it("the frozen snapshot still matches the entries it was taken from", () => {
    const snapshot = new Set(coinerReservedV1.forms);
    const missing = coinerReservedV1.forms.filter(
      (form) => !lexicon.entries.some((e) => e.gkh.replace(/-/g, "").toLowerCase() === form)
    );
    expect(
      missing,
      "a spelling in coinerReserved_v1.json no longer exists in the lexicon. Renaming or removing an entry " +
        "that coiner_v1 was avoiding is fine for the dictionary, but the snapshot must keep the old spelling " +
        "reserved — the coiner's output depends on it. Leave the snapshot alone."
    ).toEqual([]);
    expect(snapshot.size).toBe(coinerReservedV1.entryCount);
  });

  it("no lexicon entry added since the freeze takes a spelling the coiner has issued", () => {
    const issued = new Map(golden.cases.map((c) => [c.gkh, `${c.lemma} (${c.pos}, ${c.lang})`]));
    const reserved = new Set(coinerReservedV1.forms);
    const clashes = lexicon.entries
      .map((e) => ({ id: e.id, form: e.gkh.replace(/-/g, "").toLowerCase(), gloss: `${e.en} / ${e.nl}` }))
      .filter((e) => !reserved.has(e.form) && issued.has(e.form))
      .map((e) => `${e.id} "${e.form}" (${e.gloss}) is already the coined form of ${issued.get(e.form)}`);

    expect(
      clashes,
      "a hand-authored entry has taken a spelling coiner_v1 already issued to another gloss. " +
        "Choose a different spelling for the new entry; the coined word may already be in use."
    ).toEqual([]);
  });
});
