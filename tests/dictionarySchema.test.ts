import { describe, it, expect } from "vitest";
import { lexicon } from "../engine/data.js";

const REQUIRED_FIELDS = ["id", "gkh", "ipa", "pos", "en", "nl", "domain"] as const;
const VALID_POS = new Set([
  "pronoun",
  "numeral",
  "interjection",
  "particle",
  "particle/verb",
  "determiner",
  "adverb",
  "conjunction",
  "postposition",
  "noun",
  "verb",
  "adjective",
]);

describe("lexicon schema validation", () => {
  it("every entry has all required fields, non-empty", () => {
    const problems: string[] = [];
    for (const entry of lexicon.entries) {
      for (const field of REQUIRED_FIELDS) {
        const value = (entry as any)[field];
        if (value === undefined || value === null || String(value).trim() === "") {
          problems.push(`${entry.id ?? "(no id)"}: missing/empty "${field}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("every entry id is unique", () => {
    const ids = lexicon.entries.map((e) => e.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("every entry's part of speech is from a known, documented set", () => {
    const unknown = lexicon.entries.filter((e) => !VALID_POS.has(e.pos)).map((e) => `${e.id}: "${e.pos}"`);
    expect(unknown).toEqual([]);
  });

  it("every entry's declared root (if any) exists somewhere in the lexicon as a gkh form", () => {
    const gkhForms = new Set(lexicon.entries.map((e) => e.gkh));
    const dangling = lexicon.entries.filter((e) => e.root && !gkhForms.has(e.root)).map((e) => `${e.id}: root "${e.root}" not found`);
    expect(dangling).toEqual([]);
  });
});
