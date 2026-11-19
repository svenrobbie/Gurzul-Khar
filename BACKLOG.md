# GURZÛL KHAR — Project Checklist / Backlog

Status legend: `[x]` done and tested · `[~]` partially implemented, see note · `[ ]` not started

This mirrors the "Definition of a completed initial release" checklist in the Master Development Specification v2.0 §20. It is updated as work lands — it is not aspirational marketing copy.

## Language
- [x] Complete-enough phonological inventory for v0.1 (20 consonants, 5 short + 5 long vowels, 3 diphthongs) — `data/phonology/phonology.json`
- [x] Vowel/consonant system documented with IPA, place/manner/voicing, positional restrictions
- [x] Pronunciation conventions (stress rules, intonation) documented
- [x] Word stress rules documented
- [x] Original writing system designed (Khargûl script, procedural abugida) — `data/orthography/alphabet.json`
- [~] Complete alphabet chart — generated programmatically on the Alphabet page; no static print-ready chart image yet
- [x] Digitally renderable characters — inline SVG generator
- [x] Latin transcription system (built into phonology data, single source of truth)
- [x] Transliteration in both directions (Latin ↔ native script) — implemented in engine
- [~] Full grammatical specification — core noun/verb/adjective/pronoun/syntax system documented (`data/morphology/grammar.json`); does not yet cover every edge case (e.g. all irregular forms, dialectal variation)
- [~] Core vocabulary — 110 seed entries delivered; target is 500-1000 (see Design Decisions open questions)
- [x] Word derivation rules (agent noun `-dûm`, adverb `-ith`, place noun `-ûl`) documented and used in the lexicon
- [x] Example sentences (in engine tests and grammar reference)
- [~] Example conversations — a few short exchanges on the Lore/Learn pages; not a full dialogue library yet
- [x] Fictional language history — `lore/history`

## Language engine
- [x] English → Gurzûl Khar (for the grammar subset currently modelled)
- [x] Dutch → Gurzûl Khar (same subset)
- [x] Gurzûl Khar → English
- [x] Gurzûl Khar → Dutch
- [x] Morphological analysis (tokeniser + affix stripping)
- [x] Grammatical processing (tense, plural, negation, questions, possession)
- [x] Deterministic word generation (same input + same data version ⇒ same output, covered by tests)
- [~] Unknown word handling — flags unknown roots and explains why, does not yet synthesize novel derivations
- [x] Translation explanations (word-by-word breakdown)
- [~] Reverse parsing — works for the supported sentence patterns; does not yet disambiguate genuinely ambiguous parses with multiple ranked alternatives

## Learning environment
- [~] Alphabet lessons — character chart + reading practice; stroke-order animation not yet built
- [~] Pronunciation lessons — IPA chart and rules written; audio uses browser speech synthesis labelled as synthetic, not recorded human audio
- [ ] Recorded human audio sound library — not produced (no audio recording capability in this environment); synthetic TTS is offered as an explicitly labelled interim aid only, per spec §8.2
- [ ] Writing lessons with stroke-order animation
- [x] Grammar lessons (grammar reference page, generated from data)
- [x] Vocabulary lessons (dictionary + domain filters)
- [~] Sentence construction exercises — Level 1 only
- [ ] Listening comprehension exercises
- [ ] Reading comprehension exercises beyond Level 1
- [x] Translation exercises (translator page doubles as a practice tool; dedicated graded exercises only for Level 1)
- [~] Interactive quizzes — Level 1 quiz implemented; Levels 2-5 not yet built
- [x] Learning progress tracking (localStorage, no account required, reset option provided)

## Website
- [x] Homepage
- [x] Translator (all four directions, for the implemented grammar subset)
- [x] Dictionary (search EN/NL/GKH, filter by POS and domain)
- [x] Grammar reference (rendered from `/data`)
- [x] Pronunciation section
- [x] Alphabet section
- [~] Learning environment — Level 1 functional, Levels 2-5 are documented but marked "coming soon" in the UI, honestly
- [x] Lore and history
- [x] Language engine documentation page
- [x] About and contribution pages
- [x] Responsive design
- [x] GitHub Pages deployment workflow (GitHub Actions) — workflow file is in place; an actual deployed URL requires the user to push this repository to GitHub, which has not been done from this environment

## Quality
- [x] Automated tests (engine determinism, phonotactics validation, dictionary schema validation, fixed-sentence regression)
- [x] Linguistic data validation (schema + phonotactic checks run in CI)
- [x] Consistent terminology (single JSON source of truth, see Design Decisions D5)
- [x] Documentation (this file, DESIGN_DECISIONS.md, README.md, per-folder notes)
- [x] Installation instructions (README.md)
- [x] Contribution guidelines (CONTRIBUTING section / page)
- [x] Versioned language data (`"version"` field in every `/data` JSON file)

## Explicitly NOT done yet (do not claim otherwise)
- No OpenType/TrueType font file for the Khargûl script.
- No recorded human pronunciation audio.
- No deployed, publicly reachable GitHub Pages URL (requires a GitHub remote + push, which needs the user's explicit go-ahead since it publishes content).
- Lexicon is a 110-word seed, not the full 500-1000 target.
- Learning course Levels 2-5 are documented in data but not yet built out into interactive lessons.
