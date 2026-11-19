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

## 2026-11-19 — Engine implementation (phonology/morphology/translator)

### D6. Added missing consonants "v" and "th" to the phonology inventory
**Decision:** `data/phonology/phonology.json` is extended with `v` (voiced labiodental fricative) and `th` (voiceless dental fricative, /θ/). Both already appeared constantly in `data/lexicon/lexicon.json` (e.g. "varn" to speak, "vel" tree, and the phonology file's own earlier example word "qâth" "fire") but were never declared as phonemes, so the tokenizer could not parse roughly a third of the lexicon.
**Rationale:** Spec §18's "smallest consistent extension" clause — the lexicon's own data already assumed these sounds existed; the phonology table was simply incomplete, not contradicted. Added full IPA/place/manner/voicing/position metadata consistent with the existing inventory's format. `v` is zoned to the glyph generator's "top" stem region (with bilabial/labial-velar) and `th` to "middle" (with alveolar/postalveolar/palatal), per `alphabet.json`'s placeOfArticulationRule, updated accordingly.

### D7. "ü" (diaeresis) recognised as a written variant of "û"
**Decision:** The long vowel `û` entry in phonology.json gains a `writtenVariants: ["ü"]` field. `grammar.json`'s own pronoun paradigm (`ük`, `ükûn`, 1sg/1pl subject forms) and the lexicon's matching entries use "ü", a grapheme phonology.json's vowel table never declared. Rather than rewrite the core pronoun paradigm (used throughout both grammar.json and lexicon.json consistently), the written variant is now explicitly documented as orthographically identical in sound to "û".
**Rationale:** Minimal, additive, and keeps every existing data file's spelling valid rather than picking one file to "win" over the other.

### D8. Plural epenthetic allomorph is literally "-akûk", not "root + a + ûk"
**Decision:** For roots ending in -k, the plural suffix allomorph is the fixed string "akûk" appended after the root (e.g. "rûk" -> "rûkakûk"), matching the literal parenthetical example already written in `grammar.json`'s `nouns.pluralRule` ("-akûk"), rather than a compositional "insert -a- then add -ûk" reading (which would yield "rûkaûk").
**Rationale:** grammar.json's own prose names the resulting allomorph explicitly; the engine follows that literal string so the generated form matches the one documented example to the letter.

### D9. GKH predicate/attributive adjective resolution is POS-disambiguated
**Decision:** Several Gurzûl Khar roots are deliberately homophonous/homographic across word classes by design (e.g. "khar" is simultaneously the noun "strength", the verb "to be strong", and the adjective "strong" — all legitimate word-family members of one root, per spec §6.3). When the translator needs an adjective specifically (predicate adjectives after "ash", attributive adjectives following a noun), it looks up the lexicon entry filtered to `pos: "adjective"` rather than taking whichever entry happens to be listed first for that surface form.
**Rationale:** Without this, "the king is stronger" (shak ash zan khar) rendered as "the king is more strength" because the generic lookup returned the noun entry. This is an engine-side disambiguation rule, not a change to any linguistic fact in `/data`.

### D10. Discovered inconsistency: grammar.json's complexSentenceExample gloss vs. its own tense suffix
**Finding (not changed, flagged):** `grammar.json`'s `syntax.complexSentenceExample` is `"ük zûrak sû tû pâkâth" = "I know that you will go"`. The word "zûrak" is root "zûr" + the *past*-tense suffix "-ak" (per `verbs.tenseSuffixes.past`), so the only translation consistent with the language's own documented morphology is "I **knew** that you will go" — the free English gloss in the example disagrees with the word's own suffix. The engine trusts the morphological suffix (the actual GKH data) over the explanatory prose gloss, and this regression test (`tests/regression.test.ts`, "GKH->EN complex sentence") is pinned to "I knew that you will go." This is logged here rather than silently "corrected" in grammar.json, since the example's intent (illustrating the complementiser `sû`) is unaffected either way.

### D11. EN/NL surface generation is a documented, non-exhaustive simplification
**Decision:** Rendering a GKH clause back into English or Dutch prose (`engine/translator/naturalLanguage.ts`) uses: a closed, explicit list of English/Dutch irregular past-tense and Dutch irregular-stem verb forms covering only the verbs that occur in this project's lexicon/tests; a regular-pattern fallback (`-ed`, `-s`, strip final `-en`, add `-t`) everywhere else; and analytic "more X" / "most X" comparative and superlative forms in both languages rather than attempting `-er`/`-est` or Dutch vowel-lengthening spelling changes.
**Rationale:** English/Dutch are the *interface* languages, not the conlang itself — spec §14's single-source-of-truth mandate applies to Gurzûl Khar's own grammar, not to how precisely the translator reproduces every irregular English/Dutch verb form. This is called out explicitly (here and in BACKLOG.md) rather than silently presented as complete EN/NL grammatical coverage.

## 2026-11-19 — Phase 2: alphabet redesign

### D12. Khargûl script redesigned as "Thornscript" (v0.2.0), replacing the v0.1 stem+stroke system
**Decision:** Following explicit Phase 2 direction that the v0.1 letterforms were visually unsatisfactory, three independent visual concepts were designed and shown to the project owner: Stonecarve (angular wedge strokes crossing a spine), Black iron (solid blocky shapes, no shared spine), and Thornscript (thin diagonal "thorns" branching off a spine, drawable in one continuous pen stroke). The owner selected Thornscript.
**Rationale:** Thornscript was recommended and chosen specifically because spec §4.1/§4.4 require the script to be realistically handwritable and to support stroke-order lessons; Stonecarve and Black iron both require the pen to lift and restart for most letters, while Thornscript's spine-then-thorns-then-back-to-spine path is a single stroke by construction.
**What changed:** `data/orthography/alphabet.json` bumped to v0.2.0 with new `constructionPrinciples` (spine + thorn geometry, place → zone, manner → thorn pattern, voicing → tick, vowel → thorn angle) and a new `handwriting` section (stroke order, handwritten-variant allowance). The procedural-generation philosophy from D3 is preserved — only the geometry the generator draws has changed, not the principle that glyphs are derived from phonological features rather than hand-drawn per letter. `engine/phonology/glyphGenerator.ts` is being rewritten to this spec.
**Impact:** Every previously-rendered v0.1 glyph is visually replaced; no change to Latin transliteration, phonology, or grammar.

## Open questions for the project owner (non-blocking — current defaults stand until revisited)
- Whether Gurzûl Khar should eventually gain a grammatical case system beyond the current postposition-based strategy.
- Whether regional/historical dialect variants (spec §10.8) should diverge phonologically or only lexically.
- Priority order for expanding the lexicon from ~110 seed entries toward the 500-1000 target (which semantic domains matter most to the user first).
