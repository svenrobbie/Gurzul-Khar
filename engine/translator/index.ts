// Top-level deterministic translator: EN/NL <-> GKH, all 4 directions.
// Implements the processing pipeline from the project spec §7.2 at the level
// of the supported sentence subset (§7.1/§7.3/§7.4): tokenize -> (complex /
// coordinated / simple clause) parse -> grammatical transform -> render ->
// native-script + pronunciation + word-by-word explanation.
import type { Direction, TranslationResult, TranslationExplanation, WordAnalysis } from "./types.js";
import { tokenizeSentence } from "../morphology/tokenizer.js";
import { analyzeWord } from "../morphology/analyzer.js";
import { findByEnglish, findByDutch } from "./lexiconLookup.js";
import {
  parseNaturalClause,
  renderClauseNatural,
  renderNPNatural,
  consumeNaturalNP,
  decapitalizeClause,
  type Lang,
  type ParseFailure,
} from "./naturalLanguage.js";
import { parseGkhClause, renderClauseGkh, renderNP, consumeNP, type Clause, type GkhParseFailure } from "./clause.js";
import { latinToNative } from "../generator/transliteration.js";
import { ipaOfSentence } from "./ipa.js";

const EN_COORD: Record<string, "ag" | "vo" | "nâth"> = { and: "ag", or: "vo", but: "nâth" };
const NL_COORD: Record<string, "ag" | "vo" | "nâth"> = { en: "ag", of: "vo", maar: "nâth" };
const GKH_COORD_TO_EN: Record<string, string> = { ag: "and", vo: "or", nâth: "but" };
const GKH_COORD_TO_NL: Record<string, string> = { ag: "en", vo: "of", nâth: "maar" };
const EN_COMPLEMENTISER = "that";
const NL_COMPLEMENTISER = "dat";
const GKH_COMPLEMENTISER = "sû";

function isFailure(x: unknown): x is ParseFailure | GkhParseFailure {
  return typeof x === "object" && x !== null && "ok" in x && (x as any).ok === false;
}

function emptyExplanation(): TranslationExplanation {
  return { words: [], transformations: [], rootIdentification: [] };
}

function describeFailure(f: ParseFailure | GkhParseFailure): { error: string; reason: "unknown-word" | "unsupported-pattern" | "empty-input" } {
  if (f.reason === "unknown-word") {
    return { error: `The word "${f.word}" is not yet in the Gurzûl Khar lexicon, so this cannot be translated reliably. (Spec §7.3: unknown vocabulary is never silently guessed.)`, reason: "unknown-word" };
  }
  if (f.reason === "empty-input") {
    return { error: "No text was provided to translate.", reason: "empty-input" };
  }
  return { error: "This sentence does not match any grammatical pattern currently supported by the translator. Supported patterns: simple SVO declaratives, negatives, yes/no and content questions, possession, plurals, comparative/superlative predicate adjectives, and two-clause coordination/complementiser sentences.", reason: "unsupported-pattern" };
}

function explainEnNl(words: string[], lang: Lang): WordAnalysis[] {
  return words.map((w) => {
    const entry = lang === "en" ? findByEnglish(w) : findByDutch(w);
    return {
      surface: w,
      gloss: entry ? entry.gkh : "(not found in lexicon)",
      root: entry?.root ?? entry?.gkh ?? w,
      pos: entry?.pos,
      affixes: [],
      ipa: entry?.ipa,
    };
  });
}

function explainGkh(words: string[]): WordAnalysis[] {
  return words.map((w) => {
    const a = analyzeWord(w);
    return {
      surface: w,
      gloss: a.entry ? `${a.entry.en} / ${a.entry.nl}` : "(unrecognized)",
      root: a.root,
      pos: a.entry?.pos,
      affixes: a.affixes.map((af) => ({ suffix: af.suffix, gloss: af.gloss })),
    };
  });
}

function splitOnTopLevelWord(words: string[], markers: Record<string, string>): { left: string[]; marker: string; right: string[] } | null {
  for (let i = 1; i < words.length - 1; i++) {
    if (markers[words[i]]) return { left: words.slice(0, i), marker: markers[words[i]], right: words.slice(i + 1) };
  }
  return null;
}

function toGkh(input: string, lang: Lang): TranslationResult {
  const direction: Direction = lang === "en" ? "en-gkh" : "nl-gkh";
  const { isQuestion, words } = tokenizeSentence(input);
  if (words.length === 0) {
    return { ok: false, input, direction, ...describeFailure({ ok: false, reason: "empty-input" }), explanation: emptyExplanation() };
  }
  const explanation = emptyExplanation();
  explanation.words = explainEnNl(words, lang);

  const complementiser = lang === "en" ? EN_COMPLEMENTISER : NL_COMPLEMENTISER;
  const complementiserIdx = words.indexOf(complementiser);
  const coordMap = lang === "en" ? EN_COORD : NL_COORD;

  let gkhTokens: string[];
  if (complementiserIdx > 0 && complementiserIdx < words.length - 1) {
    const mainWords = words.slice(0, complementiserIdx);
    const subWords = words.slice(complementiserIdx + 1);
    const main = parseNaturalClause(mainWords, lang, false);
    const sub = parseNaturalClause(subWords, lang, isQuestion);
    if (isFailure(main)) return { ok: false, input, direction, ...describeFailure(main), explanation };
    if (isFailure(sub)) return { ok: false, input, direction, ...describeFailure(sub), explanation };
    explanation.transformations.push("Parsed as a complex sentence: main clause + complementiser + subordinate clause.");
    gkhTokens = [...renderClauseGkh(main), GKH_COMPLEMENTISER, ...renderClauseGkh(sub)];
  } else {
    const split = splitOnTopLevelWord(words, coordMap);
    if (split) {
      const left = parseNaturalClause(split.left, lang, false);
      const right = parseNaturalClause(split.right, lang, isQuestion);
      if (isFailure(left)) return { ok: false, input, direction, ...describeFailure(left), explanation };
      if (isFailure(right)) return { ok: false, input, direction, ...describeFailure(right), explanation };
      explanation.transformations.push(`Parsed as two coordinated clauses joined by "${split.marker}".`);
      gkhTokens = [...renderClauseGkh(left), split.marker, ...renderClauseGkh(right)];
    } else {
      const npOnly = consumeNaturalNP(words, lang);
      if (!("reason" in npOnly) && npOnly.rest.length === 0) {
        explanation.transformations.push("Parsed as a standalone noun phrase (no verb) — e.g. a possessive or plural noun phrase.");
        gkhTokens = renderNP(npOnly.np);
      } else {
        const clause = parseNaturalClause(words, lang, isQuestion);
        if (isFailure(clause)) return { ok: false, input, direction, ...describeFailure(clause), explanation };
        explanation.transformations.push(...describeClauseTransforms(clause));
        gkhTokens = renderClauseGkh(clause);
      }
    }
  }

  const output = gkhTokens.join(" ");
  const native = latinToNative(output);
  explanation.rootIdentification = explanation.words
    .filter((w) => w.gloss !== "(not found in lexicon)")
    .map((w) => `"${w.surface}" -> root "${w.root}" (${w.gloss})`);

  return {
    ok: true,
    input,
    direction,
    output,
    nativeScript: native.nativeSvg,
    pronunciation: ipaOfSentence(output),
    explanation,
  };
}

function describeClauseTransforms(clause: Clause): string[] {
  const t: string[] = [];
  if (clause.negate) t.push(`Negation applied: particle "na" inserted before the finite verb.`);
  if (clause.questionYesNo) t.push(`Yes/no question: sentence-final particle "ma" added.`);
  if (clause.questionWord) t.push(`Content question: question word fronted to clause-initial position (role: ${clause.questionRole}).`);
  if (clause.subject?.plural || clause.object?.plural) t.push(`Plural suffix "-ûk" applied to the plural noun.`);
  if (clause.subject?.possessive || clause.object?.possessive) t.push(`Possession expressed via ${(clause.subject?.possessive ?? clause.object?.possessive)!.type === "suffix" ? "a pronominal possessive suffix" : 'the postposition "ta"'}.`);
  if (clause.predicateAdjective?.degree === "comparative") t.push(`Comparative marker "zan" applied.`);
  if (clause.predicateAdjective?.degree === "superlative") t.push(`Superlative: marker "zan" plus suffix "-gûl" applied.`);
  t.push(`Verb tense "${clause.verb.tense}" rendered with the matching suffix/irregular form.`);
  return t;
}

function fromGkh(input: string, lang: Lang): TranslationResult {
  const direction: Direction = lang === "en" ? "gkh-en" : "gkh-nl";
  const { words } = tokenizeSentence(input);
  if (words.length === 0) {
    return { ok: false, input, direction, ...describeFailure({ ok: false, reason: "empty-input" }), explanation: emptyExplanation() };
  }
  const explanation = emptyExplanation();
  explanation.words = explainGkh(words);

  const coordToNatural = lang === "en" ? GKH_COORD_TO_EN : GKH_COORD_TO_NL;
  const sûIdx = words.indexOf(GKH_COMPLEMENTISER);

  let sentence: string;
  if (sûIdx > 0 && sûIdx < words.length - 1) {
    const main = parseGkhClause(words.slice(0, sûIdx));
    const sub = parseGkhClause(words.slice(sûIdx + 1));
    if (isFailure(main)) return { ok: false, input, direction, ...describeFailure(main), explanation };
    if (isFailure(sub)) return { ok: false, input, direction, ...describeFailure(sub), explanation };
    explanation.transformations.push("Parsed as a complex sentence: main clause + complementiser + subordinate clause.");
    const complementiser = lang === "en" ? EN_COMPLEMENTISER : NL_COMPLEMENTISER;
    const mainText = decapitalizeClause(renderClauseNatural(main as Clause, lang));
    const subText = decapitalizeClause(renderClauseNatural(sub as Clause, lang));
    sentence = `${mainText} ${complementiser} ${subText}.`;
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  } else {
    const markerIdx = words.findIndex((w, i) => i > 0 && i < words.length - 1 && coordToNatural[w] !== undefined);
    if (markerIdx !== -1) {
      const leftWords = words.slice(0, markerIdx);
      const rightWords = words.slice(markerIdx + 1);
      const leftClause = parseGkhClause(leftWords);
      const rightClause = parseGkhClause(rightWords);
      if (isFailure(leftClause)) return { ok: false, input, direction, ...describeFailure(leftClause), explanation };
      if (isFailure(rightClause)) return { ok: false, input, direction, ...describeFailure(rightClause), explanation };
      explanation.transformations.push(`Parsed as two coordinated clauses joined by "${words[markerIdx]}".`);
      const leftText = decapitalizeClause(renderClauseNatural(leftClause as Clause, lang));
      const rightText = decapitalizeClause(renderClauseNatural(rightClause as Clause, lang));
      sentence = `${leftText} ${coordToNatural[words[markerIdx]]} ${rightText}.`;
      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    } else {
      const npOnly = consumeNP(words);
      if (!("reason" in npOnly) && npOnly.rest.length === 0) {
        explanation.transformations.push("Parsed as a standalone noun phrase (no verb) — e.g. a possessive or plural noun phrase.");
        sentence = renderNPNatural(npOnly.np, lang, npOnly.np.kind === "noun");
      } else {
        const clause = parseGkhClause(words);
        if (isFailure(clause)) return { ok: false, input, direction, ...describeFailure(clause), explanation };
        explanation.transformations.push(...describeClauseTransforms(clause as Clause));
        sentence = renderClauseNatural(clause as Clause, lang);
      }
    }
  }

  explanation.rootIdentification = explanation.words
    .filter((w) => w.gloss !== "(unrecognized)")
    .map((w) => `"${w.surface}" -> root "${w.root}" (${w.gloss})`);

  return {
    ok: true,
    input,
    direction,
    output: sentence,
    pronunciation: ipaOfSentence(input),
    explanation,
  };
}

/** Translates `input` in the given direction. Deterministic: identical input + identical /data version always yields an identical result. */
export function translate(input: string, direction: Direction): TranslationResult {
  switch (direction) {
    case "en-gkh":
      return toGkh(input, "en");
    case "nl-gkh":
      return toGkh(input, "nl");
    case "gkh-en":
      return fromGkh(input, "en");
    case "gkh-nl":
      return fromGkh(input, "nl");
  }
}

export type { TranslationResult, Direction } from "./types.js";
