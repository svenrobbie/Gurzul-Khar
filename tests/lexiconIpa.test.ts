// The lexicon's `ipa` field is derived data, not an independent opinion.
//
// It used to be hand-written, and it had drifted: 152 entries had lost their
// stress mark, 135 wrote the uvular trill as a plain Latin r, and five were
// simply wrong — including "ük", the word for "I", which claimed a short
// vowel for a sound the orthography and the tokeniser both treat as long. The
// Dictionary page showed one pronunciation while the Translator generated
// another.
//
// Now the engine is the only source. If this test fails, either a spelling
// changed (so the IPA must be regenerated with `npm run lexicon:ipa`) or
// something in phonology.json moved underneath the whole lexicon — both worth
// stopping for.
import { describe, it, expect } from "vitest";
import { lexicon } from "../engine/data.js";
import { ipaOfWord } from "../engine/translator/ipa.js";
import { tryTokenizeWord } from "../engine/phonology/phonemes.js";

describe("lexicon IPA matches what the engine generates", () => {
  it("every entry tokenizes, so every entry can have generated IPA", () => {
    const untokenizable = lexicon.entries
      .filter((e) => !tryTokenizeWord(e.gkh.replace(/-/g, "")))
      .map((e) => `${e.id} "${e.gkh}"`);
    expect(untokenizable).toEqual([]);
  });

  it("every entry's stored IPA is exactly the engine's", () => {
    const drifted = lexicon.entries
      .map((e) => ({ e, generated: ipaOfWord(e.gkh.replace(/-/g, "")) }))
      .filter(({ e, generated }) => generated !== e.ipa)
      .map(({ e, generated }) => `${e.id} "${e.gkh}": stored ${e.ipa}, engine ${generated}`);

    expect(
      drifted,
      "stored IPA no longer matches the engine. Regenerate with `npm run lexicon:ipa` rather than editing by hand — " +
        "the field is derived from phonology.json, which is the source of truth."
    ).toEqual([]);
  });

  it("no stored IPA uses a Latin letter where an IPA symbol is declared", () => {
    // The old data had "quz" and "nami" carrying Latin u and i where the
    // declared short vowels are ʊ and ɪ, and 135 entries writing the uvular
    // trill as a plain r. Long vowels legitimately contain a Latin letter
    // (û is uː), so u and i are only wrong when NOT followed by a length mark.
    const suspicious = lexicon.entries
      .filter((e) => /r/.test(e.ipa) || /[ui](?!ː)/.test(e.ipa))
      .map((e) => `${e.id} "${e.gkh}": ${e.ipa}`);
    expect(suspicious, "a Latin r, or a u/i without a length mark — phonology.json declares ʀ, ʊ and ɪ").toEqual([]);
  });
});
