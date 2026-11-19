// Fixed regression suite across all 4 translation directions, covering the
// documented supported grammar subset (declaratives, negatives, questions,
// possession, plurals, comparative/superlative, coordination, complex
// sentences). Expected outputs are pinned here; if the engine's output
// changes, this test catches the regression immediately.
import { describe, it, expect } from "vitest";
import { translate } from "../engine/translator/index.js";

interface Case {
  name: string;
  direction: "en-gkh" | "nl-gkh" | "gkh-en" | "gkh-nl";
  input: string;
  expectedOutput: string;
}

const cases: Case[] = [
  // Simple declarative, present tense
  { name: "EN->GKH simple declarative", direction: "en-gkh", input: "I see the land", expectedOutput: "ük selu dor" },
  { name: "NL->GKH simple declarative", direction: "nl-gkh", input: "Ik zie het land", expectedOutput: "ük selu dor" },
  { name: "GKH->EN simple declarative", direction: "gkh-en", input: "ük selu dor", expectedOutput: "I see the land." },
  { name: "GKH->NL simple declarative", direction: "gkh-nl", input: "ük selu dor", expectedOutput: "Ik zie de land." },

  // Negation
  { name: "EN->GKH negative", direction: "en-gkh", input: "I do not see the land", expectedOutput: "ük na selu dor" },
  { name: "NL->GKH negative", direction: "nl-gkh", input: "Ik zie het land niet", expectedOutput: "ük na selu dor" },
  { name: "GKH->EN negative", direction: "gkh-en", input: "ük na selu dor", expectedOutput: "I do not see the land." },

  // Yes/no question
  { name: "EN->GKH yes/no question", direction: "en-gkh", input: "Do you see the land?", expectedOutput: "tû selu dor ma" },
  { name: "GKH->EN yes/no question", direction: "gkh-en", input: "tû selu dor ma", expectedOutput: "You see the land?" },

  // Content question (object gap)
  { name: "EN->GKH content question (what)", direction: "en-gkh", input: "What do you see?", expectedOutput: "kâsh tû selu" },
  { name: "GKH->EN content question (what)", direction: "gkh-en", input: "kâsh tû selu", expectedOutput: "What you see?" },

  // Content question (subject gap)
  { name: "EN->GKH content question (who)", direction: "en-gkh", input: "Who sees the land?", expectedOutput: "manu selu dor" },

  // Possession via postposition 'ta' (grammar.json canonical example)
  { name: "EN->GKH possession (postposition)", direction: "en-gkh", input: "the king's strength", expectedOutput: "khar ta shak" },
  { name: "GKH->EN possession (postposition)", direction: "gkh-en", input: "khar ta shak", expectedOutput: "the king's strength" },

  // Pronominal possessive suffix
  { name: "EN->GKH possession (suffix)", direction: "en-gkh", input: "my strength", expectedOutput: "kharum" },
  { name: "GKH->EN possession (suffix)", direction: "gkh-en", input: "kharum", expectedOutput: "my strength" },

  // Plural (regular and epenthetic)
  { name: "EN->GKH plural, regular", direction: "en-gkh", input: "the lands", expectedOutput: "dorûk" },
  { name: "GKH->EN plural, epenthetic", direction: "gkh-en", input: "rûkakûk", expectedOutput: "the armies" },

  // Comparative / superlative predicate adjective
  { name: "GKH->EN comparative", direction: "gkh-en", input: "shak ash zan khar", expectedOutput: "The king is more strong." },
  { name: "GKH->EN superlative", direction: "gkh-en", input: "shak ash zan khargûl", expectedOutput: "The king is the most strong." },

  // Coordination (grammar.json canonical example)
  { name: "GKH->EN coordination", direction: "gkh-en", input: "ük pâku ag tû magu", expectedOutput: "I go and you follow." },
  { name: "GKH->NL coordination", direction: "gkh-nl", input: "ük pâku ag tû magu", expectedOutput: "Ik ga en jij volgt." },

  // Complex sentence with complementiser 'sû' (grammar.json canonical example).
  // Note: grammar.json's own free-English gloss for this example says "I know", but the word
  // "zûrak" is morphologically marked past tense (root zûr + past suffix -ak per
  // verbs.tenseSuffixes.past), so the only translation consistent with the actual grammar rules
  // is past tense ("I knew"). Flagged in DESIGN_DECISIONS.md as a discovered inconsistency
  // between grammar.json's illustrative gloss and its own suffix table.
  { name: "GKH->EN complex sentence", direction: "gkh-en", input: "ük zûrak sû tû pâkâth", expectedOutput: "I knew that you will go." },

  // Unknown word handling (Phase 2 brief §2): never silently dropped. The
  // unrecognized word is reported and the rest of the sentence is still
  // translated, honestly marked partial rather than guessed.
  { name: "unknown word -> partial translation, not silently dropped", direction: "en-gkh", input: "I see the spaceship", expectedOutput: "__PARTIAL__:spaceship" },
  { name: "NL unknown word -> partial translation", direction: "nl-gkh", input: "Ik zie het ruimteschip", expectedOutput: "__PARTIAL__:ruimteschip" },
  { name: "GKH unknown word -> partial translation to EN", direction: "gkh-en", input: "ük selu blorzak", expectedOutput: "__PARTIAL__:blorzak" },
  { name: "completely empty input fails honestly", direction: "en-gkh", input: "", expectedOutput: "__FAIL__" },

  // Grammatically well-formed but structurally unsupported (relative clause) —
  // every word IS known, but no supported clause pattern matches, so this
  // must fail with reason "unsupported-pattern", not be silently guessed.
  { name: "unsupported pattern (relative clause) fails honestly", direction: "en-gkh", input: "the king who has strength", expectedOutput: "__FAIL__" },
];

describe("translation regression suite (all 4 directions)", () => {
  for (const c of cases) {
    it(c.name, () => {
      const result = translate(c.input, c.direction);
      if (c.expectedOutput === "__FAIL__") {
        expect(result.ok).toBe(false);
        return;
      }
      if (typeof c.expectedOutput === "string" && c.expectedOutput.startsWith("__PARTIAL__:")) {
        const expectedUnknown = c.expectedOutput.slice("__PARTIAL__:".length);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.partial).toBe(true);
          expect(result.unknownWords).toContain(expectedUnknown);
          // Articles are not vocabulary gaps (Gurzûl Khar has none at all) — never flagged.
          expect(result.unknownWords).not.toContain("the");
          expect(result.unknownWords).not.toContain("het");
        }
        return;
      }
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.output).toBe(c.expectedOutput);
      }
    });
  }
});
