// Internal canonical clause representation shared by both translation
// directions, and the GKH-side render/parse functions (the EN/NL-side
// render/parse functions live in naturalLanguage.ts). Keeping one shared
// model is what lets translate() stay deterministic and auditable.
import { grammar, lexicon, type LexiconEntry } from "../data.js";
import { findByGkh } from "./lexiconLookup.js";
import { analyzeWord } from "../morphology/analyzer.js";

/** The lexicon reuses the same gkh surface form across POS (e.g. "khar" is simultaneously the noun "strength", the verb "to be strong" and the adjective "strong"). analyzeWord() returns whichever entry happens to come first in the data file, so any call site that already knows which POS it needs must look it up directly instead. */
function findEntryByPos(gkh: string, pos: string): LexiconEntry | undefined {
  return lexicon.entries.find((e) => e.gkh.toLowerCase() === gkh.toLowerCase() && e.pos === pos);
}

export type Person = "1sg" | "2sg" | "3sg" | "1pl" | "2pl" | "3pl";
export type Tense = "present" | "past" | "future";
export type Degree = "plain" | "comparative" | "superlative";
export type QuestionRole = "subject" | "object" | "adjunct" | undefined;
export type QuestionWord = "who" | "what" | "where" | "when" | "why" | "how";

export interface NP {
  kind: "pronoun" | "noun";
  person?: Person; // for pronouns
  root: string; // GKH root (for nouns) — unused for pronouns
  entry?: LexiconEntry;
  plural?: boolean;
  adjective?: { root: string; entry?: LexiconEntry; degree: Degree; intensified?: boolean };
  possessive?: { type: "suffix"; person: Person } | { type: "postposition"; possessor: NP };
}

export interface VerbPhrase {
  root: string; // "ash" for copula
  tense: Tense;
  isCopula?: boolean;
  entry?: LexiconEntry;
}

export interface Clause {
  negate: boolean;
  questionYesNo: boolean;
  questionWord?: QuestionWord;
  questionRole?: QuestionRole;
  subject?: NP;
  verb: VerbPhrase;
  object?: NP; // ignored when verb.isCopula and predicateAdjective is set
  predicateAdjective?: { root: string; entry?: LexiconEntry; degree: Degree; intensified?: boolean };
  adverb?: { root: string; entry?: LexiconEntry };
}

export interface CoordinatedClauses {
  clauses: Clause[];
  conjunctions: ("ag" | "vo" | "nâth")[]; // between clause i and i+1
}

export interface ComplexSentence {
  main: Clause;
  complementiser: "sû" | "ghâsha" | "ith";
  subordinate: Clause;
}

export const PLURAL_SUFFIX = (grammar.nouns.pluralSuffix as string).replace(/^-/, "");
export const TENSE_SUFFIX: Record<Tense, string> = Object.fromEntries(
  Object.entries(grammar.verbs.tenseSuffixes as Record<string, string>).map(([t, s]) => [t, (s as string).replace(/^-/, "")])
) as Record<Tense, string>;
export const POSSESSIVE_SUFFIX: Record<Person, string> = Object.fromEntries(
  Object.entries(grammar.pronouns.possessiveSuffixes as Record<string, string>).map(([p, s]) => [p, (s as string).replace(/^-/, "")])
) as Record<Person, string>;
export const SUBJECT_FORM: Record<Person, string> = grammar.pronouns.subjectForms;
export const INTERROGATIVE: Record<QuestionWord, string> = grammar.pronouns.interrogatives;
export const COMPARATIVE_MARKER: string = grammar.adjectives.comparative.marker;
export const SUPERLATIVE_SUFFIX: string = (grammar.adjectives.superlative.marker as string).match(/-(\S+)/)![1];
export const INTENSIFIER: string = grammar.adjectives.intensification.marker;
export const NEGATION_PARTICLE: string = grammar.verbs.negation.particle;
export const QUESTION_PARTICLE: string = "ma";

export function pluralOf(root: string): string {
  // grammar.json nouns.pluralRule: roots ending in -k take the epenthetic allomorph "-akûk"
  // instead of bare "-ûk" (e.g. rûk -> rûkakûk), to avoid a geminate cluster.
  if (root.endsWith("k")) return root + "ak" + PLURAL_SUFFIX;
  return root + PLURAL_SUFFIX;
}

/** Renders a noun phrase to its GKH surface tokens (array, caller joins with spaces). */
export function renderNP(np: NP): string[] {
  const tokens: string[] = [];
  let base = np.kind === "pronoun" ? SUBJECT_FORM[np.person!] : np.plural ? pluralOf(np.root) : np.root;
  if (np.possessive?.type === "suffix") {
    base = base + POSSESSIVE_SUFFIX[np.possessive.person];
  }
  tokens.push(base);
  if (np.adjective) {
    if (np.adjective.intensified) tokens.push(INTENSIFIER);
    if (np.adjective.degree !== "plain") tokens.push(COMPARATIVE_MARKER);
    tokens.push(np.adjective.degree === "superlative" ? np.adjective.root + SUPERLATIVE_SUFFIX : np.adjective.root);
  }
  if (np.possessive?.type === "postposition") {
    tokens.push("ta");
    tokens.push(...renderNP(np.possessive.possessor));
  }
  return tokens;
}

export function renderVerb(v: VerbPhrase): string {
  if (v.isCopula) {
    if (v.tense === "present") return "ash";
    if (v.tense === "past") return "ashak";
    return "ashâth";
  }
  return v.root + TENSE_SUFFIX[v.tense];
}

export function renderPredicateAdjective(pa: NonNullable<Clause["predicateAdjective"]>): string[] {
  const tokens: string[] = [];
  if (pa.intensified) tokens.push(INTENSIFIER);
  if (pa.degree !== "plain") tokens.push(COMPARATIVE_MARKER);
  tokens.push(pa.degree === "superlative" ? pa.root + SUPERLATIVE_SUFFIX : pa.root);
  return tokens;
}

/** Renders a single clause to GKH surface tokens, per grammar.json §syntax. */
export function renderClauseGkh(c: Clause): string[] {
  const tokens: string[] = [];
  if (c.questionWord) tokens.push(INTERROGATIVE[c.questionWord]);
  if (c.questionRole !== "subject") {
    if (c.subject) tokens.push(...renderNP(c.subject));
  }
  if (c.negate) tokens.push(NEGATION_PARTICLE);
  tokens.push(renderVerb(c.verb));
  if (c.predicateAdjective) {
    tokens.push(...renderPredicateAdjective(c.predicateAdjective));
  } else if (c.questionRole !== "object" && c.object) {
    tokens.push(...renderNP(c.object));
  }
  if (c.adverb) tokens.push(c.adverb.root);
  if (c.questionYesNo && !c.questionWord) tokens.push(QUESTION_PARTICLE);
  return tokens;
}

export function renderCoordination(cc: CoordinatedClauses): string[] {
  const out: string[] = [];
  cc.clauses.forEach((clause, i) => {
    out.push(...renderClauseGkh(clause));
    if (i < cc.conjunctions.length) out.push(cc.conjunctions[i]);
  });
  return out;
}

export function renderComplex(cx: ComplexSentence): string[] {
  return [...renderClauseGkh(cx.main), cx.complementiser, ...renderClauseGkh(cx.subordinate)];
}

// ---- GKH -> Clause parsing -------------------------------------------------

const GKH_QUESTION_WORDS: Record<string, QuestionWord> = Object.fromEntries(
  Object.entries(INTERROGATIVE).map(([k, v]) => [v, k as QuestionWord])
);

export interface GkhParseFailure {
  ok: false;
  reason: string;
  word?: string;
}

/** Parses a flat GKH token list (already split, no punctuation) into a single Clause. This covers the "clearly-scoped sentence subset" described in the project spec §7.1: declaratives, negatives, yes/no & content questions, possession, plurals, comparative/superlative predicate adjectives. */
export function parseGkhClause(tokens: string[]): Clause | GkhParseFailure {
  let t = [...tokens];
  let questionYesNo = false;
  if (t[t.length - 1] === QUESTION_PARTICLE) {
    questionYesNo = true;
    t = t.slice(0, -1);
  }

  let questionWord: QuestionWord | undefined;
  if (t.length && GKH_QUESTION_WORDS[t[0]]) {
    questionWord = GKH_QUESTION_WORDS[t[0]];
    t = t.slice(1);
  }

  let negate = false;
  const negIdx = t.indexOf(NEGATION_PARTICLE);
  if (negIdx !== -1) {
    negate = true;
    t.splice(negIdx, 1);
  }

  // Determine subject: either the question word itself (role=subject, nothing consumed from t)
  // or the first remaining token parsed as an NP.
  let questionRole: QuestionRole;
  let subject: NP | undefined;
  let rest = t;

  if (questionWord) {
    // Heuristic: if the first remaining token analyzes as a verb, the question word was the subject.
    const firstAnalysis = rest.length ? analyzeWord(rest[0]) : null;
    if (firstAnalysis?.entry?.pos === "verb" || firstAnalysis?.entry?.pos === "particle/verb") {
      questionRole = "subject";
    } else {
      const npResult = consumeNP(rest);
      if ("reason" in npResult) return npResult;
      subject = npResult.np;
      rest = npResult.rest;
    }
  } else {
    const npResult = consumeNP(rest);
    if ("reason" in npResult) return npResult;
    subject = npResult.np;
    rest = npResult.rest;
  }

  if (rest.length === 0) return { ok: false, reason: "unsupported-pattern" };
  const verbSurface = rest[0];
  const verbAnalysis = analyzeWord(verbSurface);
  if (!verbAnalysis.recognized) return { ok: false, reason: "unknown-word", word: verbSurface };
  const isCopula = verbAnalysis.root === "ash";
  const tense: Tense =
    verbAnalysis.affixes.find((a) => a.type === "tense")?.suffix === TENSE_SUFFIX.past
      ? "past"
      : verbAnalysis.affixes.find((a) => a.type === "tense")?.suffix === TENSE_SUFFIX.future
      ? "future"
      : isCopula
      ? verbSurface === "ashak"
        ? "past"
        : verbSurface === "ashâth"
        ? "future"
        : "present"
      : "present";
  rest = rest.slice(1);

  const verb: VerbPhrase = { root: verbAnalysis.root, tense, isCopula, entry: verbAnalysis.entry ?? undefined };

  if (questionWord === undefined && rest.length === 0) {
    return { negate, questionYesNo, questionWord, questionRole, subject, verb };
  }

  // Predicate adjective after copula: [ghâr]? [zan]? ADJ[-gûl]?
  if (isCopula && rest.length > 0) {
    let i = 0;
    let intensified = false;
    let degree: Degree = "plain";
    if (rest[i] === INTENSIFIER) {
      intensified = true;
      i++;
    }
    if (rest[i] === COMPARATIVE_MARKER) {
      degree = "comparative";
      i++;
    }
    if (rest[i]) {
      let root = rest[i];
      if (root.endsWith(SUPERLATIVE_SUFFIX) && degree === "comparative") {
        degree = "superlative";
        root = root.slice(0, -SUPERLATIVE_SUFFIX.length);
      }
      const adjEntry = findEntryByPos(root, "adjective");
      return {
        negate,
        questionYesNo,
        questionWord,
        questionRole,
        subject,
        verb,
        predicateAdjective: { root, entry: adjEntry, degree, intensified },
      };
    }
  }

  let object: NP | undefined;
  if (questionWord && questionRole === undefined && rest.length === 0) {
    // the question word itself fills the object/adjunct gap
    questionRole = "object";
  } else if (rest.length > 0) {
    const objResult = consumeNP(rest);
    if ("reason" in objResult) return objResult;
    object = objResult.np;
    rest = objResult.rest;
  } else if (questionWord) {
    questionRole = questionRole ?? "adjunct";
  }

  return { negate, questionYesNo, questionWord, questionRole, subject, verb, object };
}

const SUBJECT_FORM_REVERSE: Record<string, Person> = Object.fromEntries(
  Object.entries(SUBJECT_FORM).map(([p, f]) => [f, p as Person])
);

export function consumeNP(tokens: string[]): { np: NP; rest: string[] } | GkhParseFailure {
  if (tokens.length === 0) return { ok: false, reason: "unsupported-pattern" };
  const head = tokens[0];
  let rest = tokens.slice(1);

  if (SUBJECT_FORM_REVERSE[head]) {
    let np: NP = { kind: "pronoun", person: SUBJECT_FORM_REVERSE[head], root: head };
    if (rest[0] === "ta") {
      const possResult = consumeNP(rest.slice(1));
      if ("reason" in possResult) return possResult;
      np = { ...np, possessive: { type: "postposition", possessor: possResult.np } };
      rest = possResult.rest;
    }
    return { np, rest };
  }

  const analysis = analyzeWord(head);
  if (!analysis.recognized) return { ok: false, reason: "unknown-word", word: head };

  let np: NP = { kind: "noun", root: analysis.root, entry: analysis.entry ?? undefined };
  const pluralAffix = analysis.affixes.find((a) => a.type === "plural");
  if (pluralAffix) np.plural = true;
  const possAffix = analysis.affixes.find((a) => a.type === "possessive");
  if (possAffix) {
    const person = Object.entries(POSSESSIVE_SUFFIX).find(([, s]) => s === possAffix.suffix)?.[0] as Person | undefined;
    if (person) np.possessive = { type: "suffix", person };
  }

  // Attributive / predicate-internal adjective directly following the noun: [zan]? ADJ[-gûl]?
  let i = 0;
  let intensified = false;
  let degree: Degree = "plain";
  if (rest[i] === INTENSIFIER) {
    intensified = true;
    i++;
  }
  if (rest[i] === COMPARATIVE_MARKER) {
    degree = "comparative";
    i++;
  }
  const candidate = rest[i];
  if (candidate) {
    const candidateBase = candidate.endsWith(SUPERLATIVE_SUFFIX) && degree === "comparative" ? candidate.slice(0, -SUPERLATIVE_SUFFIX.length) : candidate;
    const adjEntry = findEntryByPos(candidateBase, "adjective");
    if (adjEntry) {
      let root = candidate;
      let finalDegree: Degree = degree;
      if (root.endsWith(SUPERLATIVE_SUFFIX) && degree === "comparative") {
        finalDegree = "superlative";
        root = root.slice(0, -SUPERLATIVE_SUFFIX.length);
      }
      np = { ...np, adjective: { root, entry: adjEntry, degree: finalDegree, intensified } };
      rest = rest.slice(i + 1);
    }
  }

  if (rest[0] === "ta") {
    const possResult = consumeNP(rest.slice(1));
    if ("reason" in possResult) return possResult;
    np = { ...np, possessive: { type: "postposition", possessor: possResult.np } };
    rest = possResult.rest;
  }

  return { np, rest };
}

export function gkhOf(entry: LexiconEntry | undefined): string {
  return entry?.gkh ?? "";
}
