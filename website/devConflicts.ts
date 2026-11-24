// Conflict detection for the local word-proposal flow. Surfaces collisions to
// the caller rather than silently rejecting or silently allowing them.
//
// This is bookkeeping about the lexicon files, not a rule about Gurzûl Khar:
// it compares spellings and glosses, and takes the official entries as an
// argument rather than importing them, so the dev server always checks against
// what is on disk right now. Whether a word is legal at all is the engine's
// question, answered by its phonotactic checker.
import type { LexiconEntry, ProposalEntry } from "./src/data";

export interface Conflict {
  kind: "homograph-official" | "homograph-proposed" | "same-gloss-different-spelling";
  message: string;
  withId: string;
  withGkh: string;
}

type AnyEntry = LexiconEntry | ProposalEntry;

function glossVariants(field: string): string[] {
  return field
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Checks a candidate word (not yet in any file) against the official entries
 * passed in and the currently-proposed (not yet reviewed) vocabulary. `activeProposals`
 * should be every ProposalEntry with status "proposed" — deprecated/rejected
 * entries are retired and intentionally excluded from collision checks.
 */
export function findConflicts(
  candidate: { gkh: string; en: string; nl: string; pos: string },
  officialEntries: LexiconEntry[],
  activeProposals: ProposalEntry[] = []
): Conflict[] {
  const conflicts: Conflict[] = [];
  const gkhLower = candidate.gkh.toLowerCase();
  const candidateEnVariants = glossVariants(candidate.en);

  const check = (entry: AnyEntry, kind: Conflict["kind"]) => {
    if (entry.gkh.toLowerCase() === gkhLower) {
      conflicts.push({
        kind: kind === "same-gloss-different-spelling" ? kind : (entry as any).status ? "homograph-proposed" : "homograph-official",
        message: `"${candidate.gkh}" is already the spelling of ${kind === "homograph-proposed" ? "a proposed" : "an official"} entry meaning "${entry.en}" (${entry.pos}). Homographs are allowed in Gurzûl Khar only when they are documented word-family members of the same root (see DESIGN_DECISIONS.md D9) — review before submitting.`,
        withId: entry.id,
        withGkh: entry.gkh,
      });
    } else if (glossVariants(entry.en).some((v) => candidateEnVariants.includes(v)) && entry.pos === candidate.pos) {
      conflicts.push({
        kind: "same-gloss-different-spelling",
        message: `An entry with the same meaning and part of speech already exists: "${entry.gkh}" = "${entry.en}" (${entry.pos}). Consider whether this is a duplicate rather than a new word.`,
        withId: entry.id,
        withGkh: entry.gkh,
      });
    }
  };

  for (const entry of officialEntries) check(entry, "homograph-official");
  for (const entry of activeProposals) check(entry, "homograph-proposed");

  return conflicts;
}
