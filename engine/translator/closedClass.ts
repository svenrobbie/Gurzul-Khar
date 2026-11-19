// Closed-class English/Dutch word data used ONLY to drive the translator's
// pattern matcher. This is NOT Gurzûl Khar grammar data (that all lives in
// /data and is loaded via engine/data.ts) — it is ordinary EN/NL vocabulary
// knowledge needed to parse the two interface languages, so it is not a
// violation of the single-source-of-truth rule for the conlang.
import { grammar } from "../data.js";

export type Person = "1sg" | "2sg" | "3sg" | "1pl" | "2pl" | "3pl";

export const EN_PRONOUNS: Record<string, Person> = {
  i: "1sg",
  you: "2sg",
  he: "3sg",
  she: "3sg",
  it: "3sg",
  we: "1pl",
  they: "3pl",
};

export const NL_PRONOUNS: Record<string, Person> = {
  ik: "1sg",
  jij: "2sg",
  je: "2sg",
  u: "2sg",
  hij: "3sg",
  zij: "3sg",
  ze: "3sg",
  het: "3sg",
  wij: "1pl",
  we: "1pl",
  jullie: "2pl",
};

export const PERSON_TO_GKH_SUBJECT: Record<Person, string> = grammar.pronouns.subjectForms;

export const GKH_SUBJECT_TO_PERSON: Record<string, Person> = Object.fromEntries(
  Object.entries(grammar.pronouns.subjectForms as Record<string, string>).map(([p, form]) => [form, p as Person])
);

export const GKH_SUBJECT_TO_EN: Record<string, string> = {
  [grammar.pronouns.subjectForms["1sg"]]: "I",
  [grammar.pronouns.subjectForms["2sg"]]: "you",
  [grammar.pronouns.subjectForms["3sg"]]: "he",
  [grammar.pronouns.subjectForms["1pl"]]: "we",
  [grammar.pronouns.subjectForms["2pl"]]: "you all",
  [grammar.pronouns.subjectForms["3pl"]]: "they",
};

export const GKH_SUBJECT_TO_NL: Record<string, string> = {
  [grammar.pronouns.subjectForms["1sg"]]: "ik",
  [grammar.pronouns.subjectForms["2sg"]]: "jij",
  [grammar.pronouns.subjectForms["3sg"]]: "hij",
  [grammar.pronouns.subjectForms["1pl"]]: "wij",
  [grammar.pronouns.subjectForms["2pl"]]: "jullie",
  [grammar.pronouns.subjectForms["3pl"]]: "zij",
};

export type QuestionWord = "who" | "what" | "where" | "when" | "why" | "how";

export const EN_QUESTION_WORDS: Record<string, QuestionWord> = {
  who: "who",
  what: "what",
  where: "where",
  when: "when",
  why: "why",
  how: "how",
};

export const NL_QUESTION_WORDS: Record<string, QuestionWord> = {
  wie: "who",
  wat: "what",
  waar: "where",
  wanneer: "when",
  waarom: "why",
  hoe: "how",
};

export const GKH_QUESTION_WORD_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(grammar.pronouns.interrogatives as Record<string, string>).map(([k, v]) => [v, k])
);
export const GKH_QUESTION_WORD_TO_NL: Record<string, string> = Object.fromEntries(
  Object.entries(EN_QUESTION_WORDS).map(([enWord, key]) => {
    const gkh = (grammar.pronouns.interrogatives as Record<string, string>)[key];
    const nlWord = Object.entries(NL_QUESTION_WORDS).find(([, v]) => v === key)?.[0] ?? enWord;
    return [gkh, nlWord];
  })
);

export const EN_NEGATION = new Set(["not", "no"]);
export const NL_NEGATION = new Set(["niet", "geen"]);
export const EN_AUX_DO = new Set(["do", "does", "did"]);
export const EN_FUTURE_AUX = new Set(["will"]);
export const NL_FUTURE_AUX = new Set(["zal", "zullen"]);

/** Small closed set of EN/NL irregular or otherwise non-trivial conjugations for the verbs that occur in the regression suite / lexicon. Documented as a pragmatic, non-exhaustive aid — see DESIGN_DECISIONS.md. */
export const EN_PAST_FORMS: Record<string, string> = {
  go: "went",
  see: "saw",
  have: "had",
  know: "knew",
  give: "gave",
  burn: "burned",
  speak: "spoke",
  eat: "ate",
  drink: "drank",
  love: "loved",
  build: "built",
  see_: "saw",
};

/** A handful of Dutch infinitives (gaan, zien, zijn, ...) are monosyllabic/irregular and do not
 * reduce to a present-tense stem by the regular "strip final -en" rule (e.g. "gaan" -> "ga",
 * not "ga" via -en removal since it doesn't end in -en at all; "zien" -> "zie", not "zi"). This
 * is a small, explicit, documented closed set covering the verbs actually used by this project's
 * translator, not a claim of complete Dutch conjugation. */
export const NL_IRREGULAR_STEM: Record<string, string> = {
  gaan: "ga",
  zien: "zie",
  zijn: "ben",
  slaan: "sla",
  staan: "sta",
  doen: "doe",
};

export const NL_PAST_FORMS: Record<string, string> = {
  gaan: "ging",
  zien: "zag",
  hebben: "had",
  weten: "wist",
  geven: "gaf",
  branden: "brandde",
  spreken: "sprak",
  eten: "at",
  drinken: "dronk",
};
