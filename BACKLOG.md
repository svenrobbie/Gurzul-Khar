# GURZÛL KHAR — Project Checklist / Backlog

Status legend: `[x]` done and tested · `[~]` partially implemented, see note · `[ ]` not started

This mirrors the "Definition of a completed initial release" checklist in the Master Development Specification v2.0 §20. It is updated as work lands — it is not aspirational marketing copy.

> **Note on history:** an earlier version of this file claimed the engine, tests, and website were complete when no code for any of them existed in the repository yet — only the `/data` JSON files and this documentation. That was inaccurate. This revision reflects what has actually been implemented and verified (typechecked, tested, built, and manually exercised in a browser) as of this pass.

## Phase 2 — audit-and-improve pass (status by brief section)
`Phase2.md` itself was not present in the repository when this pass began (confirmed by a recursive search); this pass worked from the detailed task description supplied directly for it, which was presented as a faithful translation of that brief — see DESIGN_DECISIONS.md D17.

1. **Audit, fix as you go** — done. Read every engine/website module; confirmed the translator genuinely tokenizes/parses/transforms grammar rather than swapping words; fixed what was found (unknown-word silent-failure, the v0.1 alphabet geometry, the inlined/forked phonotactic checker) rather than only reporting it.
2. **Unknown-word & lexicon-management system** — done, with one explicit scope limit. Partial translation (never silently drops a word) is real and tested. The official/proposed/deprecated/unknown lifecycle is real: `data/lexicon/proposals.json` + `engine/lexicon/{conflicts,wordGenerator,mergedView}.ts` + `website/devApi.ts` (dev-server-only HTTP API) + `/propose` and `/admin` pages, verified end to end in a browser (propose → conflict shown → force-submit → appears on /admin → approve → really lands in `lexicon.json`). Scope limit: the "backend" only exists inside `npm run dev`; the static production build has no server, so Propose/Admin/the Dictionary's lifecycle toggle detect that and say so rather than pretending to work. See DESIGN_DECISIONS.md D13/D14.
3. **Alphabet redesign (Thornscript)** — done. `glyphGenerator.ts` rewritten to the spine+thorn construction rules exactly as `alphabet.json` v0.2.0 documents them; full chart (consonants/vowels/diphthongs/numerals/punctuation) regenerated; a sample sentence from the regression suite renders live on the Alphabet page. No font file (OTF/TTF) — unchanged limitation from v0.1, still SVG-only.
4. **Translation engine improvements** — partial. Confirmed (not assumed) the engine does real grammatical parsing. Added the unknown-word partial-translation fallback and tests for both well-formed and ill-formed/unsupported input (a relative-clause sentence fails honestly). Did NOT add new grammatical coverage (e.g. relative clauses, conditionals) this pass — that remains the same documented, deliberately-scoped subset as v0.1 (see `engine/translator/`); extending it further is a larger follow-up than this pass's budget covered.
5. **Dictionary expansion** — done to 292 entries (up from 133), not yet 500-1000. See the Language section below for the breakdown by domain.
6. **Pronunciation / offline TTS groundwork** — partial, honestly. IPA/stress documentation already existed in phonology.json (extended, not duplicated). A genuinely offline, non-neural, rule-based Web Audio prototype was built and verified working (`website/src/lib/audioSynth.ts`) as a second, clearly "experimental" option alongside the existing SpeechSynthesis aid — see D16. It does not model coarticulation or claim to be real speech.
7. **Website/UX** — done. Translate/dictionary/propose-a-word/alphabet/grammar/pronunciation/examples/learning are all reachable from the top nav (or, for the single-owner admin tool, from the About page) and visually consistent with the existing dark theme. Checked (not assumed) mobile width (375px) on the Propose page in a browser: no horizontal scroll, nav wraps, two-column grids collapse to one column.
8. **Offline requirement** — verified for translation/dictionary/grammar/writing-system rendering/local learning: none of them call any network API. The new word-proposal flow is the one feature that needs a *local* server process (`npm run dev`'s own Vite server) to persist anything — that server is still 100% local/offline, never a cloud call, which is exactly the constraint given. Language data is still plain JSON (`data/lexicon/proposals.json` included) — nothing broke the "exportable in an open format" property.
9. **Tests** — done. 51 tests now (up from 38): known vocabulary, unknown vocabulary/partial translation, lexicon-proposal validation/conflict-detection, grammatical inflections, complex sentences, NL→GKH, GKH→NL (and GKH→EN), determinism, and the new Phase 2 features specifically (`tests/lexiconLifecycle.test.ts`). The dev-only HTTP layer itself (`website/devApi.ts`) was verified manually end to end in a browser rather than with an HTTP-level automated test, since it is Vite-dev-server-only middleware — this is a real gap, noted honestly rather than claimed as tested.

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
- [~] Core vocabulary — 292 entries after the Phase 2 expansion (up from the 133-entry v0.1 seed); target is 500–1000 (see Design Decisions open questions)
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
- [x] Unknown word handling (Phase 2) — never silently drops an unrecognized word. The real grammatical parser still flags and explains an unknown root; when that's the ONLY reason a sentence fails, the engine now falls back to a word-for-word gloss of the recognized words, brackets the unrecognized ones, and marks the result `partial: true` with `unknownWords: [...]` rather than failing the whole sentence. Does not synthesize novel derivations for genuinely new concepts on its own — that's what the Propose-a-word flow is for.
- [x] Translation explanations (word-by-word breakdown, root identification, transformations applied) — surfaced in the Translator page's "Show word-by-word analysis"
- [~] Reverse parsing — works for the supported sentence patterns; does not disambiguate genuinely ambiguous parses with multiple ranked alternatives (only one parse is ever attempted)

## Learning environment
- [~] Alphabet lessons — character chart + one worked lesson in Learn Level 1; stroke-order animation not built
- [~] Pronunciation lessons — IPA chart and stress rules rendered from data; audio uses the browser's SpeechSynthesis API, explicitly labelled as a synthetic approximation, not recorded human audio (spec §8.2). Phase 2 adds a second, separately-labelled "experimental" rule-based Web Audio synthesis prototype (`website/src/lib/audioSynth.ts`) — real and functional (oscillator/filtered-noise per phoneme, driven by place/manner/voicing), but it does not model coarticulation and is not claimed to be authentic speech. See DESIGN_DECISIONS.md D16.
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
- [x] Dictionary — search EN/NL/GKH, filter by POS and domain, shows native script + IPA + word-family members. Phase 2 adds an optional "also show proposed/deprecated vocabulary" toggle that fetches the live lifecycle data from the dev-only API (falls back to official-only, unchanged v0.1 behaviour, when that API isn't reachable). Verified live in a browser.
- [x] Propose a word (Phase 2, `/propose`) — coin a word manually with live client-side phonotactic feedback, or ask the engine to suggest a phonotactically-valid candidate (optionally derived from an existing root + affix). Submits to the local dev-only API; surfaces conflicts with a submit-anyway override, blocks on real phonotactic violations. Verified end to end in a browser (see BACKLOG §2 below).
- [x] Review pending proposals (Phase 2, `/admin`) — approve (moves the word into `lexicon.json` for real) or reject pending proposals, and deprecate an official word. Same dev-only API; explicitly shows an "offline" message rather than a dead UI when that API isn't reachable (e.g. the static production build). Verified end to end in a browser.
- [x] Grammar reference — rendered entirely from `data/morphology/grammar.json`
- [x] Pronunciation section — IPA chart, stress rules, SpeechSynthesis practice tool (clearly labelled synthetic)
- [x] Alphabet section — full character chart (consonants, vowels, diphthongs, numerals 0-9, punctuation marks) via the Phase 2 Thornscript glyph generator, Latin transliteration shown alongside, working Latin→native transliteration tool, and a live-rendered sample sentence from the regression suite
- [~] Learning environment — Level 1 functional and verified (lesson, vocabulary table, quiz, fill-in exercise, progress tracking); Levels 2–5 shown as an honest "coming soon" roadmap, not fake buttons
- [x] Lore and history — renders `lore/history/history.md`, clearly labelled as fictional
- [x] Language engine documentation page — plain-language explanation of the real tokenize→analyze→transform→generate pipeline
- [x] About and contribution pages — links to `docs/CONTRIBUTING.md` and `docs/LICENSE_NOTES.md` (both written this pass)
- [x] Responsive layout (CSS Grid/flex, mobile nav wraps, no horizontal scroll at phone width) and semantic HTML/keyboard navigation (skip link, visible focus rings)
- [x] GitHub Pages deployment workflow (`.github/workflows/deploy.yml`) and CI workflow (`.github/workflows/ci.yml`) authored this pass — **not yet triggered**: this repository has not been pushed to a GitHub remote from this environment, so no deployment has actually occurred. That push requires the project owner's explicit action.

## Quality
- [x] Automated tests — 51 Vitest tests (up from 38) across phonotactic validation, dictionary schema, determinism, Latin↔native round-trip, a 28-case translation regression suite covering all 4 directions (including unknown-word partial translation and an unsupported-pattern case), and Phase 2's new lexicon-lifecycle suite (conflict detection, word-generator validity/determinism, merged-view filtering). All passing.
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
- Lexicon is a 292-entry set after Phase 2 (up from the 133-word v0.1 seed), not the full 500–1000 target.
- Learning course Levels 2–5 are documented in `/data`/the spec but not built into interactive lessons; shown as an honest roadmap.
- The translator supports a deliberately scoped grammatical subset (see `engine/translator/`); it does not handle relative clauses, conditionals, or arbitrary free-form sentences — unsupported input fails with an explanation rather than guessing. Phase 2 added unknown-*vocabulary* partial translation (see above), which is a different thing from unsupported *grammar* — a relative clause with every word known still fails honestly, by test.
- English/Dutch surface generation (when translating out of Gurzûl Khar) uses a documented, non-exhaustive set of conjugation rules for the interface languages themselves (not the conlang) — see DESIGN_DECISIONS.md §D11.
- A handful of pre-existing lexicon entries violate the documented phonotactic cluster/position rules (e.g. "zhâ" begins with zh, which the rules say never happens word-initially). These are detected and reported by `npm run validate` / `tests/phonotactics.test.ts` but intentionally not auto-corrected, since fixing them would mean inventing new spellings for existing, cross-referenced words. No *new* Phase 2 entry adds to this list (checked by re-running the tests during drafting, not just at the end).
- The Phase 2 word-proposal/review "backend" (`website/devApi.ts`) only exists inside the Vite dev server (`npm run dev`). It is not deployed anywhere, has no authentication (by design — see DESIGN_DECISIONS.md D14), and does not run in the static production/GitHub Pages build at all. `/propose`, `/admin`, and the Dictionary's lifecycle toggle all detect this and say so explicitly rather than presenting a dead UI.
- An approved proposal lands in `lexicon.json` on disk immediately, but the Translator/Dictionary pages only pick it up for certain once the dev server (or its page) is reloaded — see DESIGN_DECISIONS.md D14 for exactly what "immediately available" does and doesn't mean here.
- No OpenType/TrueType font file for Thornscript either (same limitation as v0.1's script had) — still generated inline SVG only.
- The rule-based Web Audio pronunciation prototype (`website/src/lib/audioSynth.ts`) does not model coarticulation, assimilation, or real formant structure; it is a deliberately simple, labelled-experimental proof that an offline non-neural approach is *possible*, not a finished pronunciation engine.
- `website/devApi.ts`'s HTTP endpoints were verified manually end to end in a browser (propose → conflict → force → approve → really in lexicon.json; reject; deprecate), not by an automated HTTP-level test — a real test gap, noted rather than hidden.
