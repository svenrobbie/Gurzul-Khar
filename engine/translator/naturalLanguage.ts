// EN/NL <-> Clause: parses the supported English/Dutch sentence subset into
// the canonical Clause model (clause.ts) and renders a Clause back out to
// English or Dutch. All GKH-side vocabulary/grammar facts still come only
// from engine/data.ts; this file only contains ordinary EN/NL surface
// patterns needed to drive that mapping.
import { findByEnglish, findByDutch, findByGkh } from "./lexiconLookup.js";
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

/**
 * Dutch spells the same stem differently depending on what follows it, so a
 * surface form often cannot be matched against a dictionary entry character for
 * character. These two helpers undo the three regular alternations that matter
 * most, and are used only as a LAST resort inside resolveContentWord(): each
 * returns candidate spellings to look up, never a claim about the language.
 *
 *   closed/open syllable   draag -> dragen,  loop -> lopen,  pak -> pakken
 *   final devoicing        huis  -> huizen,  wolf -> wolven, lees -> lezen
 */
const NL_VOWELS = "aeiou";

/**
 * Dutch 3rd-person singular present forms that are not stem + -t. Used in both
 * directions, so parsing "heeft" and rendering "heeft" cannot disagree.
 */
const NL_PRESENT_3SG_IRREGULAR: Record<string, string> = {
  hebben: "heeft",
  zijn: "is",
  kunnen: "kan",
  mogen: "mag",
  moeten: "moet",
  willen: "wil",
  zullen: "zal",
  weten: "weet",
  doen: "doet",
};

function dutchVerbInfinitives(stem: string): string[] {
  const out = new Set<string>([stem + "en", stem.slice(0, -1) + "en"]);

  // Irregular stems, read back out of the table the renderer already uses, so
  // the two directions cannot disagree: "ga" must find "gaan", "ben" "zijn".
  for (const [infinitive, irregular] of Object.entries(NL_IRREGULAR_STEM)) {
    if (irregular === stem) out.add(infinitive);
  }
  const voiced = stem.replace(/s$/, "z").replace(/f$/, "v");
  if (voiced !== stem) out.add(voiced + "en");

  // Doubled vowel in a closed syllable collapses when the syllable opens:
  // draag + en -> dragen, loop + en -> lopen, lees + en -> lezen.
  // A doubled vowel at the very end collapses too: "gaa" (from "gaat") -> "ga",
  // which the irregular table then turns into "gaan".
  const openCollapsed = stem.replace(/([aeou])\1$/, "$1");
  if (openCollapsed !== stem) {
    out.add(openCollapsed + "en");
    for (const [infinitive, irregular] of Object.entries(NL_IRREGULAR_STEM)) {
      if (irregular === openCollapsed) out.add(infinitive);
    }
  }

  const degeminated = stem.replace(/([aeou])\1([bcdfgklmnprstvz]+)$/, "$1$2");
  if (degeminated !== stem) {
    out.add(degeminated + "en");
    const degeminatedVoiced = degeminated.replace(/s$/, "z").replace(/f$/, "v");
    if (degeminatedVoiced !== degeminated) out.add(degeminatedVoiced + "en");
  }

  // Short vowel in an open syllable doubles its consonant: pak + en -> pakken.
  const last = stem.at(-1) ?? "";
  const beforeLast = stem.at(-2) ?? "";
  if (NL_VOWELS.includes(beforeLast) && last && !NL_VOWELS.includes(last)) out.add(stem + last + "en");

  return [...out];
}

function dutchNounSingulars(plural: string): string[] {
  const out = new Set<string>();
  if (plural.endsWith("en") && plural.length > 4) {
    const stem = plural.slice(0, -2);
    out.add(stem);
    // huizen -> huis, wolven -> wolf: the singular devoices.
    out.add(stem.replace(/z$/, "s").replace(/v$/, "f"));
    // mannen -> man: the doubled consonant was only there to keep the vowel short.
    const undoubled = stem.replace(/([bcdfgklmnprstvz])\1$/, "$1");
    if (undoubled !== stem) out.add(undoubled);
    // dagen -> dag: the vowel was long because the syllable was open.
    const redoubled = stem.replace(/([aeou])([bcdfgklmnprstvz])$/, "$1$1$2");
    if (redoubled !== stem) out.add(redoubled);
  }
  if (plural.endsWith("s") && plural.length > 3) out.add(plural.slice(0, -1));
  return [...out];
}

/**
 * Prepositions in EN/NL become POSTpositions in Gurzûl Khar: "to the tower"
 * is "durang dûl". The gkh column is the lexicon spelling, so renaming one of
 * those entries is a data change, not a code change.
 */
export const ADPOSITIONS: { gkh: string; en: string[]; nl: string[] }[] = [
  { gkh: "dûl", en: ["to", "toward", "towards", "into"], nl: ["naar", "tot"] },
  { gkh: "mâsh", en: ["with"], nl: ["met"] },
  { gkh: "thûl", en: ["in", "inside", "within"], nl: ["in", "binnen"] },
  { gkh: "lan", en: ["from", "out"], nl: ["vanaf", "uit"] }, // "van" is left out deliberately: in Dutch it is overwhelmingly the possessive ("de kracht van de koning"), and the possessive reading has to win.
  { gkh: "et", en: ["at", "by", "beside"], nl: ["bij", "aan"] },
  { gkh: "zâm", en: ["on", "upon", "onto"], nl: ["op"] },
  { gkh: "nûd", en: ["under", "beneath", "below"], nl: ["onder"] },
];

const ADPOSITION_BY_SURFACE: Record<Lang, Record<string, string>> = {
  en: Object.fromEntries(ADPOSITIONS.flatMap((a) => a.en.map((w) => [w, a.gkh]))),
  nl: Object.fromEntries(ADPOSITIONS.flatMap((a) => a.nl.map((w) => [w, a.gkh]))),
};

export const GKH_POSTPOSITIONS = new Set(ADPOSITIONS.map((a) => a.gkh));

/** The EN/NL preposition to use when rendering a Gurzûl Khar postposition back out. */
export function adpositionSurface(gkh: string, lang: Lang): string | null {
  const hit = ADPOSITIONS.find((a) => a.gkh === gkh);
  return hit ? hit[lang][0] : null;
}

/**
 * Modal verbs. The gkh column is a lexicon spelling; the surface lists are the
 * inflected forms a user actually types. "will" is deliberately absent: it is
 * already handled as the future tense auxiliary.
 */
export const MODALS: { gkh: string; en: string[]; nl: string[]; enSurface: string; nlSurface: string }[] = [
  { gkh: "dâk", en: ["must", "shall"], nl: ["moet", "moeten", "moest", "moesten"], enSurface: "must", nlSurface: "moet" },
  { gkh: "mâg", en: ["can", "could", "may", "might"], nl: ["kan", "kunnen", "kun", "kon", "mag", "mogen"], enSurface: "can", nlSurface: "kan" },
];

const MODAL_BY_SURFACE: Record<Lang, Record<string, string>> = {
  en: Object.fromEntries(MODALS.flatMap((m) => m.en.map((w) => [w, m.gkh]))),
  nl: Object.fromEntries(MODALS.flatMap((m) => m.nl.map((w) => [w, m.gkh]))),
};

export const GKH_MODALS = new Set(MODALS.map((m) => m.gkh));

export function modalSurface(gkh: string, lang: Lang): string | null {
  const hit = MODALS.find((m) => m.gkh === gkh);
  return hit ? (lang === "en" ? hit.enSurface : hit.nlSurface) : null;
}

export type Lang = "en" | "nl";

/**
 * Last-resort lexicon resolution for a single surface word, using exactly the
 * same inflection heuristics the clause parser uses above — never a second
 * copy of them (spec §14 / DESIGN_DECISIONS.md D5).
 *
 * The word-for-word fallback in the translator calls this BEFORE handing a
 * word to the coiner, because coining a form for a word the lexicon already
 * knows would invent vocabulary that already exists: "Ik zie het ruimteschip"
 * must coin a word for "ruimteschip" only, not for "zie", which is simply an
 * inflected form of "zien".
 *
 * Returns null only when the lexicon genuinely has nothing for the word.
 */
export function resolveContentWord(word: string, lang: Lang): LexiconEntry | null {
  const direct = lang === "en" ? findByEnglish(word) : findByDutch(word);
  if (direct) return direct;

  // Copula forms. Without this the word-for-word fallback coins a brand-new
  // word for "is", which is both wrong and jarring: the language has "ash".
  const copulaForms = lang === "en" ? ["is", "are", "am", "was", "were", "be", "been"] : ["is", "ben", "bent", "zijn", "was", "waren", "geweest"];
  if (copulaForms.includes(word)) {
    const copula = lang === "en" ? findByEnglish("to be") : findByDutch("zijn");
    if (copula) return copula;
  }

  // Plural / singular.
  const { base } = singularize(word, lang);
  const singular = lang === "en" ? findByEnglish(base) : findByDutch(base);
  if (singular) return singular;
  if (lang === "nl") {
    for (const candidate of dutchNounSingulars(word)) {
      const hit = findByDutch(candidate);
      if (hit) return hit;
    }
  }

  // Verb inflection.
  if (lang === "en") {
    const asVerb = resolveEnglishVerbEntry(word);
    if (asVerb) return asVerb;
    // Irregular 3sg present, read back out of the table the renderer uses:
    // "has" -> "have", "does" -> "do". Without this, "the king who has
    // strength" has no verb and the relative clause cannot be parsed.
    for (const [infinitive, third] of Object.entries(EN_PRESENT_3SG_IRREGULAR)) {
      if (third === word) {
        const entry = findByEnglish(infinitive);
        if (entry) return entry;
      }
    }
    const past = Object.entries(EN_PAST_FORMS).find(([, form]) => form === word);
    if (past) {
      const entry = findByEnglish(past[0]);
      if (entry) return entry;
    }
  } else {
    for (const [infinitive, third] of Object.entries(NL_PRESENT_3SG_IRREGULAR)) {
      if (third === word) {
        const entry = findByDutch(infinitive);
        if (entry) return entry;
      }
    }
    // The clause parser's two candidates ("zien" from "zie" via the second,
    // "lopen" from "loop" via the first), plus 2nd/3rd-person -t stripping, so
    // "ziet" resolves too. Without that last step the fallback would coin a
    // brand-new word for an inflected form of "zien".
    const stems = [word, ...(word.endsWith("t") && word.length > 2 ? [word.slice(0, -1)] : [])];
    const dutchVerb = stems
      .flatMap((stem) => dutchVerbInfinitives(stem).map((infinitive) => findByDutch(infinitive)))
      .find((hit): hit is LexiconEntry => Boolean(hit)) ?? null;
    if (dutchVerb) return dutchVerb;
    const past = Object.entries(NL_PAST_FORMS).find(([, form]) => form === word);
    if (past) {
      const entry = findByDutch(past[0]);
      if (entry) return entry;
    }
  }

  // Comparative / superlative.
  const { base: degreeBase } = detectDegreeFromWord(word, lang);
  if (degreeBase !== word) {
    const adjective = lang === "en" ? findByEnglish(degreeBase) : findByDutch(degreeBase);
    if (adjective) return adjective;
  }

  return null;
}

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
  // The word is only plural if its SINGULAR is what the lexicon matched.
  // "toren" ends in -en, but stripping that gives "tor", which is not a word —
  // the entry matched the full form, so the noun is singular. Without this the
  // translator silently pluralises any noun that happens to end in -en or -s.
  const baseEntry = base === word ? null : lang === "en" ? findByEnglish(base) : findByDutch(base);
  const entry = baseEntry ?? (lang === "en" ? findByEnglish(word) : findByDutch(word));
  if (!entry) return { ok: false, reason: "unknown-word", word };
  return { kind: "noun", root: entry.root ?? entry.gkh, entry, plural: baseEntry && plural ? true : undefined };
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

  // Subject-gap relative clause: "[head] who [verb] [object]".
  // English "that" is handled as a relativiser only here, after a head noun —
  // as a clause-level subordinator it is the complementiser, and index.ts tells
  // the two apart by what precedes the word.
  const relativisers = lang === "en" ? ["who", "which", "that"] : ["die"];
  if (rest.length >= 2 && relativisers.includes(rest[0])) {
    // Dutch relative clauses are verb-final ("die kracht heeft"), English ones
    // verb-first ("who has strength"), so look in the right place for the verb.
    const relVerbSurface = lang === "nl" ? rest[rest.length - 1] : rest[1];
    const relVerbEntry = resolveContentWord(relVerbSurface, lang);
    if (relVerbEntry && (relVerbEntry.pos === "verb" || relVerbEntry.pos === "particle/verb")) {
      const afterVerb = lang === "nl" ? rest.slice(1, -1) : rest.slice(2);
      let relObject: NP | undefined;
      let remaining = afterVerb;
      if (afterVerb.length > 0) {
        const objResult = consumeNaturalNP(afterVerb, lang);
        if ("reason" in objResult) return objResult;
        relObject = objResult.np;
        remaining = lang === "nl" ? [] : objResult.rest;
        if (lang === "nl" && objResult.rest.length > 0) return { ok: false, reason: "unsupported-pattern" };
      } else if (lang === "nl") {
        remaining = [];
      }
      np = {
        ...np,
        relative: {
          verb: { root: relVerbEntry.root ?? relVerbEntry.gkh, tense: "present", entry: relVerbEntry },
          object: relObject,
        },
      };
      rest = remaining;
    }
  }

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

  // An imperative has no subject at all and opens with a bare verb ("Go!",
  // "Break the shield!"). Checked before the subject is consumed, and only
  // when nothing marks the sentence as a question — "Do you see the land?"
  // also starts with a verb once do-support is stripped.
  const imperativeCandidate =
    !questionWord && !questionYesNo && !isQuestionMark && t.length > 0 && !(lang === "en" ? EN_PRONOUNS : NL_PRONOUNS)[t[0]];
  if (imperativeCandidate) {
    const asVerb = resolveContentWord(t[0], lang);
    if (asVerb && (asVerb.pos === "verb" || asVerb.pos === "particle/verb")) {
      const verbRootImp = asVerb.root ?? asVerb.gkh;
      let rest = t.slice(1);
      let objectImp: NP | undefined;
      let ppImp: Clause["postpositional"];
      const prepAt = rest.findIndex((w) => ADPOSITION_BY_SURFACE[lang][w] !== undefined);
      if (prepAt !== -1) {
        const ppNp = consumeNaturalNP(rest.slice(prepAt + 1), lang);
        if (!("reason" in ppNp) && ppNp.rest.length === 0) {
          ppImp = { np: ppNp.np, postposition: ADPOSITION_BY_SURFACE[lang][rest[prepAt]] };
          rest = rest.slice(0, prepAt);
        }
      }
      if (rest.length > 0) {
        const objResultImp = consumeNaturalNP(rest, lang);
        if ("reason" in objResultImp) return objResultImp;
        if (objResultImp.rest.length > 0) return { ok: false, reason: "unsupported-pattern" };
        objectImp = objResultImp.np;
      }
      return {
        negate,
        questionYesNo: false,
        imperative: true,
        verb: { root: verbRootImp, tense: "present", entry: asVerb },
        object: objectImp,
        postpositional: ppImp,
      };
    }
  }

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

  // A modal takes the tense and hands the main verb through as a bare root.
  let modal: Clause["modal"];
  if (t.length >= 2 && MODAL_BY_SURFACE[lang][t[0]]) {
    const modalGkh = MODAL_BY_SURFACE[lang][t[0]];
    const modalEntry = findByGkh(modalGkh) ?? undefined;
    modal = { root: modalEntry?.root ?? modalGkh, entry: modalEntry };
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
    // Fall through to the one shared resolver rather than a second copy of the
    // inflection rules: English 3sg -s/-es, Dutch 2nd/3rd singular, open/closed
    // syllable spelling and the irregular stems all live in resolveContentWord.
    if (!verbEntry && !pastHit) {
      const resolved = resolveContentWord(infinitiveSurface, lang);
      if (resolved && (resolved.pos === "verb" || resolved.pos === "particle/verb")) verbEntry = resolved;
    }
    if (!verbEntry) return { ok: false, reason: "unknown-word", word: verbWord };
    if (verbEntry.pos !== "verb" && verbEntry.pos !== "particle/verb") return { ok: false, reason: "unsupported-pattern" };
    verbRoot = verbEntry.root ?? verbEntry.gkh;
  }

  const verb: Clause["verb"] = { root: verbRoot, tense, isCopula, entry: verbEntry ?? undefined };

  // A trailing prepositional phrase becomes a postpositional one. Split it off
  // before the object is consumed, so "I go to the tower" has no object at all
  // and "I carry the sword to the tower" keeps "the sword" as its object.
  let postpositional: Clause["postpositional"];
  const prepIdx = t.findIndex((w) => ADPOSITION_BY_SURFACE[lang][w] !== undefined);
  if (prepIdx !== -1) {
    const ppTokens = t.slice(prepIdx + 1);
    if (ppTokens.length === 0) return { ok: false, reason: "unsupported-pattern" };
    const ppNp = consumeNaturalNP(ppTokens, lang);
    if ("reason" in ppNp) return ppNp;
    if (ppNp.rest.length > 0) return { ok: false, reason: "unsupported-pattern" };
    postpositional = { np: ppNp.np, postposition: ADPOSITION_BY_SURFACE[lang][t[prepIdx]] };
    t = t.slice(0, prepIdx);
  }


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
        modal,
        postpositional,
        predicateAdjective: { root: adj.entry.root ?? adj.entry.gkh, entry: adj.entry, degree: adj.degree },
      };
    }
  }

  if (t.length === 0) {
    const clause: Clause = { modal, negate, questionYesNo, questionWord, questionRole, subject, verb, postpositional };
    if (questionWord && questionRole === undefined) clause.questionRole = "adjunct";
    return clause;
  }

  if (t.length === 0) {
    return { modal, negate, questionYesNo, questionWord, questionRole, subject, verb, postpositional };
  }

  const objResult = consumeNaturalNP(t, lang);
  if ("reason" in objResult) return objResult;
  if (objResult.rest.length > 0) return { ok: false, reason: "unsupported-pattern" };

  return { modal, negate, questionYesNo, questionWord, questionRole, subject, verb, object: objResult.np, postpositional };
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

  if (np.relative) {
    const relVerb = (lang === "en" ? np.relative.verb.entry?.en : np.relative.verb.entry?.nl)?.split("/")[0].trim().replace(/^to\s+/, "") ?? np.relative.verb.root;
    const conjugated =
      lang === "en"
        ? EN_PRESENT_3SG_IRREGULAR[relVerb] ?? `${relVerb}s`
        : NL_PRESENT_3SG_IRREGULAR[relVerb] ??
          (relVerb.endsWith("en") ? `${NL_IRREGULAR_STEM[relVerb] ?? relVerb.slice(0, -2)}t` : relVerb);
    const relObject = np.relative.object ? renderNPNatural(np.relative.object, lang, np.relative.object.kind === "noun") : "";
    // English relative clauses are verb-first, Dutch ones verb-final.
    phrase =
      lang === "en"
        ? `${phrase} who ${conjugated}${relObject ? ` ${relObject}` : ""}`
        : `${phrase} die${relObject ? ` ${relObject}` : ""} ${conjugated}`;
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
      // Adding -t to a stem that ends in a single vowel reopens the syllable, so
      // the vowel is written double: ga -> gaat, sta -> staat (never "gat").
      const stemT = /[aeou]$/.test(stem) ? `${stem}${stem.at(-1)}t` : `${stem}t`;
      form = person === "1sg" ? stem : person === "1pl" || person === "2pl" || person === "3pl" ? infinitive : stemT;
    }
    return negate ? `${form} niet` : form;
  }
}

/**
 * `verbFinal` renders a Dutch subordinate clause the way Dutch actually writes
 * one — "omdat de koning sterk is", not "omdat de koning is sterk". It is the
 * mirror image of unwindDutchVerbFinal() on the parsing side; without it the
 * translator understands idiomatic Dutch but cannot produce it.
 */
export function renderClauseNatural(clause: Clause, lang: Lang, options: { verbFinal?: boolean } = {}): string {
  const words: string[] = [];
  const verbFinal = options.verbFinal === true && lang === "nl";
  if (clause.questionWord) words.push(questionWordNatural(clause.questionWord, lang));
  if (clause.questionRole !== "subject" && clause.subject && !clause.imperative) {
    words.push(renderNPNatural(clause.subject, lang, clause.subject.kind === "noun"));
  }
  let verbSurface = renderVerbNatural(clause, lang);
  if (clause.imperative) {
    // English commands use the bare infinitive; Dutch uses the verb STEM, so
    // "gaan" has to come back out as "ga", not "gaan".
    const infinitive =
      (lang === "en" ? clause.verb.entry?.en : clause.verb.entry?.nl)?.split("/")[0].trim().replace(/^to\s+/, "") ?? clause.verb.root;
    verbSurface =
      lang === "en"
        ? infinitive
        : NL_IRREGULAR_STEM[infinitive] ?? (infinitive.endsWith("en") ? infinitive.slice(0, -2) : infinitive);
  }
  if (clause.modal) {
    // The modal carries the tense in Gurzûl Khar too, so the main verb comes
    // back out as a plain infinitive after it.
    const infinitive = (lang === "en" ? clause.verb.entry?.en : clause.verb.entry?.nl)?.split("/")[0].trim().replace(/^to\s+/, "") ?? clause.verb.root;
    verbSurface = `${modalSurface(clause.modal.root, lang) ?? clause.modal.root} ${infinitive}`;
  }
  if (!verbFinal) words.push(verbSurface);
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
  if (clause.postpositional) {
    const preposition = adpositionSurface(clause.postpositional.postposition, lang);
    if (preposition) words.push(preposition, renderNPNatural(clause.postpositional.np, lang, clause.postpositional.np.kind === "noun"));
  }
  if (verbFinal) words.push(verbSurface);
  let sentence = words.join(" ");
  const isQuestion = clause.questionYesNo || !!clause.questionWord;
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  sentence += isQuestion ? "?" : clause.imperative ? "!" : ".";
  return sentence;
}

/** Lowercases the first letter of a rendered clause (for joining mid-sentence after "and"/"that"/etc.) and strips its own trailing punctuation. */
export function decapitalizeClause(sentence: string): string {
  const stripped = sentence.replace(/[.?]$/, "");
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}
