/** The TypeScript engine, wrapped to the shared `Engine` surface. */
import { translate as tsTranslate } from "@engine/translator/index.js";
import { ipaOfWord, ipaOfSentence } from "@engine/translator/ipa.js";
import type { Direction, Engine, TranslationResult, WordAnalysis } from "./types";

export const typescriptEngine: Engine = {
  name: "typescript",

  translate(input: string, direction: Direction): TranslationResult {
    const result = tsTranslate(input, direction);
    if (!result.ok) {
      return { ok: false, reason: result.reason, error: result.error };
    }
    return {
      ok: true,
      output: result.output,
      pronunciation: result.pronunciation,
      partial: result.partial,
      unknownWords: result.unknownWords,
      coinedWords: result.coinedWords,
      transformations: result.explanation.transformations,
    };
  },

  ipaOfWord,
  ipaOfSentence,

  analyze(text: string, direction: Direction): WordAnalysis[] {
    const result = tsTranslate(text, direction);
    return result.explanation.words.map((w) => ({
      surface: w.surface,
      root: w.root,
      gloss: w.gloss,
      pos: w.pos ?? null,
      affixes: w.affixes.map((a) => `${a.suffix} (${a.gloss})`),
      ipa: w.ipa,
    }));
  },
};
