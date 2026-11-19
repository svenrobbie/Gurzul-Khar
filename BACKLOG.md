# GURZÛL KHAR — Project Checklist / Backlog

Status legend: `[x]` done and tested · `[~]` partially implemented, see note · `[ ]` not started

This mirrors the "Definition of a completed initial release" checklist in the Master Development Specification v2.0 §20. It is updated as work lands — it is not aspirational marketing copy.

> **Note on history:** an earlier version of this file claimed the engine, tests, and website were complete when no code for any of them existed in the repository yet — only the `/data` JSON files and this documentation. That was inaccurate. This revision reflects what has actually been implemented and verified (typechecked, tested, built, and manually exercised in a browser) as of this pass.

## Language
- [x] Phonological inventory for v0.1 — `data/phonology/phonology.json`. Extended this pass with two phonemes (`v`, `th`) that the lexicon already used but the inventory never declared, and an orthographic variant note (`ü` = written variant of `û`) — see DESIGN_DECISIONS.md §D6/D7.
- [x] Vowel/consonant system documented with IPA, place/manner/voicing, positional restrictions
- [x] Pronunciation conventions (stress rules, intonation) documented
- [x] Word stress rules documented, and now actually implemented (`engine/phonology/stress.ts`, tested)
- [x] Original writing system designed (Khargûl script, procedural abugida) — `data/orthography/alphabet.json`
- [x] Alphabet chart — rendered live on the Alphabet page from the procedural glyph generator (every consonant/vowel/diphthong)
- [x] Digitally renderable characters — inline SVG generator (`engine/phonology/glyphGenerator.ts`), implemented and tested
- [x] Latin transcription system (single source of truth in phonology data)
- [x] Transliteration in both directions (Latin ↔ native-script block data) — `engine/generator/transliteration.ts`, round-trip tested against every lexicon entry
- [~] Full grammatical specification — core noun/verb/adjective/pronoun/syntax system documented (`data/morphology/grammar.json`) and now actually implemented in the engine for a defined subset; does not cover every edge case (e.g. all irregular forms, dialectal variation, relative clauses, conditionals are documented but not yet implemented in the translator)
- [~] Core vocabulary — 133 seed entries; target is 500–1000 (see Design Decisions open questions)
- [x] Word derivation rules (agent noun `-dûm`, adverb `-ith`, place noun `-ûl`) documented and now implemented in the morphological analyzer
- [x] Example sentences (in `tests/regression.test.ts` and the Grammar page)
- [~] Example conversations — a few short exchanges implicit in regression tests and Learn Level 1; not a full dialogue library
- [x] Fictional language history — `lore/history/history.md`, rendered on the Lore page

## Language engine
- [x] English → Gurzûl Khar — implemented (`engine/translator/`), tested
- [x] Dutch → Gurzûl Khar — implemented, tested
- [x] Gurzûl Khar → English — implemented, tested
- [x] Gurzûl Khar → Dutch — implemented, tested
- [x] Morphological analysis (tokenizer + affix stripping) — `engine/morphology/`, tested
- [x] Grammatical processing (tense, plural, negation, questions, possession, comparative/superlative, coordination, complementiser clauses)
- [x] Deterministic word generation (same input + same data version ⇒ same output — covered by `tests/determinism.test.ts`)
- [~] Unknown word handling — flags unknown roots/words and explains why (never guesses); does not yet synthesize novel derivations for genuinely new concepts
- [x] Translation explanations (word-by-word breakdown, root identification, transformations applied) — surfaced in the Translator page's "Show word-by-word analysis"
- [~] Reverse parsing — works for the supported sentence patterns; does not disambiguate genuinely ambiguous parses with multiple ranked alternatives (only one parse is ever attempted)

## Learning environment
- [~] Alphabet lessons — character chart + one worked lesson in Learn Level 1; stroke-order animation not built
- [~] Pronunciation lessons — IPA chart and stress rules rendered from data; audio uses the browser's SpeechSynthesis API, explicitly labelled as a synthetic approximation, not recorded human audio (spec §8.2)
- [ ] Recorded human audio sound library — not produced (no audio recording capability in this environment)
- [ ] Writing lessons with stroke-order animation
- [x] Grammar lessons (Grammar reference page, rendered from `/data`)
- [x] Vocabulary lessons (Dictionary page: search + domain/POS filters + word-family view)
- [~] Sentence construction exercises — Level 1 only (fill-in-translation exercise, checked live against the real engine)
- [ ] Listening comprehension exercises
- [ ] Reading comprehension exercises beyond Level 1
- [~] Translation exercises — the Translator page doubles as a practice tool; one graded fill-in exercise exists for Level 1
- [~] Interactive quizzes — one real multiple-choice quiz implemented for Level 1; Levels 2–5 not built
- [x] Learning progress tracking (localStorage, no account required, reset control) — `website/src/lib/progress.ts`

## Website
- [x] Homepage — implemented, links to translator/dictionary/learn/lore
- [x] Translator — all four directions, native-script + IPA pronunciation display, copy button, word-by-word analysis toggle, honest error states for unsupported input. Verified live in a browser.
- [x] Dictionary — search EN/NL/GKH, filter by POS and domain, shows native script + IPA + word-family members. Verified live in a browser.
- [x] Grammar reference — rendered entirely from `data/morphology/grammar.json`
- [x] Pronunciation section — IPA chart, stress rules, SpeechSynthesis practice tool (clearly labelled synthetic)
- [x] Alphabet section — full character chart via the glyph generator, Latin transliteration shown alongside, working Latin→native transliteration tool
- [~] Learning environment — Level 1 functional and verified (lesson, vocabulary table, quiz, fill-in exercise, progress tracking); Levels 2–5 shown as an honest "coming soon" roadmap, not fake buttons
- [x] Lore and history — renders `lore/history/history.md`, clearly labelled as fictional
- [x] Language engine documentation page — plain-language explanation of the real tokenize→analyze→transform→generate pipeline
- [x] About and contribution pages — links to `docs/CONTRIBUTING.md` and `docs/LICENSE_NOTES.md` (both written this pass)
- [x] Responsive layout (CSS Grid/flex, mobile nav wraps, no horizontal scroll at phone width) and semantic HTML/keyboard navigation (skip link, visible focus rings)
- [x] GitHub Pages deployment workflow (`.github/workflows/deploy.yml`) and CI workflow (`.github/workflows/ci.yml`) authored this pass — **not yet triggered**: this repository has not been pushed to a GitHub remote from this environment, so no deployment has actually occurred. That push requires the project owner's explicit action.

## Quality
- [x] Automated tests — 38 Vitest tests across phonotactic validation, dictionary schema, determinism, Latin↔native round-trip, and a 24-case translation regression suite covering all 4 directions. All passing.
- [x] Linguistic data validation — `npm run validate` (`tests/validateData.ts`), wired into CI
- [x] Consistent terminology (single JSON source of truth; engine and website both read `/data` directly, verified by code review — no duplicated grammar/lexicon copies)
- [x] Documentation (this file, DESIGN_DECISIONS.md, README.md, docs/CONTRIBUTING.md, docs/LICENSE_NOTES.md)
- [x] Installation instructions (README.md)
- [x] Contribution guidelines (docs/CONTRIBUTING.md)
- [x] Versioned language data (`"version"` field in every `/data` JSON file)

## Explicitly NOT done yet (do not claim otherwise)
- No OpenType/TrueType font file for the Khargûl script — native script is generated inline SVG only.
- No recorded human pronunciation audio — SpeechSynthesis is used as a clearly labelled synthetic aid only.
- No deployed, publicly reachable GitHub Pages URL — the workflow exists but this repository has not been pushed to a GitHub remote from this environment.
- Lexicon is a 133-word seed, not the full 500–1000 target.
- Learning course Levels 2–5 are documented in `/data`/the spec but not built into interactive lessons; shown as an honest roadmap.
- The translator supports a deliberately scoped grammatical subset (see `engine/translator/`); it does not handle relative clauses, conditionals, or arbitrary free-form sentences — unsupported input fails with an explanation rather than guessing.
- English/Dutch surface generation (when translating out of Gurzûl Khar) uses a documented, non-exhaustive set of conjugation rules for the interface languages themselves (not the conlang) — see DESIGN_DECISIONS.md §D11.
- A handful of pre-existing lexicon entries violate the documented phonotactic cluster/position rules (e.g. "zhâ" begins with zh, which the rules say never happens word-initially). These are detected and reported by `npm run validate` / `tests/phonotactics.test.ts` but intentionally not auto-corrected, since fixing them would mean inventing new spellings for existing, cross-referenced words.
