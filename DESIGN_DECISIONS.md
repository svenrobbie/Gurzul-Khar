# GURZÛL KHAR — Design Decision Log

This log records original linguistic and architectural decisions made under the autonomy granted in Master Development Specification v2.0 §18, with rationale and alternatives considered. All linguistic facts here must stay in sync with the JSON source of truth in `/data`.

## 2026-11-19 — Project bootstrap

### D1. Word order: SVO
**Decision:** Gurzûl Khar is a Subject-Verb-Object language with postpositional phrases (postposition `ta` "of", relativiser `kha` placed after the noun).
**Alternatives considered:** SOV (more distinct "alien" feel, closer to some real agglutinative languages) was considered but rejected for v0.1 because it increases the complexity of the deterministic translation engine (reordering constituents across three languages) disproportionately to the stylistic gain. SVO keeps clause-level reordering between English/Dutch and Gurzûl Khar minimal (noun-phrase-internal and postpositional reordering only), which keeps the engine deterministic and auditable.
**Revisit condition:** Could be revisited once the engine has a full dependency-parse pipeline rather than slot-based clause templates.

### D2. Analytic verb morphology (no person/number agreement)
**Decision:** Verbs mark tense only (`-u` present, `-ak` past, `-âth` future); person/number is carried solely by the obligatory subject pronoun or noun phrase.
**Rationale:** Removes a combinatorial explosion of conjugation tables (6 persons × 3 tenses × irregular classes) that the initial vocabulary and engine budget cannot responsibly cover with real, tested forms. An isolating verb system is linguistically well attested (e.g. Mandarin, much of creole morphology) and is not a simplification that breaks internal consistency — it is a deliberate typological choice, documented as such rather than hidden.
**Revisit condition:** A future version could add optional agreement suffixes once the lexicon and engine are mature; this would be a non-breaking additive change since pronouns would remain present.

### D3. Writing system generated procedurally from phonological features, not hand-drawn
**Decision:** The Khargûl script's glyphs are derived algorithmically from each phoneme's place/manner/voicing (consonants) and height/backness/length (vowels) as already recorded in `data/phonology/phonology.json`, rather than drawn as independent artwork per letter.
**Rationale:** (1) Guarantees "a clear relationship between characters and sounds" (spec §4.1) by construction instead of by curation. (2) Avoids duplicating the phoneme inventory in a second, hand-maintained table — the spec's data-architecture mandate (§14) to keep one source of truth. (3) Is honestly achievable with real, testable code within this project's resources, whereas commissioning 20+ bespoke glyph illustrations plus a hinted OpenType font is not.
**Known limitation (tracked in backlog):** No installable font file (OTF/TTF) exists yet; native script renders as generated inline SVG. This is sufficient for every website feature that needs native-script display but is not yet usable outside the browser (e.g. in a plain text editor).

### D4. No Tolkien Black Speech vocabulary is reused
**Decision:** Every Gurzûl Khar root, affix and function word in `/data` is an original coinage. Where the spec's own example text uses real Black Speech forms (e.g. in its historical framing), those are treated as inspiration/flavor text only and never copied into the lexicon or grammar as if they were Gurzûl Khar forms.
**Rationale:** Project requirement §2.3 and §19 — the language must be an independent fan creation, not a reproduction of copyrighted material.

### D5. Dictionary/engine/grammar reference share one JSON source of truth
**Decision:** `/data/*.json` are the only place grammatical rules, phonemes, and lexical entries are defined. The engine, the grammar reference page, and the dictionary page all read the same files; none of them hard-codes a duplicate copy of a rule.
**Rationale:** Spec §14 explicitly forbids manually duplicating language rules across website components.

## Open questions for the project owner (non-blocking — current defaults stand until revisited)
- Whether Gurzûl Khar should eventually gain a grammatical case system beyond the current postposition-based strategy.
- Whether regional/historical dialect variants (spec §10.8) should diverge phonologically or only lexically.
- Priority order for expanding the lexicon from ~110 seed entries toward the 500-1000 target (which semantic domains matter most to the user first).
