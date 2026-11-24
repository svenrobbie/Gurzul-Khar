# GURZÛL KHAR — Project Checklist / Backlog

Status legend: `[x]` done and tested · `[~]` partially implemented, see note · `[ ]` not started

This mirrors the "Definition of a completed initial release" checklist in the Master Development Specification v2.0 §20. It is updated as work lands — it is not aspirational marketing copy.

> **Note on history:** an earlier version of this file claimed the engine, tests, and website were complete when no code for any of them existed in the repository yet — only the `/data` JSON files and this documentation. That was inaccurate. This revision reflects what has actually been implemented and verified (typechecked, tested, built, and manually exercised in a browser) as of this pass.

## Phase 3 of the roadmap — the Rust port — complete

`crates/gkh-core` is the TypeScript engine ported module by module, bottom up, each layer finished before the next needed it. 24 tests, zero dependencies, zero warnings under `-D warnings`.

Done:

- Phonology (`phonemes`, `syllabify`, `phonotactics`, `stress`, `ipa`), the coiner, closed-class and lexicon lookup, inflection, the lemmatiser, and the full translator — analyzer, both renderers, both parsers.
- `scripts/buildRustData.mjs` generates the Rust data *and* the Rust test fixtures from the same `data/` and `tests/fixtures/` the TypeScript suite reads, so neither engine can drift without failing a build. See DESIGN_DECISIONS.md D18/D19.
- `.github/workflows/rust.yml` regenerates the data, fails if the checked-in copy is stale, and runs `cargo test --workspace`.
- One real divergence found and fixed: the Rust translator was falling back word-for-word on grammar it does not support, where the TypeScript one refuses. D20.

Deliberately not ported:

- The Khargûl glyph generator and the coinage index. The site renders glyphs client-side in TypeScript and will keep doing so; the coinage index is a runtime record, not engine behaviour.

## Phase 4 of the roadmap — the website on WebAssembly — complete

Done:

- `crates/gkh-wasm` — a `wasm-bindgen` wrapper exporting `translate`, `word_ipa`, `sentence_ipa`, `lemmatize`, `coin`, `lemma_guess`, `analyze_sentence`, `check_word`, `tokenize`, `transliterate`, `normalise_seed_for` and `coin_batch` across a hand-rolled JSON boundary, so the core keeps its zero-dependency guarantee. 16 boundary tests.
- `website/src/engine/` — the site talks to one `Engine` interface and parses the crate's JSON in exactly one place. There is no fallback and no stub: a missing artifact is a build failure that says how to fix it, and a load failure at runtime is a page that says so rather than a site quietly running something else.
- CI builds the crate, tests it, compiles it to WebAssembly and builds the site against that artifact, failing if no `.wasm` reaches the bundle. The deploy workflow does the same before publishing.
- `coin_batch`, because collision resolution depends on what has already been issued — coining a list one call at a time, each with an empty reserved set, would give a different and wrong answer. The golden file and the coinage index are both built through it.

## The TypeScript engine is deleted

`engine/` is gone, along with the Vitest suite and the TypeScript build scripts. There is now one implementation of the language.

What moved, and why:

- **Reverse coining was ported, not dropped.** It was the one piece of engine behaviour the port had left behind, so deleting TypeScript would have quietly removed a feature. `data/lexicon/coinages.json` is compiled into the crate and the session half is thread-local, which keeps the core free of locks and of file I/O. Two tests pin both halves of the promise: a coined word reads back, and a spelling nobody has coined still comes back bracketed.
- **Rendering stayed in the website.** `glyphGenerator` draws syllable blocks as SVG; the engine decides what the blocks are. Geometry is drawing, not language. `engine/data.ts` was only typed JSON loading, so it is `website/src/data.ts` now.
- **The tooling runs on the engine.** `npm run validate`, the fixture and golden generators, the ear-test sample, the coinage index, the IPA sync and the dev-server review tool all load the same WebAssembly build. No script keeps its own opinion about what a legal word is.
- **Tests the Rust suite did not already cover were ported rather than dropped:** lexicon IPA against the engine, both halves of the frozen-snapshot bargain, the phoneme round trip over every entry, unique ids, determinism across repeated runs, and the learning-content checks (a node script, since the course is not compiled into the crate).
- `fixtures/` is no longer under `tests/`, which no longer exists.

Deliberately not ported:

- `scripts/buildCoinerWeights.ts`. `coiner_v1`'s weights are frozen, so a button that recomputes them from a lexicon that has since grown is a hazard rather than a tool. A `coiner_v2` would need a fresh measurement anyway, and `data/phonology/coinerWeights_v1.json` records what the original was measured over.
- `coinerFrozen.test.ts`'s SHA-256 digest of the weights file. The golden file already fails if the weights move, so the digest was a second alarm for the same event.
- `mergedView.ts` and `wordGenerator.ts`. The first was only ever used by its own test; the second is replaced by the frozen coiner, so a suggested word is now the spelling the translator was already producing for that meaning rather than a third, unrelated invention.

Known gap: `website/devConflicts.ts` (homograph and duplicate-gloss detection for the proposal flow) lost its automated test with the Vitest suite. It is dev-server-only bookkeeping over the lexicon files rather than language behaviour, but it is untested now and that is worth saying.

## Phase 2 of the roadmap — finish the language — complete

Reordered on Sven's call: the Rust port now waits until the language is finished, so it is a mechanical translation rather than a rewrite that has to keep absorbing new grammar.

Done:

- **Lemmatiser** (`engine/morphology/lemmatizer.ts`). Tier 2 (inflection) and tier 3 (compounding) of the coverage plan. `nachtwacht` is built from `nacht` + `wacht` using the language's own head-final compounding rule, not coined whole. Dutch morphology now covers open/closed syllable spelling (`draagt` → `dragen`, `loopt` → `lopen`), final devoicing (`huizen` → `huis`, `wolven` → `wolf`), consonant doubling (`mannen` → `man`), the irregular stems (`ga` → `gaan`) and irregular 3sg present (`heeft` → `hebben`). `guessLemma()` makes `huis` and `huizen` coin the SAME word when neither is in the lexicon.
- **Grammar coverage**, all four gaps, in all four directions:
  - Postpositional phrases. `ük pâku durang dûl` = "I go to the tower". Seven new postpositions.
  - Modals. Analytic: the modal takes the tense, the main verb stays a bare root — `tû dâku pâk` = "you must go".
  - Imperatives. Bare root, no subject, and Dutch comes back as the stem (`Ga!`) not the infinitive.
  - Relative clauses. `shak kha khar dûnu` — exactly grammar.json's own documented example, reproduced by the engine. English "that" is read as a relativiser after a noun and a complementiser after a verb.
  - Subordinate clauses generalised from one hardcoded complementiser to a table (`sû`, `ghâsha`, `ith`, `râth`), with Dutch verb-final order handled in both directions.
- **Reverse coining** (`engine/lexicon/coinageIndex.ts`). A pre-computed index of 175 common coinages plus runtime recording, so `han` reads back as `draak`. The hash is not invertible, so this is a record, not an inversion — a word nobody has ever coined still comes back bracketed, which is stated rather than hidden.
- **9 new closed-class words**, hand-picked rather than coined: the coiner produced `thûmlaresh` for "from", which is fine for a noun and absurd for a postposition. Short forms in the style of `ta`/`na`/`ag`/`vo`/`ith`/`sû`. Every one is marked `provenance: hand-picked-2026-11-23` and can be renamed freely.
- **A hole in the freeze, closed.** Coined words were being checked against the LIVE lexicon, so adding those 9 words silently rewrote coinages and broke the golden file. The coiner now reads a frozen snapshot (`data/lexicon/coinerReserved_v1.json`), so the dictionary can grow without moving a single coined word; `tests/coinerReserved.test.ts` enforces the other half, stopping a new hand-authored word from taking a spelling the coiner already issued. It caught 7 collisions in the 9 words above immediately.

Bugs found and fixed along the way:

- Any Dutch noun ending in `-en` or `-s` was silently pluralised: `toren` was read as the plural of `tor`. A word is only plural if its singular is what the lexicon matched.
- The word-for-word fallback coined new words for inflected forms of words the lexicon already had, inventing synonyms for existing vocabulary.
- `is` was being coined rather than resolved to the copula `ash`.
- Lexicon glosses with alternatives were printed whole ("wanneer / toen") instead of one being chosen.

Known and deliberate limits:

- Object-gap relatives ("the sword that he carries") are refused, not guessed. Only the documented subject-gap pattern exists.
- Compounds resolve in the word-for-word fallback, not in the full clause parser, so a sentence containing one is translated word-for-word rather than with full grammar. Fixing that means breaking a module cycle between the lemmatiser and the clause parser.
- Dutch `van` is deliberately NOT treated as a postposition: in Dutch it is overwhelmingly the possessive, and that reading has to win.
- The runtime half of the coinage index lives in memory and dies with the process. Making it permanent is a job for the proposal flow, not for a translator that must stay pure to compile to WASM.
- 6 spellings in the lexicon are homographs. Three are legitimate zero-derivation (`khar` noun/verb/adjective); three are accidental and genuinely ambiguous: `morith` (grave / morning), `sharak` (book / to love), `shelath` (bright / shield), `haskith` (to hate / afraid). Reported, not auto-fixed — they are Sven's to resolve.

## Phase 1 of the Rust roadmap — complete

Plan: `ROADMAP.md` (living version linked at its top). Phase 1 locks the language's behaviour behind shared fixtures so the Rust port in phase 2 is verifiable rather than a leap of faith.

Done:

- `tests/fixtures/translation.json` — the regression cases now live as language-neutral data. `tests/regression.test.ts` reads them instead of hardcoding them, so the Rust port can assert the same 28 cases.
- `tests/fixtures/phonotactics.json` + `tests/phonotacticFixture.test.ts` — 35 pinned words, valid and invalid. The validator now emits a stable `code` per violation (`PhonotacticCode`) alongside the human-readable `rule`; codes are the contract, wording is not.
- `engine/lexicon/coiner.ts` — `coiner_v1`, the deterministic fallback that gives every input word a form. Integer-only (u64 via BigInt, mirroring Rust's wrapping u64), byte-level FNV-1a over UTF-8, one independent sub-seed per decision so tuning one table cannot reshuffle the others, normalised seed (`lemma|pos|lang`), deterministic collision resolution via an attempt counter.
- `data/phonology/coinerWeights_v1.json` — onset/nucleus/coda frequencies **measured from the 292 hand-authored entries** by `scripts/buildCoinerWeights.ts`, rather than drawn uniformly from the declared inventory. This was the fix that made coined words sound like the language: `phonology.json` declares ê/î/ô, which the lexicon never uses once, and uniform draws produced things like `thaadûl` and `lubaghzhîl`.
- Two euphony rules the lexicon obeys without ever stating them, now enforced on coinages: no doubled letter (0 of 292 entries have one) and no run of three consonant phonemes (also 0 of 292).
- `tests/fixtures/coiner_v1.golden.json` — 10,549 pinned coinages, asserted on every run. Regenerating it twice produces a byte-identical file.
- `scripts/` + npm scripts: `fixtures:phonotactics`, `coiner:weights`, `coiner:golden`, `coiner:sample`.

Measured, worth knowing:

- Coining 150,000 words produces 150,000 distinct forms with no exhaustion (worst case 32 of 64 attempts). The 1–2-syllable space alone saturates around 50,000, so the syllable floor rises with the attempt counter — common words stay short, the long tail gets longer, which is how natural languages behave anyway.
- 13% of first candidates are rejected by the rules; the rest of the retries are collision avoidance.
- The coiner is *stricter* than the hand-authored lexicon: it will never produce `gurz`, `zhâ` or `shelgh`, all of which exist as real entries and violate the documented rules.

Gate passed, 2026-11-23: the `COINER_SAMPLE.md` ear test was reviewed and accepted.

- **`coiner_v1` is FROZEN.** `tests/coinerFrozen.test.ts` pins the SHA-256 of `coinerWeights_v1.json`; the golden file pins the algorithm. A change to either now means `coiner_v2` — a new file, a new version tag, a new golden fixture — never an edit to v1. Do not update the digest to make a test pass.
- The coiner is wired into the translator. A sentence containing a word the lexicon does not have now comes back fully in Gurzûl Khar, with native script and IPA for the whole sentence rather than only the part the lexicon covered. `TranslationSuccess.coinedWords` reports exactly which words were generated rather than looked up, so the UI can mark them and never present them as established vocabulary.
- Coining is strictly last resort. `resolveContentWord()` in `naturalLanguage.ts` applies the clause parser's own inflection heuristics (plural, EN/NL verb forms, comparative/superlative) before anything reaches the coiner, so an inflected form of a known word is never given an invented synonym — "Ik zie het ruimteschip" coins for `ruimteschip` only, and "Jij ziet de draak" for `draak` only. It also adds Dutch 2nd/3rd-person `-t` stripping, which the clause parser itself does not do.
- The new behaviour is pinned in `tests/fixtures/translation.json` (29 cases), so the Rust port must reproduce the exact coined output, not merely "something".

Still not done:

- *Superseded in phase 2 by `engine/lexicon/coinageIndex.ts`.* The reverse direction cannot be coined: the hash is not invertible, so an unrecognised Gurzûl Khar word stays bracketed when translating to EN/NL. Resolving that needs a persisted coinage index, which is one of ROADMAP.md's open questions.
- ~~No lemmatiser.~~ *Superseded — built in phase 2, see above.* Tiers 2 and 3 of the plan (derivation from known roots, Dutch compound splitting) do not exist, so `huis` and `huizen` resolve through the inflection heuristics above but a genuinely unknown compound like `nachtwacht` is coined whole rather than built from `nacht` + `wacht`.
- Coined words are not surfaced in the website UI yet — the engine reports them, no page renders the distinction.
- ~~Nothing Rust exists yet.~~ *Superseded — `crates/gkh-core` is complete, see phase 3 above.*

## Phase 2 — audit-and-improve pass (status by brief section)
`Phase2.md` itself was not present in the repository when this pass began (confirmed by a recursive search); this pass worked from the detailed task description supplied directly for it, which was presented as a faithful translation of that brief — see DESIGN_DECISIONS.md D17.

1. **Audit, fix as you go** — done. Read every engine/website module; confirmed the translator genuinely tokenizes/parses/transforms grammar rather than swapping words; fixed what was found (unknown-word silent-failure, the v0.1 alphabet geometry, the inlined/forked phonotactic checker) rather than only reporting it.
2. **Unknown-word & lexicon-management system** — done, with one explicit scope limit. Partial translation (never silently drops a word) is real and tested. The official/proposed/deprecated/unknown lifecycle is real: `data/lexicon/proposals.json` + `engine/lexicon/{conflicts,wordGenerator,mergedView}.ts` + `website/devApi.ts` (dev-server-only HTTP API) + `/propose` and `/admin` pages, verified end to end in a browser (propose → conflict shown → force-submit → appears on /admin → approve → really lands in `lexicon.json`). Scope limit: the "backend" only exists inside `npm run dev`; the static production build has no server, so Propose/Admin/the Dictionary's lifecycle toggle detect that and say so rather than pretending to work. See DESIGN_DECISIONS.md D13/D14.
3. **Alphabet redesign (Thornscript)** — done. `glyphGenerator.ts` rewritten to the spine+thorn construction rules exactly as `alphabet.json` v0.2.0 documents them; full chart (consonants/vowels/diphthongs/numerals/punctuation) regenerated; a sample sentence from the regression suite renders live on the Alphabet page. No font file (OTF/TTF) — unchanged limitation from v0.1, still SVG-only.
4. **Translation engine improvements** — partial. Confirmed (not assumed) the engine does real grammatical parsing. Added the unknown-word partial-translation fallback and tests for both well-formed and ill-formed/unsupported input (a relative-clause sentence fails honestly). Did NOT add new grammatical coverage (e.g. relative clauses, conditionals) this pass — that remains the same documented, deliberately-scoped subset as v0.1 (see `crates/gkh-core/src/translator/`); extending it further is a larger follow-up than this pass's budget covered.
5. **Dictionary expansion** — done to 292 entries (up from 133), not yet 500-1000. See the Language section below for the breakdown by domain.
6. **Pronunciation / offline TTS groundwork** — partial, honestly. IPA/stress documentation already existed in phonology.json (extended, not duplicated). A genuinely offline, non-neural, rule-based Web Audio prototype was built and verified working (`website/src/lib/audioSynth.ts`) as a second, clearly "experimental" option alongside the existing SpeechSynthesis aid — see D16. It does not model coarticulation or claim to be real speech.
7. **Website/UX** — done. Translate/dictionary/propose-a-word/alphabet/grammar/pronunciation/examples/learning are all reachable from the top nav (or, for the single-owner admin tool, from the About page) and visually consistent with the existing dark theme. Checked (not assumed) mobile width (375px) on the Propose page in a browser: no horizontal scroll, nav wraps, two-column grids collapse to one column.
8. **Offline requirement** — verified for translation/dictionary/grammar/writing-system rendering/local learning: none of them call any network API. The new word-proposal flow is the one feature that needs a *local* server process (`npm run dev`'s own Vite server) to persist anything — that server is still 100% local/offline, never a cloud call, which is exactly the constraint given. Language data is still plain JSON (`data/lexicon/proposals.json` included) — nothing broke the "exportable in an open format" property.
9. **Tests** — done. 51 tests now (up from 38): known vocabulary, unknown vocabulary/partial translation, lexicon-proposal validation/conflict-detection, grammatical inflections, complex sentences, NL→GKH, GKH→NL (and GKH→EN), determinism, and the new Phase 2 features specifically (`tests/lexiconLifecycle.test.ts`). The dev-only HTTP layer itself (`website/devApi.ts`) was verified manually end to end in a browser rather than with an HTTP-level automated test, since it is Vite-dev-server-only middleware — this is a real gap, noted honestly rather than claimed as tested.

## Language
- [x] Phonological inventory for v0.1 — `data/phonology/phonology.json`. Extended this pass with two phonemes (`v`, `th`) that the lexicon already used but the inventory never declared, and an orthographic variant note (`ü` = written variant of `û`) — see DESIGN_DECISIONS.md §D6/D7.
- [x] Vowel/consonant system documented with IPA, place/manner/voicing, positional restrictions
- [x] Pronunciation conventions (stress rules, intonation) documented
- [x] Word stress rules documented, and now actually implemented (`crates/gkh-core/src/phonology/stress.rs`, tested)
- [x] Original writing system designed (Khargûl script, procedural abugida) — `data/orthography/alphabet.json`
- [x] Alphabet chart — rendered live on the Alphabet page from the procedural glyph generator (every consonant/vowel/diphthong)
- [x] Digitally renderable characters — inline SVG generator (`website/src/script/glyphGenerator.ts`, drawing the syllable blocks the engine returns), implemented and tested
- [x] Latin transcription system (single source of truth in phonology data)
- [x] Transliteration in both directions (Latin ↔ native-script block data) — `crates/gkh-core` (blocks) + `website/src/script/transliteration.ts` (SVG), round-trip tested against every lexicon entry
- [~] Full grammatical specification — core noun/verb/adjective/pronoun/syntax system documented (`data/morphology/grammar.json`) and now actually implemented in the engine for a defined subset; does not cover every edge case (e.g. all irregular forms, dialectal variation, relative clauses, conditionals are documented but not yet implemented in the translator)
- [~] Core vocabulary — 292 entries after the Phase 2 expansion (up from the 133-entry v0.1 seed); target is 500–1000 (see Design Decisions open questions)
- [x] Word derivation rules (agent noun `-dûm`, adverb `-ith`, place noun `-ûl`) documented and now implemented in the morphological analyzer
- [x] Example sentences (in `tests/regression.test.ts` and the Grammar page)
- [~] Example conversations — a few short exchanges implicit in regression tests and Learn Level 1; not a full dialogue library
- [x] Fictional language history — `lore/history/history.md`, rendered on the Lore page

## Language engine
- [x] English → Gurzûl Khar — implemented (`crates/gkh-core/src/translator/`), tested
- [x] Dutch → Gurzûl Khar — implemented, tested
- [x] Gurzûl Khar → English — implemented, tested
- [x] Gurzûl Khar → Dutch — implemented, tested
- [x] Morphological analysis (tokenizer + affix stripping) — `crates/gkh-core/src/morphology/`, tested
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
- [x] GitHub Pages deployment workflow (`.github/workflows/deploy.yml`) and CI workflow (`.github/workflows/ci.yml`) — pushed and running; the site is live. `.github/workflows/rust.yml` added for the Rust workspace and the wasm build.

## Quality
- [x] Automated tests — the Rust suite (`cargo test --workspace`): phonotactics, the 10,549-case coiner golden file, IPA, lemmatisation, a 52-case translation suite covering all four directions, lexicon integrity, and the WebAssembly boundary. Plus `npm run validate` for data schema and learning content. The former 51 Vitest tests (up from 38) across phonotactic validation, dictionary schema, determinism, Latin↔native round-trip, a 28-case translation regression suite covering all 4 directions (including unknown-word partial translation and an unsupported-pattern case), and Phase 2's new lexicon-lifecycle suite (conflict detection, word-generator validity/determinism, merged-view filtering). All passing. The Vitest suite itself is gone with the TypeScript engine; what it asserted is either covered by the Rust tests or ported to `npm run validate` — see "The TypeScript engine is deleted" above for the two things that were not.
- [x] Linguistic data validation — `npm run validate` (`tests/validateData.ts`), wired into CI
- [x] Consistent terminology (single JSON source of truth; engine and website both read `/data` directly, verified by code review — no duplicated grammar/lexicon copies)
- [x] Documentation (this file, DESIGN_DECISIONS.md, ROADMAP.md, README.md, docs/CONTRIBUTING.md, docs/LICENSE_NOTES.md)
- [x] Installation instructions (README.md)
- [x] Contribution guidelines (docs/CONTRIBUTING.md)
- [x] Versioned language data (`"version"` field in every `/data` JSON file)

## Explicitly NOT done yet (do not claim otherwise)
- No OpenType/TrueType font file for the Khargûl script — native script is generated inline SVG only.
- No recorded human pronunciation audio — SpeechSynthesis is used as a clearly labelled synthetic aid only.
- No Android app. That is phase 5 (UniFFI + Kotlin/Compose) and no code for it exists.
- Lexicon is a 292-entry set after Phase 2 (up from the 133-word v0.1 seed), not the full 500–1000 target.
- Learning course Levels 2–5 are documented in `/data`/the spec but not built into interactive lessons; shown as an honest roadmap.
- The translator supports a deliberately scoped grammatical subset (see `crates/gkh-core/src/translator/`); it does not handle relative clauses, conditionals, or arbitrary free-form sentences — unsupported input fails with an explanation rather than guessing. Phase 2 added unknown-*vocabulary* partial translation (see above), which is a different thing from unsupported *grammar* — a relative clause with every word known still fails honestly, by test.
- English/Dutch surface generation (when translating out of Gurzûl Khar) uses a documented, non-exhaustive set of conjugation rules for the interface languages themselves (not the conlang) — see DESIGN_DECISIONS.md §D11.
- A handful of pre-existing lexicon entries violate the documented phonotactic cluster/position rules (e.g. "zhâ" begins with zh, which the rules say never happens word-initially). These are detected and reported by `npm run validate` / `tests/phonotactics.test.ts` but intentionally not auto-corrected, since fixing them would mean inventing new spellings for existing, cross-referenced words. No *new* Phase 2 entry adds to this list (checked by re-running the tests during drafting, not just at the end).
- The Phase 2 word-proposal/review "backend" (`website/devApi.ts`) only exists inside the Vite dev server (`npm run dev`). It is not deployed anywhere, has no authentication (by design — see DESIGN_DECISIONS.md D14), and does not run in the static production/GitHub Pages build at all. `/propose`, `/admin`, and the Dictionary's lifecycle toggle all detect this and say so explicitly rather than presenting a dead UI.
- An approved proposal lands in `lexicon.json` on disk immediately, but the Translator/Dictionary pages only pick it up for certain once the dev server (or its page) is reloaded — see DESIGN_DECISIONS.md D14 for exactly what "immediately available" does and doesn't mean here.
- No OpenType/TrueType font file for Thornscript either (same limitation as v0.1's script had) — still generated inline SVG only.
- The rule-based Web Audio pronunciation prototype (`website/src/lib/audioSynth.ts`) does not model coarticulation, assimilation, or real formant structure; it is a deliberately simple, labelled-experimental proof that an offline non-neural approach is *possible*, not a finished pronunciation engine.
- `website/devApi.ts`'s HTTP endpoints were verified manually end to end in a browser (propose → conflict → force → approve → really in lexicon.json; reject; deprecate), not by an automated HTTP-level test — a real test gap, noted rather than hidden.
