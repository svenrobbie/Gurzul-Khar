// EN/NL <-> Clause: parses the supported English/Dutch sentence subset into
// the canonical Clause model (clause.ts) and renders a Clause back out to
// English or Dutch. All GKH-side vocabulary/grammar facts still come only
// from engine/data.ts; this file only contains ordinary EN/NL surface
// patterns needed to drive that mapping.
import { findByEnglish, findByDutch } from "./lexiconLookup.js";
import {
  type Clause,
  type NP,
  type Person,
  type Tense,
  type Degree,
  type QuestionWord,
  pluralOf,
} from "./clause.js";
import {
  EN_PRONOUNS,
  NL_PRONOUNS,
  EN_QUESTION_WORDS,
  NL_QUESTION_WORDS,
  EN_NEGATION,
  NL_NEGATION,
  EN_AUX_DO,
  EN_FUTURE_AUX,
  NL_FUTURE_AUX,
  EN_PAST_FORMS,
  NL_PAST_FORMS,
  NL_IRREGULAR_STEM,
} from "./closedClass.js";
import type { LexiconEntry } from "../data.js";

/** English present-tense 3rd person singular adds -s/-es to the infinitive (sees, goes). Lexicon entries are stored as bare infinitives ("to see"), so verb lookup must also try stripping that ending — this is ordinary EN morphology, not GKH grammar. */
function resolveEnglishVerbEntry(word: string): LexiconEntry | null {
  const candidates = [word, word.replace(/es$/, ""), word.replace(/s$/, "")];
  for (const c of candidates) {
    const entry = findByEnglish(c);
    if (entry && (entry.pos === "verb" || entry.pos === "particle/verb")) return entry;
  }
  return null;
}

export type Lang = "en" | "nl";

const PERSON_TO_EN: Record<Person, string> = { "1sg": "I", "2sg": "you", "3sg": "he", "1pl": "we", "2pl": "you all", "3pl": "they" };
const PERSON_TO_NL: Record<Person, string> = { "1sg": "ik", "2sg": "jij", "3sg": "hij", "1pl": "wij", "2pl": "jullie", "3pl": "zij" };
const POSSESSIVE_PRONOUN_EN: Record<Person, string> = { "1sg": "my", "2sg": "your", "3sg": "his", "1pl": "our", "2pl": "your", "3pl": "their" };
const POSSESSIVE_PRONOUN_NL: Record<Person, string> = { "1sg": "mijn", "2sg": "jouw", "3sg": "zijn", "1pl": "ons", "2pl": "jullie", "3pl": "hun" };
const EN_PRESENT_3SG_IRREGULAR: Record<string, string> = { go: "goes", have: "has", know: "knows", speak: "speaks" };

export interface ParseFailure {
  ok: false;
  reason: "unknown-word" | "unsupported-pattern" | "empty-input";
  word?: string;
}

function stripArticle(tokens: string[], lang: Lang): string[] {
  const articles = lang === "en" ? ["the", "a", "an"] : ["de", "het", "een"];
  return tokens[0] && articles.includes(tokens[0]) ? tokens.slice(1) : tokens;
}

function detectDegreeFromWord(word: string, lang: Lang): { base: string; degree: Degree } {
  if (lang === "en") {
    if (word.startsWith("most ")) return { base: word.slice(5), degree: "superlative" };
    if (word.startsWith("more ")) return { base: word.slice(5), degree: "comparative" };
    if (word.endsWith("est") && word.length > 3) return { base: word.slice(0, -3), degree: "superlative" };
    if (word.endsWith("er") && word.length > 2) return { base: word.slice(0, -2), degree: "comparative" };
  } else {
    if (word.startsWith("meest ")) return { base: word.slice(6), degree: "superlative" };
    if (word.startsWith("meer ")) return { base: word.slice(5), degree: "comparative" };
    if (word.endsWith("st") && word.length > 2) return { base: word.slice(0, -2), degree: "superlative" };
    if (word.endsWith("er") && word.length > 2) return { base: word.slice(0, -2), degree: "comparative" };
  }
  return { base: word, degree: "plain" };
}

function lookupAdjective(word: string, lang: Lang): { entry: LexiconEntry; degree: Degree } | null {
  const { base, degree } = detectDegreeFromWord(word, lang);
  const entry = lang === "en" ? findByEnglish(base) : findByDutch(base);
  if (entry && entry.pos === "adjective") return { entry, degree };
  // fall back: plain form might itself already be the bare adjective
  const plain = lang === "en" ? findByEnglish(word) : findByDutch(word);
  if (plain && plain.pos === "adjective") return { entry: plain, degree: "plain" };
  return null;
}

function singularize(word: string, lang: Lang): { base: string; plural: boolean } {
  if (lang === "en") {
    if (word.endsWith("s") && word.length > 3) return { base: word.slice(0, -1), plural: true };
  } else {
    if (word.endsWith("en") && word.length > 4) return { base: word.slice(0, -2), plural: true };
    if (word.endsWith("s") && word.length > 3) return { base: word.slice(0, -1), plural: true };
  }
  return { base: word, plural: false };
}

function lookupNounOrPronoun(word: string, lang: Lang): NP | ParseFailure {
  const pronounMap = lang === "en" ? EN_PRONOUNS : NL_PRONOUNS;
  if (pronounMap[word]) {
    return { kind: "pronoun", person: pronounMap[word], root: word };
  }
  const { base, plural } = singularize(word, lang);
  const entry = lang === "en" ? findByEnglish(base) ?? findByEnglish(word) : findByDutch(base) ?? findByDutch(word);
  if (!entry) return { ok: false, reason: "unknown-word", word };
  return { kind: "noun", root: entry.root ?? entry.gkh, entry, plural: plural || undefined };
}

/** Consumes a noun phrase (with optional possessive / adjective) from the front of `tokens`. Returns the NP and the remaining tokens. */
export function consumeNaturalNP(tokens: string[], lang: Lang): { np: NP; rest: string[] } | ParseFailure {
  let t = stripArticle(tokens, lang);
  if (t.length === 0) return { ok: false, reason: "unsupported-pattern" };

  // Pronominal possessive: "my strength" / "mijn kracht"
  const possPronounMap = lang === "en" ? POSSESSIVE_PRONOUN_EN : POSSESSIVE_PRONOUN_NL;
  const possEntry = Object.entries(possPronounMap).find(([, w]) => w === t[0]);
  if (possEntry) {
    const possessum = consumeNaturalNP(t.slice(1), lang);
    if ("reason" in possessum) return possessum;
    possessum.np.possessive = { type: "suffix", person: possEntry[0] as Person };
    return possessum;
  }

  // "X's Y" possessive (English) — only triggers when a literal "'s" token appears.
  if (lang === "en") {
    const sIdx = t.findIndex((w) => w === "'s" || w.endsWith("'s"));
    if (sIdx !== -1) {
      const possessorTokens = [...t.slice(0, sIdx), t[sIdx].endsWith("'s") && t[sIdx] !== "'s" ? t[sIdx].slice(0, -2) : ""].filter(Boolean);
      const possessorResult = lookupNounOrPronoun(possessorTokens[possessorTokens.length - 1], lang);
      if ("reason" in possessorResult) return possessorResult;
      const possessum = consumeNaturalNP(t.slice(sIdx + 1), lang);
      if ("reason" in possessum) return possessum;
      possessum.np.possessive = { type: "postposition", possessor: possessorResult };
      return possessum;
    }
  } else {
    const vanIdx = t.indexOf("van");
    if (vanIdx !== -1) {
      const possessumResult = lookupNounOrPronoun(t[vanIdx - 1], lang);
      if ("reason" in possessumResult) return possessumResult;
      const possessorRest = stripArticle(t.slice(vanIdx + 1), lang);
      const possessorResult = lookupNounOrPronoun(possessorRest[0], lang);
      if ("reason" in possessorResult) return possessorResult;
      possessumResult.possessive = { type: "postposition", possessor: possessorResult };
      return { np: possessumResult, rest: possessorRest.slice(1) };
    }
  }

  const headResult = lookupNounOrPronoun(t[0], lang);
  if ("reason" in headResult) return headResult;
  let np = headResult;
  let rest = t.slice(1);

  // Attributive adjective following the noun is not natural EN/NL order (adjectives precede the
  // noun there), so we do not attempt to parse one here; GKH-side NPs with attributive adjectives
  // are only produced by translateToGkh for GKH output, not required as EN/NL input in this subset.
  return { np, rest };
}

export interface NaturalParseResult {
  clause: Clause;
}

/** Parses one EN/NL clause (already split into lowercase tokens, no leading/trailing punctuation) into the canonical Clause model. */
export function parseNaturalClause(tokens: string[], lang: Lang, isQuestionMark: boolean): Clause | ParseFailure {
  let t = [...tokens];
  if (t.length === 0) return { ok: false, reason: "empty-input" };

  const qWordMap = lang === "en" ? EN_QUESTION_WORDS : NL_QUESTION_WORDS;
  let questionWord: QuestionWord | undefined;
  if (qWordMap[t[0]]) {
    questionWord = qWordMap[t[0]];
    t = t.slice(1);
  }

  // Strip do-support / inversion aux used only to mark a yes/no question.
  let questionYesNo = isQuestionMark && !questionWord;
  if (lang === "en" && EN_AUX_DO.has(t[0]) && !questionWord) {
    questionYesNo = true;
    t = t.slice(1);
  } else if (lang === "en" && EN_AUX_DO.has(t[0]) && questionWord) {
    t = t.slice(1);
  }

  let negate = false;
  const negSet = lang === "en" ? EN_NEGATION : NL_NEGATION;
  const negIdx = t.findIndex((w) => negSet.has(w));
  if (negIdx !== -1) {
    negate = true;
    t.splice(negIdx, 1);
  }
  // Remove any remaining do-support auxiliaries used for negation ("do not", "does not", "did not").
  t = t.filter((w) => !(lang === "en" && EN_AUX_DO.has(w)));

  let questionRole: Clause["questionRole"];
  let subject: NP | undefined;

  if (questionWord) {
    // Subject-question: no subject token present before the verb (verb comes first).
    const asVerb = lang === "en" ? resolveEnglishVerbEntry(t[0]) : findByDutch(t[0]);
    const pronounMap = lang === "en" ? EN_PRONOUNS : NL_PRONOUNS;
    if (!pronounMap[t[0]] && asVerb && (asVerb.pos === "verb" || asVerb.pos === "particle/verb")) {
      questionRole = "subject";
    } else {
      const npResult = consumeNaturalNP(t, lang);
      if ("reason" in npResult) return npResult;
      subject = npResult.np;
      t = npResult.rest;
    }
  } else {
    const npResult = consumeNaturalNP(t, lang);
    if ("reason" in npResult) return npResult;
    subject = npResult.np;
    t = npResult.rest;
  }

  if (t.length === 0) return { ok: false, reason: "unsupported-pattern" };

  let tense: Tense = "present";
  const futureAux = lang === "en" ? EN_FUTURE_AUX : NL_FUTURE_AUX;
  if (futureAux.has(t[0])) {
    tense = "future";
    t = t.slice(1);
  }

  const verbWord = t[0];
  t = t.slice(1);
  const copulaWords = lang === "en" ? ["is", "are", "am", "was", "were", "be"] : ["is", "ben", "bent", "zijn", "was", "waren"];
  const isCopula = copulaWords.includes(verbWord);
  let verbEntry: LexiconEntry | null = null;
  let verbRoot = "ash";

  if (isCopula) {
    if (["was", "were", "waren"].includes(verbWord)) tense = "past";
  } else {
    const pastMap = lang === "en" ? EN_PAST_FORMS : NL_PAST_FORMS;
    const pastHit = Object.entries(pastMap).find(([, past]) => past === verbWord);
    let infinitiveSurface = verbWord;
    if (pastHit) {
      tense = "past";
      infinitiveSurface = pastHit[0];
    }
    verbEntry = lang === "en" ? findByEnglish(infinitiveSurface) : findByDutch(infinitiveSurface);
    // English present tense 3sg adds -s/-es (go -> goes); Dutch present tense inflects away
    // from the infinitive for 2nd/3rd person singular (ik zie / jij ziet, from "zien"). Both
    // are regular-pattern fallbacks only — documented simplifications (DESIGN_DECISIONS.md),
    // not a claim of full EN/NL conjugation coverage.
    if (!verbEntry && lang === "en" && !pastHit) {
      verbEntry = resolveEnglishVerbEntry(infinitiveSurface);
    }
    if (!verbEntry && lang === "nl" && !pastHit) {
      verbEntry = findByDutch(infinitiveSurface + "en") ?? findByDutch(infinitiveSurface.slice(0, -1) + "en");
    }
    if (!verbEntry) return { ok: false, reason: "unknown-word", word: verbWord };
    if (verbEntry.pos !== "verb" && verbEntry.pos !== "particle/verb") return { ok: false, reason: "unsupported-pattern" };
    verbRoot = verbEntry.root ?? verbEntry.gkh;
  }

  const verb: Clause["verb"] = { root: verbRoot, tense, isCopula, entry: verbEntry ?? undefined };

  if (isCopula && t.length > 0) {
    const adj = lookupAdjective(t.join(" "), lang) ?? lookupAdjective(t[0], lang);
    if (adj) {
      return {
        negate,
        questionYesNo,
        questionWord,
        questionRole,
        subject,
        verb,
        predicateAdjective: { root: adj.entry.root ?? adj.entry.gkh, entry: adj.entry, degree: adj.degree },
      };
    }
  }

  if (t.length === 0) {
    const clause: Clause = { negate, questionYesNo, questionWord, questionRole, subject, verb };
    if (questionWord && questionRole === undefined) clause.questionRole = "adjunct";
    return clause;
  }

  const objResult = consumeNaturalNP(t, lang);
  if ("reason" in objResult) return objResult;
  if (objResult.rest.length > 0) return { ok: false, reason: "unsupported-pattern" };

  return { negate, questionYesNo, questionWord, questionRole, subject, verb, object: objResult.np };
}

// ---- Clause -> EN/NL rendering --------------------------------------------

function pluralizeGloss(word: string, lang: Lang): string {
  if (lang === "en") {
    if (word.endsWith("s")) return word;
    if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
    return word + "s";
  }
  return word.endsWith("en") ? word : word + "en";
}

export function renderNPNatural(np: NP, lang: Lang, withArticle = true): string {
  if (np.kind === "pronoun") {
    const base = lang === "en" ? PERSON_TO_EN[np.person!] : PERSON_TO_NL[np.person!];
    return base;
  }
  let gloss = lang === "en" ? np.entry?.en ?? np.root : np.entry?.nl ?? np.root;
  gloss = gloss.split("/")[0].trim();
  if (np.plural) gloss = pluralizeGloss(gloss, lang);

  let phrase = withArticle ? `${lang === "en" ? "the" : "de"} ${gloss}` : gloss;

  if (np.adjective) {
    const adjGloss = (lang === "en" ? np.adjective.entry?.en : np.adjective.entry?.nl)?.split("/")[0].trim() ?? np.adjective.root;
    const degreed =
      np.adjective.degree === "superlative"
        ? lang === "en"
          ? `most ${adjGloss}`
          : `meest ${adjGloss}`
        : np.adjective.degree === "comparative"
        ? lang === "en"
          ? `more ${adjGloss}`
          : `meer ${adjGloss}`
        : adjGloss;
    phrase = `${phrase} (${degreed})`;
  }

  if (np.possessive?.type === "suffix") {
    const poss = lang === "en" ? POSSESSIVE_PRONOUN_EN[np.possessive.person] : POSSESSIVE_PRONOUN_NL[np.possessive.person];
    phrase = `${poss} ${gloss}`;
  } else if (np.possessive?.type === "postposition") {
    const possessorPhrase = renderNPNatural(np.possessive.possessor, lang, true);
    phrase = lang === "en" ? `${possessorPhrase}'s ${gloss}` : `${phrase} van ${renderNPNatural(np.possessive.possessor, lang, true)}`;
  }

  return phrase;
}

function questionWordNatural(q: QuestionWord, lang: Lang): string {
  const EN: Record<QuestionWord, string> = { who: "who", what: "what", where: "where", when: "when", why: "why", how: "how" };
  const NL: Record<QuestionWord, string> = { who: "wie", what: "wat", where: "waar", when: "wanneer", why: "waarom", how: "hoe" };
  return lang === "en" ? EN[q] : NL[q];
}

export function renderVerbNatural(clause: Clause, lang: Lang): string {
  const { verb, negate } = clause;
  const person = clause.subject?.person ?? "3sg";
  if (verb.isCopula) {
    if (lang === "en") {
      const base = verb.tense === "present" ? "is" : verb.tense === "past" ? "was" : "will be";
      return negate ? (verb.tense === "future" ? "will not be" : `${base.split(" ")[0]} not`) : base;
    } else {
      const base = verb.tense === "present" ? "is" : verb.tense === "past" ? "was" : "zal zijn";
      return negate ? `${base} niet` : base;
    }
  }
  if (lang === "en") {
    const infinitive = (verb.entry?.en ?? verb.root).split("/")[0].trim().replace(/^to\s+/, "");
    let form: string;
    if (verb.tense === "future") form = `will ${infinitive}`;
    else if (verb.tense === "past") form = EN_PAST_FORMS[infinitive] ?? `${infinitive}ed`;
    else form = person === "3sg" ? EN_PRESENT_3SG_IRREGULAR[infinitive] ?? `${infinitive}s` : infinitive;
    if (!negate) return form;
    if (verb.tense === "future") return `will not ${infinitive}`;
    if (verb.tense === "past") return `did not ${infinitive}`;
    return person === "3sg" ? `does not ${infinitive}` : `do not ${infinitive}`;
  } else {
    const infinitive = (verb.entry?.nl ?? verb.root).split("/")[0].trim();
    let form: string;
    if (verb.tense === "future") form = `zal ${infinitive}`;
    else if (verb.tense === "past") form = NL_PAST_FORMS[infinitive] ?? `${infinitive}de`;
    else {
      const stem = NL_IRREGULAR_STEM[infinitive] ?? (infinitive.endsWith("en") ? infinitive.slice(0, -2) : infinitive);
      form = person === "1sg" ? stem : person === "1pl" || person === "2pl" || person === "3pl" ? infinitive : `${stem}t`;
    }
    return negate ? `${form} niet` : form;
  }
}

export function renderClauseNatural(clause: Clause, lang: Lang): string {
  const words: string[] = [];
  if (clause.questionWord) words.push(questionWordNatural(clause.questionWord, lang));
  if (clause.questionRole !== "subject" && clause.subject) {
    words.push(renderNPNatural(clause.subject, lang, clause.subject.kind === "noun"));
  }
  words.push(renderVerbNatural(clause, lang));
  if (clause.predicateAdjective) {
    const gloss = (lang === "en" ? clause.predicateAdjective.entry?.en : clause.predicateAdjective.entry?.nl)?.split("/")[0].trim() ?? clause.predicateAdjective.root;
    const degreed =
      clause.predicateAdjective.degree === "superlative"
        ? lang === "en"
          ? `the most ${gloss}`
          : `het meest ${gloss}`
        : clause.predicateAdjective.degree === "comparative"
        ? lang === "en"
          ? `more ${gloss}`
          : `meer ${gloss}`
        : gloss;
    words.push(degreed);
  } else if (clause.questionRole !== "object" && clause.object) {
    words.push(renderNPNatural(clause.object, lang, clause.object.kind === "noun"));
  }
  let sentence = words.join(" ");
  const isQuestion = clause.questionYesNo || !!clause.questionWord;
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  sentence += isQuestion ? "?" : ".";
  return sentence;
}

/** Lowercases the first letter of a rendered clause (for joining mid-sentence after "and"/"that"/etc.) and strips its own trailing punctuation. */
export function decapitalizeClause(sentence: string): string {
  const stripped = sentence.replace(/[.?]$/, "");
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}
