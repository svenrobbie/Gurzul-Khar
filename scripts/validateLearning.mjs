// The course is only worth anything if it teaches the language that actually
// exists. This makes that structural rather than a matter of care:
//
//   * every word a lesson teaches must be in the lexicon or the grammar data
//   * every example sentence must translate through the real engine to exactly
//     the output the lesson claims
//   * every declared phoneme must have pronunciation help, and vice versa
//
// So a lesson cannot quietly teach a word that was renamed, or a sentence the
// translator stopped producing. Run by `npm run validate`.
import { engine, readData } from "./lib/engine.mjs";

const gkh = await engine();
const [lexicon, phonology, grammar, course, pronunciation] = await Promise.all([
  readData("data/lexicon/lexicon.json"),
  readData("data/phonology/phonology.json"),
  readData("data/morphology/grammar.json"),
  readData("learning/course.json"),
  readData("learning/pronunciation.json"),
]);

const problems = [];
const lessons = course.lessons ?? [];

if (lessons.length === 0) problems.push("the course has no lessons");
for (const lesson of lessons) {
  if (!lesson.goal?.length) problems.push(`${lesson.id}: no goal`);
  if (!lesson.grammar?.length) problems.push(`${lesson.id}: no grammar point`);
  if (!lesson.drills?.length) problems.push(`${lesson.id}: no drills`);
}

const lessonIds = lessons.map((l) => l.id);
if (new Set(lessonIds).size !== lessonIds.length) problems.push("duplicate lesson id");

// Most taught words live in the lexicon, but the interrogatives are part of
// the pronoun paradigm in grammar.json. Both are real vocabulary.
const forms = new Set(lexicon.entries.map((e) => e.gkh.replace(/-/g, "").toLowerCase()));
for (const word of Object.values(grammar.pronouns?.interrogatives ?? {})) forms.add(String(word).toLowerCase());

const taughtIn = new Map();
for (const lesson of lessons) {
  for (const word of lesson.vocabulary ?? []) {
    if (!forms.has(word.gkh.replace(/-/g, "").toLowerCase())) {
      problems.push(`${lesson.id} teaches "${word.gkh}" (${word.en}), which is in neither the lexicon nor the grammar data`);
    }
    const prior = taughtIn.get(word.gkh);
    // Introduced once, so a review schedule means something.
    if (prior) problems.push(`"${word.gkh}" is taught in ${prior} and again in ${lesson.id}`);
    else taughtIn.set(word.gkh, lesson.id);
  }
}

let examples = 0;
for (const lesson of lessons) {
  for (const example of lesson.examples ?? []) {
    examples++;
    const result = JSON.parse(gkh.translate(example.source, example.direction));
    if (!result.ok) {
      problems.push(`${lesson.id}: the engine refuses "${example.source}" (${result.reason})`);
      continue;
    }
    const expected = example.direction.endsWith("gkh") ? example.gkh : example.en;
    if (result.output !== expected) {
      problems.push(`${lesson.id}: "${example.source}" gives "${result.output}", the lesson claims "${expected}"`);
    }
  }
}

const cover = (declared, covered, what) => {
  for (const id of declared) if (!covered.has(id)) problems.push(`declared ${what} "${id}" has no pronunciation help`);
  for (const id of covered) if (!declared.has(id)) problems.push(`pronunciation help for ${what} "${id}", which is not declared`);
};
cover(new Set(phonology.consonants.map((c) => c.id)), new Set(Object.keys(pronunciation.consonants ?? {})), "consonant");
cover(
  new Set([...phonology.vowels.short, ...phonology.vowels.long, ...phonology.vowels.diphthongs].map((v) => v.id)),
  new Set(Object.keys(pronunciation.vowels ?? {})),
  "vowel",
);

console.log(`Validated ${lessons.length} lessons and ${examples} examples against the engine.`);
if (problems.length) {
  for (const p of problems) console.error(`[LEARNING] ${p}`);
  console.error(`\n${problems.length} learning-content problem(s) — these ARE build-blocking.`);
  process.exit(1);
}
console.log("Learning content: OK.");
