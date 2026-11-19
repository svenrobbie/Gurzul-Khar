# Contributing to GURZÛL KHAR

Thank you for your interest in this project. GURZÛL KHAR is an independent, fan-made constructed language and
learning platform — contributions of new vocabulary, grammar refinements, lesson content, or code are welcome.

## Ground rules

1. **`/data` is the single source of truth.** All linguistic facts — phonology, orthography, morphology/grammar,
   lexicon — live in `data/*.json`. Never add a GKH word, affix, or grammar rule only inside `engine/` or
   `website/`; the engine and the website must always read the same data.
2. **No Tolkien Black Speech vocabulary.** Every Gurzûl Khar root and affix must be an original coinage. See
   `DESIGN_DECISIONS.md` §D4.
3. **Phonotactic validity.** Any new word must be tokenizable against `data/phonology/phonology.json` and should
   respect its documented onset/coda cluster and positional restrictions. `npm run validate` checks this and reports
   violations (non-blocking for pre-existing entries, but please don't add new ones).
4. **Document your reasoning.** Significant new grammar rules or phonological extensions should get an entry in
   `DESIGN_DECISIONS.md`, following the existing log's format (decision, rationale, alternatives considered).
5. **Be honest about status.** Don't mark something `[x]` in `BACKLOG.md` unless it's actually implemented and
   tested.

## Adding a lexicon entry

Edit `data/lexicon/lexicon.json` and add an object to `entries` with all required fields: `id`, `gkh`, `ipa`, `pos`,
`en`, `nl`, `domain`. Optional fields: `root` (for word-family members), `notes`.

Run `npm run validate` and `npm test` afterwards — the dictionary schema test and phonotactic report will tell you
if something is missing or invalid.

## Adding or changing grammar

Edit `data/morphology/grammar.json`. If the change affects translation, update or add a regression test case in
`tests/regression.test.ts` so the new behavior is pinned and tested. The Grammar page on the website renders this
file directly — no separate update needed there.

## Code contributions

- `engine/` is plain TypeScript, tested with Vitest (`npm test`).
- `website/` is a Vite + React + TypeScript app (`npm run dev` from the repo root, or `cd website && npm run dev`).
- Run `npm run build` before submitting a change to confirm the whole project still builds.

## Reporting issues

Open an issue on the project's GitHub repository describing the problem. For linguistic inconsistencies, please
point to the specific `/data` file and field in question.
