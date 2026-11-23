// Top-level deterministic translator: EN/NL <-> GKH, all 4 directions.
// Implements the processing pipeline from the project spec §7.2 at the level
// of the supported sentence subset (§7.1/§7.3/§7.4): tokenize -> (complex /
// coordinated / simple clause) parse -> grammatical transform -> render ->
// native-script + pronunciation + word-by-word explanation.
import type { Direction, TranslationResult, TranslationExplanation, WordAnalysis } from "./types.js";
import { tokenizeSentence } from "../morphology/tokenizer.js";
import { analyzeWord } from "../morphology/analyzer.js";
import { findByEnglish, findByDutch, findByGkh } from "./lexiconLookup.js";
import {
  parseNaturalClause,
  renderClauseNatural,
  renderNPNatural,
  consumeNaturalNP,
  decapitalizeClause,
  resolveContentWord,
  type Lang,
  type ParseFailure,
} from "./naturalLanguage.js";
import { parseGkhClause, renderClauseGkh, renderNP, consumeNP, type Clause, type GkhParseFailure } from "./clause.js";
import { latinToNative } from "../generator/transliteration.js";
import { ipaOfSentence } from "./ipa.js";
import { coin, COINER_VERSION } from "../lexicon/coiner.js";
import { lemmatize, guessLemma } from "../morphology/lemmatizer.js";
import { glossCoinage, recordCoinage } from "../lexicon/coinageIndex.js";

const EN_COORD: Record<string, "ag" | "vo" | "nâth"> = { and: "ag", or: "vo", but: "nâth" };
const NL_COORD: Record<string, "ag" | "vo" | "nâth"> = { en: "ag", of: "vo", maar: "nâth" };
const GKH_COORD_TO_EN: Record<string, string> = { ag: "and", vo: "or", nâth: "but" };
const GKH_COORD_TO_NL: Record<string, string> = { ag: "en", vo: "of", nâth: "maar" };
/**
 * Subordinators, from grammar.json syntax.subordination plus the time
 * subordinator "râth". A complex sentence is [main] [subordinator] [subordinate],
 * in every one of these cases, so they share one code path rather than the
 * single hardcoded "that" the translator started with.
 */
interface Subordinator {
  gkh: string;
  en: string;
  nl: string[];
  label: string;
}

const SUBORDINATORS: Subordinator[] = [
  { gkh: "sû", en: "that", nl: ["dat"], label: "complementiser" },
  { gkh: "ghâsha", en: "because", nl: ["omdat", "want"], label: "cause" },
  { gkh: "ith", en: "if", nl: ["als", "indien"], label: "condition" },
  { gkh: "râth", en: "when", nl: ["wanneer", "toen"], label: "time" },
];

/**
 * Dutch puts the verb at the END of a subordinate clause ("omdat hij sterk
 * is"), where the clause parser expects SVO. Rather than teach the parser a
 * second word order, the clause is normalised back to SVO before parsing:
 * a clause-final verb moves to second position. Deliberately narrow — it fires
 * only when the last token really is a verb the lexicon knows, and only after
 * the straightforward parse has already been tried.
 */
function unwindDutchVerbFinal(words: string[]): string[] | null {
  if (words.length < 3) return null;
  const last = words[words.length - 1];
  const entry = resolveContentWord(last, "nl");
  const isVerb = entry && (entry.pos === "verb" || entry.pos === "particle/verb");
  const isCopula = ["is", "zijn", "was", "waren", "ben", "bent"].includes(last);
  if (!isVerb && !isCopula) return null;

  // The verb belongs after the SUBJECT, not after the first token — "de koning
  // sterk is" has to become "de koning is sterk", never "de is koning sterk".
  const rest = words.slice(0, -1);
  const np = consumeNaturalNP(rest, "nl");
  if ("reason" in np) return null;
  const subjectLength = rest.length - np.rest.length;
  if (subjectLength === 0) return null;
  return [...rest.slice(0, subjectLength), last, ...rest.slice(subjectLength)];
}

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

/**
 * Phase 2 unknown-word handling (brief §2): a sentence is never silently
 * dropped just because one word is unrecognized. When the real grammatical
 * parser fails specifically because of an unknown word, this builds a
 * word-for-word best-effort translation instead: every recognized word is
 * looked up directly (no grammatical transformation — tense/plural/word
 * order are NOT reliably applied in this fallback, which is why `partial`
 * is always set so the caller can say so honestly), and every unrecognized
 * word is kept, bracketed, in its original surface form so nothing
 * disappears. This is a deliberate, documented simplification — see
 * DESIGN_DECISIONS.md D14 — not a second grammar engine.
 */
const ARTICLES: Record<Lang, string[]> = { en: ["the", "a", "an"], nl: ["de", "het", "een"] };

function partialEnNlToGkh(
  words: string[],
  lang: Lang
): {
  outputWords: string[];
  unknown: string[];
  coined: { source: string; gkh: string; version: string }[];
  compounds: { source: string; gkh: string; parts: string[] }[];
} {
  const unknown: string[] = [];
  const coined: { source: string; gkh: string; version: string }[] = [];
  const compounds: { source: string; gkh: string; parts: string[] }[] = [];
  // Reserve forms across the sentence so two unknown words in one sentence can
  // never be handed the same spelling.
  const taken = new Set<string>();
  const outputWords = words
    .filter((w) => !ARTICLES[lang].includes(w.toLowerCase())) // GKH has no articles (no change to definiteness marking); dropping them here matches real translation rather than falsely flagging them as unknown vocabulary.
    .map((w) => {
      // Every lexicon route first: a direct hit, an inflected form ("zie" for
      // "zien"), or a compound built from parts the lexicon already has
      // ("nachtwacht" = nacht + wacht). Coining is tier 4, and tier 4 only.
      const lemma = lemmatize(w, lang);
      if (lemma) {
        if (lemma.kind === "compound" && lemma.parts) {
          compounds.push({ source: w, gkh: lemma.gkh, parts: lemma.parts.map((p) => p.entry.gkh) });
        }
        return lemma.gkh;
      }
      unknown.push(w);
      // No lexicon entry means no part of speech is known either. "unknown" is
      // used deliberately and consistently: it is part of the seed, so the same
      // word always coins the same form, and a later lemmatiser that CAN supply
      // a real part of speech will coin a different (better) one — which is a
      // version boundary, not a silent change. See ROADMAP.md tier 4.
      // Seed on the guessed dictionary form, never the surface form, so "huis"
      // and "huizen" are given the same word rather than two unrelated ones.
      const lemmaGuess = guessLemma(w, lang);
      const result = coin({ lemma: lemmaGuess, pos: "unknown", lang }, { taken });
      taken.add(result.gkh);
      // Remember it, so the same word read back the other way is no longer a
      // mystery spelling for the rest of this session.
      recordCoinage({ gkh: result.gkh, lemma: lemmaGuess, lang });
      coined.push({ source: w, gkh: result.gkh, version: result.version });
      return result.gkh;
    });
  return { outputWords, unknown, coined, compounds };
}

function partialGkhToNatural(
  words: string[],
  lang: Lang
): { outputWords: string[]; unknown: string[]; reversed: { gkh: string; gloss: string }[] } {
  const unknown: string[] = [];
  const reversed: { gkh: string; gloss: string }[] = [];
  const outputWords = words.map((w) => {
    const a = analyzeWord(w);
    const entry = a.entry ?? findByGkh(w);
    // Lexicon glosses carry alternatives ("wanneer / toen"); a translation
    // should pick one, not print the dictionary entry at the reader.
    if (entry) return (lang === "en" ? entry.en : entry.nl).split("/")[0].trim();
    // Not in the lexicon — but it may be a word the coiner issued, in which
    // case the index knows what it was coined for.
    const coined = glossCoinage(w, lang);
    if (coined) {
      reversed.push({ gkh: w, gloss: coined });
      return coined;
    }
    unknown.push(w);
    return `⟦${w}⟧`;
  });
  return { outputWords, unknown, reversed };
}

function splitOnTopLevelWord(words: string[], markers: Record<string, string>): { left: string[]; marker: string; right: string[] } | null {
  for (let i = 1; i < words.length - 1; i++) {
    if (markers[words[i]]) return { left: words.slice(0, i), marker: markers[words[i]], right: words.slice(i + 1) };
  }
  return null;
}

function respondToEnNlFailure(
  f: ParseFailure | GkhParseFailure,
  input: string,
  direction: Direction,
  explanation: TranslationExplanation,
  words: string[],
  lang: Lang
): TranslationResult {
  if (f.reason === "unknown-word") {
    const { outputWords, unknown, coined, compounds } = partialEnNlToGkh(words, lang);
    explanation.transformations.push(
      `Grammatical parsing failed because of unrecognized word(s): ${unknown.map((u) => `"${u}"`).join(", ")}. ` +
        `Falling back to a word-for-word gloss for the words that ARE known; tense, plural and word order are not reliably applied in this fallback (see DESIGN_DECISIONS.md D14).`
    );
    if (compounds.length) {
      explanation.transformations.push(
        `Built as compounds from roots the lexicon already has (grammar.json nouns.compounding, modifier + head): ` +
          `${compounds.map((c) => `${c.source} -> ${c.parts.join(" + ")} = ${c.gkh}`).join(", ")}.`
      );
    }
    if (coined.length) {
      explanation.transformations.push(
        `No lexicon entry exists for ${coined.map((c) => `"${c.source}"`).join(", ")}, so coiner_${COINER_VERSION} supplied a form: ` +
          `${coined.map((c) => `${c.source} -> ${c.gkh}`).join(", ")}. These are generated, not hand-authored, and are marked as such.`
      );
    }
    const outputText = outputWords.join(" ");
    // Every word now has a Gurzûl Khar form, coined or curated, so the native
    // script and the pronunciation can be produced for the whole sentence
    // rather than only for the part the lexicon happened to cover.
    let nativeScript: string | undefined;
    let pronunciation: string | undefined;
    try {
      if (outputText.trim()) {
        nativeScript = latinToNative(outputText).nativeSvg;
        pronunciation = ipaOfSentence(outputText);
      }
    } catch {
      /* best effort only */
    }
    return {
      ok: true,
      input,
      direction,
      output: outputText,
      nativeScript,
      pronunciation,
      explanation,
      partial: true,
      unknownWords: unknown,
      coinedWords: coined.length ? coined : undefined,
    };
  }
  return { ok: false, input, direction, ...describeFailure(f), explanation };
}

function toGkh(input: string, lang: Lang): TranslationResult {
  const direction: Direction = lang === "en" ? "en-gkh" : "nl-gkh";
  const { isQuestion, words } = tokenizeSentence(input);
  if (words.length === 0) {
    return { ok: false, input, direction, ...describeFailure({ ok: false, reason: "empty-input" }), explanation: emptyExplanation() };
  }
  const explanation = emptyExplanation();
  explanation.words = explainEnNl(words, lang);

  const coordMap = lang === "en" ? EN_COORD : NL_COORD;

  // First subordinator that actually splits the sentence in two.
  let subordinator: Subordinator | undefined;
  let subordinatorIdx = -1;
  for (const candidate of SUBORDINATORS) {
    const surfaces = lang === "en" ? [candidate.en] : candidate.nl;
    for (const surface of surfaces) {
      const idx = words.indexOf(surface);
      if (idx <= 0 || idx >= words.length - 1) continue;
      // "that" / "dat" is both a complementiser and a relativiser. After a NOUN
      // it introduces a relative clause ("the king that has strength") and the
      // noun phrase parser handles it; after a verb it is the complementiser
      // ("I know that you will go"). What precedes it decides.
      if (surface === "that" || surface === "dat") {
        const preceding = resolveContentWord(words[idx - 1], lang);
        if (preceding && preceding.pos === "noun") continue;
      }
      if (subordinatorIdx === -1 || idx < subordinatorIdx) {
        subordinatorIdx = idx;
        subordinator = candidate;
      }
    }
  }

  let gkhTokens: string[];
  if (subordinator && subordinatorIdx > 0) {
    const mainWords = words.slice(0, subordinatorIdx);
    const subWords = words.slice(subordinatorIdx + 1);
    const main = parseNaturalClause(mainWords, lang, false);
    if (isFailure(main)) return respondToEnNlFailure(main, input, direction, explanation, words, lang);

    let sub = parseNaturalClause(subWords, lang, isQuestion);
    if (isFailure(sub) && lang === "nl") {
      const svo = unwindDutchVerbFinal(subWords);
      if (svo) {
        const retry = parseNaturalClause(svo, lang, isQuestion);
        if (!isFailure(retry)) {
          explanation.transformations.push(
            `Dutch subordinate clauses are verb-final ("${subWords.join(" ")}"); normalised to SVO before parsing.`
          );
          sub = retry;
        }
      }
    }
    if (isFailure(sub)) return respondToEnNlFailure(sub, input, direction, explanation, words, lang);

    explanation.transformations.push(
      `Parsed as a complex sentence: main clause + ${subordinator.label} subordinator "${subordinator.gkh}" + subordinate clause.`
    );
    gkhTokens = [...renderClauseGkh(main), subordinator.gkh, ...renderClauseGkh(sub)];
  } else {
    const split = splitOnTopLevelWord(words, coordMap);
    if (split) {
      const left = parseNaturalClause(split.left, lang, false);
      const right = parseNaturalClause(split.right, lang, isQuestion);
      if (isFailure(left)) return respondToEnNlFailure(left, input, direction, explanation, words, lang);
      if (isFailure(right)) return respondToEnNlFailure(right, input, direction, explanation, words, lang);
      explanation.transformations.push(`Parsed as two coordinated clauses joined by "${split.marker}".`);
      gkhTokens = [...renderClauseGkh(left), split.marker, ...renderClauseGkh(right)];
    } else {
      const npOnly = consumeNaturalNP(words, lang);
      if (!("reason" in npOnly) && npOnly.rest.length === 0) {
        explanation.transformations.push("Parsed as a standalone noun phrase (no verb) — e.g. a possessive or plural noun phrase.");
        gkhTokens = renderNP(npOnly.np);
      } else {
        const clause = parseNaturalClause(words, lang, isQuestion);
        if (isFailure(clause)) return respondToEnNlFailure(clause, input, direction, explanation, words, lang);
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

function respondToGkhFailure(
  f: ParseFailure | GkhParseFailure,
  input: string,
  direction: Direction,
  explanation: TranslationExplanation,
  words: string[],
  lang: Lang
): TranslationResult {
  if (f.reason === "unknown-word") {
    const { outputWords, unknown, reversed } = partialGkhToNatural(words, lang);
    explanation.transformations.push(
      `Grammatical parsing failed because of unrecognized Gurzûl Khar word(s): ${unknown.map((u) => `"${u}"`).join(", ")}. ` +
        `Falling back to a word-for-word gloss for the words that ARE known; natural EN/NL grammar (word order, conjugation) is not reliably applied in this fallback (see DESIGN_DECISIONS.md D14).`
    );
    if (reversed.length) {
      explanation.transformations.push(
        `Recognised as previously coined rather than hand-authored: ${reversed.map((r) => `${r.gkh} = "${r.gloss}"`).join(", ")}. ` +
          `The coiner's hash cannot be inverted, so these were read out of the coinage index (data/lexicon/coinages.json).`
      );
    }
    const outputText = outputWords.join(" ");
    return {
      ok: true,
      input,
      direction,
      output: outputText,
      pronunciation: ipaOfSentence(input),
      explanation,
      partial: true,
      unknownWords: unknown,
      coinedWords: reversed.length ? reversed.map((r) => ({ source: r.gloss, gkh: r.gkh, version: COINER_VERSION })) : undefined,
    };
  }
  return { ok: false, input, direction, ...describeFailure(f), explanation };
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
  const subordinatorHit = SUBORDINATORS.map((c) => ({ c, idx: words.indexOf(c.gkh) })).filter((h) => h.idx > 0).sort((a, b) => a.idx - b.idx)[0];
  const sûIdx = subordinatorHit ? subordinatorHit.idx : -1;

  let sentence: string;
  if (sûIdx > 0 && sûIdx < words.length - 1) {
    const main = parseGkhClause(words.slice(0, sûIdx));
    const sub = parseGkhClause(words.slice(sûIdx + 1));
    if (isFailure(main)) return respondToGkhFailure(main, input, direction, explanation, words, lang);
    if (isFailure(sub)) return respondToGkhFailure(sub, input, direction, explanation, words, lang);
    explanation.transformations.push("Parsed as a complex sentence: main clause + complementiser + subordinate clause.");
    const complementiser = lang === "en" ? subordinatorHit!.c.en : subordinatorHit!.c.nl[0];
    const mainText = decapitalizeClause(renderClauseNatural(main as Clause, lang));
    // Dutch subordinate clauses are verb-final; English ones are not.
    const subText = decapitalizeClause(renderClauseNatural(sub as Clause, lang, { verbFinal: true }));
    sentence = `${mainText} ${complementiser} ${subText}.`;
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  } else {
    const markerIdx = words.findIndex((w, i) => i > 0 && i < words.length - 1 && coordToNatural[w] !== undefined);
    if (markerIdx !== -1) {
      const leftWords = words.slice(0, markerIdx);
      const rightWords = words.slice(markerIdx + 1);
      const leftClause = parseGkhClause(leftWords);
      const rightClause = parseGkhClause(rightWords);
      if (isFailure(leftClause)) return respondToGkhFailure(leftClause, input, direction, explanation, words, lang);
      if (isFailure(rightClause)) return respondToGkhFailure(rightClause, input, direction, explanation, words, lang);
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
        if (isFailure(clause)) return respondToGkhFailure(clause, input, direction, explanation, words, lang);
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
