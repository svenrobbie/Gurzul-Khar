// Single read path for "every word the dictionary/learning pages should be
// able to show, tagged with its lifecycle state" (Phase 2 §2). The
// TRANSLATOR deliberately does NOT use this — it only ever translates
// against official vocabulary (lexicon.json), because a "proposed" word is
// by definition not yet approved. Once a review approves a proposal, the
// review tool moves it into lexicon.json for real, so it becomes part of
// the translator's data on the next read — see BACKLOG.md §2 for exactly
// what "immediately available" means in this environment (dev-server only).
import { lexicon, proposals, type LexiconEntry, type ProposalEntry } from "../data.js";

export type VocabEntryView = (LexiconEntry | ProposalEntry) & {
  status: "official" | "proposed" | "deprecated" | "rejected";
};

/** Every official + proposed + deprecated + rejected entry, tagged with its lifecycle state, for display (Dictionary/Learn pages). */
export function mergedVocabulary(): VocabEntryView[] {
  const official: VocabEntryView[] = lexicon.entries.map((e) => ({ ...e, status: "official" as const }));
  const rest: VocabEntryView[] = proposals.proposals.map((p) => ({ ...p, status: p.status }));
  return [...official, ...rest];
}

/** Active (official + proposed) vocabulary a learner might reasonably search for — excludes deprecated/rejected by default. */
export function activeVocabulary(): VocabEntryView[] {
  return mergedVocabulary().filter((e) => e.status === "official" || e.status === "proposed");
}
