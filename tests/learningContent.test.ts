// The course is only worth anything if it teaches the language that actually
// exists. These tests make that structural rather than a matter of care:
//
//   * every word a lesson teaches must be in the lexicon
//   * every example sentence must translate through the real engine to exactly
//     the output the lesson claims
//   * every declared phoneme must have pronunciation help, and vice versa
//
// So a lesson cannot quietly teach a word that was renamed, or a sentence the
// translator stopped producing.
import { describe, it, expect } from "vitest";
import { lexicon, phonology, grammar } from "../engine/data.js";
import { translate, type Direction } from "../engine/translator/index.js";
import course from "../learning/course.json";
import pronunciation from "../learning/pronunciation.json";

interface Example {
  gkh: string;
  en: string;
  direction: Direction;
  source: string;
}
interface Lesson {
  id: string;
  title: string;
  goal: string;
  grammar: string;
  vocabulary: { gkh: string; en: string; nl: string }[];
  examples: Example[];
  drills: { prompt: string; answer: string; kind: string }[];
}

const lessons = (course as { lessons: Lesson[] }).lessons;
const guide = pronunciation as { consonants: Record<string, unknown>; vowels: Record<string, unknown> };

describe("course structure", () => {
  it("has lessons, each with a goal, a grammar point and drills", () => {
    expect(lessons.length).toBeGreaterThan(0);
    for (const lesson of lessons) {
      expect(lesson.goal.length, lesson.id).toBeGreaterThan(0);
      expect(lesson.grammar.length, lesson.id).toBeGreaterThan(0);
      expect(lesson.drills.length, lesson.id).toBeGreaterThan(0);
    }
  });

  it("every lesson id is unique", () => {
    const ids = lessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("course vocabulary is real vocabulary", () => {
  it("every taught word exists in the language data", () => {
    // Most words live in the lexicon, but the interrogatives (kâsh, manu, ...)
    // are part of the pronoun paradigm in grammar.json instead. Both are real
    // vocabulary; only the file differs.
    const forms = new Set(lexicon.entries.map((e) => e.gkh.replace(/-/g, "").toLowerCase()));
    for (const word of Object.values(grammar.pronouns.interrogatives as Record<string, string>)) {
      forms.add(word.toLowerCase());
    }
    const missing: string[] = [];
    for (const lesson of lessons) {
      for (const word of lesson.vocabulary) {
        if (!forms.has(word.gkh.replace(/-/g, "").toLowerCase())) missing.push(`${lesson.id}: "${word.gkh}" (${word.en})`);
      }
    }
    expect(missing, "a lesson teaches a word that is in neither the lexicon nor the grammar data").toEqual([]);
  });

  it("introduces each word once, so review schedules mean something", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const lesson of lessons) {
      for (const word of lesson.vocabulary) {
        const prior = seen.get(word.gkh);
        if (prior) dupes.push(`"${word.gkh}" taught in ${prior} and again in ${lesson.id}`);
        else seen.set(word.gkh, lesson.id);
      }
    }
    expect(dupes).toEqual([]);
  });
});

describe("course examples are what the engine actually produces", () => {
  for (const lesson of lessons) {
    for (const example of lesson.examples) {
      it(`${lesson.id}: "${example.source}" -> ${example.direction}`, () => {
        const result = translate(example.source, example.direction);
        expect(result.ok, `the engine refuses "${example.source}"`).toBe(true);
        if (!result.ok) return;
        const expected = example.direction.endsWith("gkh") ? example.gkh : example.en;
        expect(result.output).toBe(expected);
      });
    }
  }
});

describe("pronunciation guide covers the declared inventory exactly", () => {
  it("every consonant has help, and no help names a consonant that does not exist", () => {
    const declared = new Set(phonology.consonants.map((c) => c.id));
    const covered = new Set(Object.keys(guide.consonants));
    expect([...declared].filter((id) => !covered.has(id)), "declared consonant with no pronunciation help").toEqual([]);
    expect([...covered].filter((id) => !declared.has(id)), "pronunciation help for a consonant that is not declared").toEqual([]);
  });

  it("every vowel and diphthong has help, and no help names one that does not exist", () => {
    const declared = new Set(
      [...phonology.vowels.short, ...phonology.vowels.long, ...phonology.vowels.diphthongs].map((v) => v.id)
    );
    const covered = new Set(Object.keys(guide.vowels));
    expect([...declared].filter((id) => !covered.has(id)), "declared vowel with no pronunciation help").toEqual([]);
    expect([...covered].filter((id) => !declared.has(id)), "pronunciation help for a vowel that is not declared").toEqual([]);
  });
});
